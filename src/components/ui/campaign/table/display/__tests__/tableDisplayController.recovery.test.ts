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
 * Acceptance A3/A2. The viewport double reproduces the core render loop
 * exactly: `requestRender()` only sets `needsRender`; each animation frame
 * runs `if (needsRender) { render(); needsRender = false }`, and
 * `render()` calls the `afterAll` hooks. A `requestRender()` made from
 * inside an `afterAll` hook is therefore cleared by the same frame — as
 * in @fieldnotes/core 0.86 `RenderLoop`.
 */

const EPOCH = '19a12345-1234-4123-8123-123456789abc';
const CREDENTIAL = {
  capability: 'Cap5Synthetic_display-capability_0123456789',
  nonce: 'Nonce5Synthetic_012345',
};

interface LoopViewport {
  vp: Viewport;
  camera: Camera;
  hooks: Set<{ afterAll?: () => void }>;
  /** One animation frame of the core render loop. */
  animationFrame(): void;
}

function loopViewport(): LoopViewport {
  const camera = new Camera();
  const hooks = new Set<{ afterAll?: () => void }>();
  let needsRender = false;
  const size = { w: 1024, h: 768 };
  const vp = {
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
      needsRender = true;
    },
    getCanvasSize: () => ({ ...size }),
    getVisibleRect: () => camera.getVisibleRect(size.w, size.h),
    fitToContent: (padding = 40) =>
      camera.fitToContent(
        { x: 0, y: 0, w: 512, h: 512 },
        size.w,
        size.h,
        padding
      ),
  } as unknown as Viewport;
  return {
    vp,
    camera,
    hooks,
    animationFrame() {
      if (!needsRender) return;
      for (const entry of [...hooks]) entry.afterAll?.();
      needsRender = false;
    },
  };
}

const scene = (sceneId: string, revision: number) => ({
  displayGeneration: 3,
  epoch: EPOCH,
  presentation: { sceneId, revision, blanked: false },
  scene: { sceneId, sourceMapId: `map-${sceneId}`, label: sceneId },
});

let connections: Array<{
  options: ManagedConnectionOptions;
  stop: ReturnType<typeof vi.fn>;
}>;
let views: TableDisplayView[];
let viewports: LoopViewport[];
let controller: TableDisplayController | null;
let descriptor: ReturnType<typeof scene>;
let stalled: boolean;
let acks: Array<Record<string, unknown>>;

/** Requests hang (until aborted, if they are) while the proxy is stalled. */
const fetcher = (async (url: string, init?: RequestInit) => {
  if (stalled)
    return new Promise<Response>((_resolve, reject) =>
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError'))
      )
    );
  if (String(url).endsWith('/descriptor'))
    return new Response(JSON.stringify(descriptor));
  acks.push(JSON.parse(String(init?.body)).ack);
  return new Response(JSON.stringify({ receivedAt: 1 }));
}) as typeof fetch;

function start() {
  const deps: TableDisplayDeps = {
    ...defaultTableDisplayDeps(),
    createConnection: vi.fn((options: ManagedConnectionOptions) => {
      const connection = { options, stop: vi.fn() };
      connections.push(connection);
      return connection as never;
    }),
    prepareViewport: vi.fn(),
    startFogAppearance: vi.fn(() => () => {}),
    createFogPlugin: () => ({ manager: new FogManager() }) as never,
    applyLayer: undefined,
  };
  controller = new TableDisplayController({
    code: 'CAMP1',
    credential: CREDENTIAL,
    relayUrl: 'wss://relay.test',
    deps,
    onView: view => {
      views.push(view);
      // The shell mounts a fresh canvas for each attach key.
      const key = view.canvas?.key;
      if (key !== undefined && viewports.length < key) {
        const next = loopViewport();
        viewports.push(next);
        queueMicrotask(() => controller?.onViewportReady(key, next.vp));
      }
    },
    onCredentialDenied: () => {},
    fetcher,
  });
  controller.start();
}

