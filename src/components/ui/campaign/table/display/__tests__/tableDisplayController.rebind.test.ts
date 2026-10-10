import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Camera, ElementStore, type Viewport } from '@fieldnotes/core';
import { FogManager } from '@fieldnotes/vtt';

import type { ManagedConnectionOptions } from '@/lib/battlemapSync';
import {
  TableDisplayController,
  type TableDisplayDeps,
  type TableDisplayView,
} from '../tableDisplayController';
import { defaultTableDisplayDeps } from '../tableDisplayDeps';
import { DISPLAY_WAITING } from '../displayMessages';

/**
 * PR07 P11 (PR05 review 03 R3-1 fold): discriminating tests for the A1
 * rebind resetting `cameraApplied` (REBIND_CAM) and the fog flags
 * (REBIND_FOG), the confirming-frame 1 s re-request (NORETRY) and the
 * `fitMap` failure catch (FITCATCH).
 */

const EPOCH = '19a12345-1234-4123-8123-123456789abc';
const CREDENTIAL = {
  capability: 'Cap5Synthetic_display-capability_0123456789',
  nonce: 'Nonce5Synthetic_012345',
};

interface Double {
  vp: Viewport;
  camera: Camera;
  hooks: Set<{ afterAll?: () => void }>;
  /** Render requests are swallowed while true (a frame that never paints). */
  dropping: boolean;
  needsRender: boolean;
  animationFrame(): void;
}

function double(): Double {
  const camera = new Camera();
  const hooks = new Set<{ afterAll?: () => void }>();
  const state: Double = {
    vp: null as unknown as Viewport,
    camera,
    hooks,
    dropping: false,
    needsRender: false,
    animationFrame() {
      if (!state.needsRender) return;
      for (const entry of [...hooks]) entry.afterAll?.();
      state.needsRender = false;
    },
  };
  state.vp = {
    store: new ElementStore(),
    camera,
    renderHooks: {
      viewport: {
        register(entry: { afterAll?: () => void }) {
          hooks.add(entry);
          return () => hooks.delete(entry);
        },
      },
    },
    requestRender: () => {
      if (!state.dropping) state.needsRender = true;
    },
    getCanvasSize: () => ({ w: 1024, h: 768 }),
    getVisibleRect: () => camera.getVisibleRect(1024, 768),
    fitToContent: (padding = 40) =>
      camera.fitToContent({ x: 0, y: 0, w: 512, h: 512 }, 1024, 768, padding),
  } as unknown as Viewport;
  return state;
}

let connections: Array<{ options: ManagedConnectionOptions }>;
let views: TableDisplayView[];
let acks: Array<Record<string, unknown>>;
let controller: TableDisplayController | null;
let deps: TableDisplayDeps;

function start(overrides: Partial<TableDisplayDeps> = {}) {
  deps = {
    ...defaultTableDisplayDeps(),
    createConnection: vi.fn((options: ManagedConnectionOptions) => {
      connections.push({ options });
      return { stop: vi.fn() } as never;
    }),
    prepareViewport: vi.fn(),
    startFogAppearance: vi.fn(() => () => {}),
    createFogPlugin: () => ({ manager: new FogManager() }) as never,
    applyLayer: undefined,
    projectStore: undefined,
    ...overrides,
  };
  controller = new TableDisplayController({
    code: 'CAMP1',
    credential: CREDENTIAL,
    relayUrl: 'wss://relay.test',
    deps,
    onView: view => views.push(view),
    onCredentialDenied: () => {},
    fetcher: (async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/descriptor'))
        return new Response(
          JSON.stringify({
            displayGeneration: 3,
            epoch: EPOCH,
            presentation: { sceneId: 'tavern', revision: 2, blanked: false },
            scene: {
              sceneId: 'tavern',
              sourceMapId: 'map-tavern',
              label: 'Tavern',
            },
          })
        );
      acks.push(JSON.parse(String(init?.body)).ack);
      return new Response(JSON.stringify({ receivedAt: 1 }));
    }) as typeof fetch,
  });
  controller.start();
}

const cover = () => views.at(-1)?.cover ?? null;
const key = () => views.at(-1)!.canvas!.key;
async function tick(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
}
const live = (connection = connections.at(-1)!) =>
  connection.options.onStatus?.('live');
const fog = (connection = connections.at(-1)!) =>
  connection.options.fog!.manager.loadState(null, { origin: 'remote' });

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  connections = [];
  views = [];
  acks = [];
  controller = null;
});
afterEach(() => {
  controller?.stop();
  cleanup();
  vi.useRealTimers();
});

describe('A1 rebind resets the attach readiness (P11)', () => {
  it('REBIND_CAM: a camera applied on the destroyed viewport is applied again on the new one', async () => {
    const fitView = vi.fn((viewport: Viewport) => viewport.fitToContent(60));
    const applyView = vi.fn(defaultTableDisplayDeps().applyView);
    start({ fitView, applyView });
    await tick(0);
    const first = double();
    controller!.onViewportReady(key(), first.vp);
    live();
    fog();
    await tick(0);
    expect(fitView).toHaveBeenCalledWith(first.vp);
    const second = double();
    controller!.onViewportReady(key(), second.vp);
    live();
    fog();
    await tick(0);
    // The remembered view of this scene is applied to the new viewport.
    expect(applyView).toHaveBeenCalledWith(second.vp, expect.anything());
    expect(second.camera.zoom).toBeCloseTo(first.camera.zoom, 9);
  });

  it('REBIND_FOG: the new viewport stays covered until its own fog checkpoint applies', async () => {
    start();
    await tick(0);
    const first = double();
    controller!.onViewportReady(key(), first.vp);
    live();
    fog();
    await tick(0);
    const second = double();
    controller!.onViewportReady(key(), second.vp);
    live();
    await tick(0);
    second.needsRender = true;
    second.animationFrame();
    await tick(0);
    expect(cover()).toBe(DISPLAY_WAITING);
    fog();
    await tick(0);
    second.animationFrame();
    expect(cover()).toBeNull();
  });
});

describe('confirming frame and Fit map failure (P11)', () => {
  it('NORETRY: a dropped confirming-frame request is re-asked every second until a frame confirms', async () => {
    start();
    await tick(0);
    const view = double();
    controller!.onViewportReady(key(), view.vp);
    live();
    fog();
    await tick(0);
    view.animationFrame();
    expect(cover()).toBeNull();
    // The first confirming request (deferred) is swallowed: no frame.
    view.dropping = true;
    await tick(0);
    view.animationFrame();
    expect(acks.filter(ack => ack.phase === 'loaded')).toHaveLength(0);
    view.dropping = false;
    await tick(1_010);
    expect(view.needsRender).toBe(true);
    view.animationFrame();
    await tick(0);
    expect(acks.filter(ack => ack.phase === 'loaded')).toHaveLength(1);
  });

  it('FITCATCH: a throwing fit never escapes Fit map and remembers nothing', async () => {
    const captureView = vi.fn(() => ({ x: 0, y: 0, w: 10, h: 10 }));
    let failing = false;
    const fitView = vi.fn((viewport: Viewport) => {
      if (failing) throw new Error('fit failed');
      viewport.fitToContent(60);
    });
    start({ fitView, captureView });
    await tick(0);
    const view = double();
    controller!.onViewportReady(key(), view.vp);
    live();
    fog();
    await tick(0);
    view.animationFrame();
    expect(cover()).toBeNull();
    const captures = captureView.mock.calls.length;
    failing = true;
    expect(() => controller!.fitMap()).not.toThrow();
    expect(captureView).toHaveBeenCalledTimes(captures);
  });
});