const cover = () => views.at(-1)?.cover ?? null;
async function tick(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
}
/** Runs animation frames interleaved with timers (16 ms each). */
async function frames(count: number) {
  for (let index = 0; index < count; index += 1) {
    viewports.at(-1)!.animationFrame();
    await tick(16);
  }
}
async function live(connection = connections.at(-1)!) {
  connection.options.onStatus?.('live');
  connection.options.fog!.manager.loadState(null, { origin: 'remote' });
  await tick(0);
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  connections = [];
  views = [];
  viewports = [];
  acks = [];
  stalled = false;
  descriptor = scene('tavern', 7);
  controller = null;
});
afterEach(() => {
  controller?.stop();
  vi.useRealTimers();
});

describe('display ACK after readiness with the core render loop (acceptance A3)', () => {
  it('sends the loaded ACK and heartbeats on a static scene (no other render requests)', async () => {
    start();
    await tick(0);
    await live();
    await frames(5);
    expect(cover()).toBeNull();
    expect(acks.at(-1)).toMatchObject({ sceneId: 'tavern', phase: 'loaded' });
    const count = acks.length;
    await tick(5_000);
    expect(acks.length).toBe(count + 1);
  });

  it('after a stalled switch with a withdrawn socket, re-attaches via readiness and resumes ACKs', async () => {
    start();
    await tick(0);
    await live();
    await frames(5);
    expect(acks.at(-1)).toMatchObject({ sceneId: 'tavern', phase: 'loaded' });

    // DM shows Forest; the REST proxy stalls; the relay withdraws Tavern.
    descriptor = scene('forest', 8);
    stalled = true;
    const tavern = connections.at(-1)!;
    tavern.options.onStatus?.('offline');
    await tick(0);
    expect(cover()).toBe(DISPLAY_WAITING);
    await tick(29_000);
    expect(cover()).toBe(DISPLAY_WAITING);

    stalled = false;
    acks.length = 0;
    await tick(7_000);
    const forest = connections.at(-1)!;
    expect(forest.options.tokenRequest.sceneId).toBe('forest');
    // Not uncovered before readiness (live + fog + a rendered frame).
    await frames(3);
    expect(cover()).toBe(DISPLAY_WAITING);
    await live(forest);
    expect(cover()).toBe(DISPLAY_WAITING);
    await frames(5);
    expect(cover()).toBeNull();
    expect(acks.at(-1)).toEqual({
      displayGeneration: 3,
      epoch: EPOCH,
      presentationRevision: 8,
      sceneId: 'forest',
      blanked: false,
      phase: 'loaded',
    });
    const count = acks.length;
    await tick(10_000);
    expect(acks.length).toBeGreaterThanOrEqual(count + 2);
  });
});

describe('local pan survives a reconnect of the same scene (acceptance A2)', () => {
  it('restores the panned view, not the last fit, after a covered re-attach', async () => {
    start();
    await tick(0);
    await live();
    await frames(5);
    expect(cover()).toBeNull();
    controller!.fitMap();
    const first = viewports.at(-1)!;
    // An explicit local pan/zoom on the TV.
    first.camera.setZoom(first.camera.zoom * 2);
    first.camera.moveTo(-321, -123);
    const panned = first.vp.getVisibleRect();

    // Relay restart: non-live, then the attach is withdrawn and retried.
    connections.at(-1)!.options.onStatus?.('offline');
    connections.at(-1)!.options.onStatus?.('denied');
    await tick(1_000);
    const next = viewports.at(-1)!;
    expect(next).not.toBe(first);
    await live();
    await frames(5);
    expect(cover()).toBeNull();
    const restored = next.vp.getVisibleRect();
    for (const key of ['x', 'y', 'w', 'h'] as const)
      expect(restored[key]).toBeCloseTo(panned[key], 6);
  });
});
