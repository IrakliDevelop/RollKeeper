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
 * Acceptance A1: the real @fieldnotes/core camera helpers
 * (`captureCameraView` / `applyCameraView`, which assert a positive view)
 * behind a viewport double whose canvas size can be 0 — as a destroyed
 * (StrictMode-remounted) or not-yet-laid-out canvas reports. The display
 * must never remember or apply a degenerate view, never throw from
 * readiness, and never stay stuck: it stays covered and retries.
 */

const CODE = 'CAMP1';
const EPOCH = '19a12345-1234-4123-8123-123456789abc';
const CREDENTIAL = {
  capability: 'Cap5Synthetic_display-capability_0123456789',
  nonce: 'Nonce5Synthetic_012345',
};

interface ViewportDouble {
  vp: Viewport;
  size: { w: number; h: number };
  hooks: Set<{ afterAll?: () => void }>;
  frame(): void;
  camera: Camera;
}

function viewportDouble(size = { w: 0, h: 0 }): ViewportDouble {
  const camera = new Camera();
  const hooks = new Set<{ afterAll?: () => void }>();
  const state = { w: size.w, h: size.h };
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
    requestRender: vi.fn(),
    getCanvasSize: () => ({ w: state.w, h: state.h }),
    getVisibleRect: () => camera.getVisibleRect(state.w, state.h),
    // Core semantics: no-op on a zero-size wrapper or empty content.
    fitToContent: (padding = 40) => {
      if (state.w === 0 || state.h === 0) return;
      camera.fitToContent(
        { x: 0, y: 0, w: 512, h: 512 },
        state.w,
        state.h,
        padding
      );
    },
  } as unknown as Viewport;
  return {
    vp,
    size: state,
    hooks,
    camera,
    frame() {
      for (const entry of [...hooks]) entry.afterAll?.();
    },
  };
}

const tavern = {
  displayGeneration: 3,
  epoch: EPOCH,
  presentation: { sceneId: 'tavern', revision: 2, blanked: false },
  scene: { sceneId: 'tavern', sourceMapId: 'map-tavern', label: 'Tavern' },
};

let connections: Array<{
  options: ManagedConnectionOptions;
  stop: ReturnType<typeof vi.fn>;
}>;
let views: TableDisplayView[];
let deps: TableDisplayDeps;
let controller: TableDisplayController | null;

function start(overrides: Partial<TableDisplayDeps> = {}) {
  deps = {
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
    ...overrides,
  };
  controller = new TableDisplayController({
    code: CODE,
    credential: CREDENTIAL,
    relayUrl: 'wss://relay.test',
    deps,
    onView: view => views.push(view),
    onCredentialDenied: () => {},
    fetcher: (async (url: string) =>
      String(url).endsWith('/descriptor')
        ? new Response(JSON.stringify(tavern))
        : new Response(JSON.stringify({ receivedAt: 1 }))) as typeof fetch,
  });
  controller.start();
}

const cover = () => views.at(-1)?.cover ?? null;
const canvasKey = () => views.at(-1)?.canvas?.key ?? null;
async function tick(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
}
async function goLive(double: ViewportDouble) {
  const connection = connections.at(-1)!;
  connection.options.onStatus?.('live');
  connection.options.fog!.manager.loadState(null, { origin: 'remote' });
  await tick(0);
  double.frame();
  double.frame();
  await tick(0);
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  connections = [];
  views = [];
  controller = null;
});
afterEach(() => {
  controller?.stop();
  vi.useRealTimers();
});

describe('display camera with the real core camera helpers (acceptance A1)', () => {
  it('never remembers a degenerate view: a zero-size first attach then a real one uncovers', async () => {
    start();
    await tick(0);
    const detached = viewportDouble({ w: 0, h: 0 });
    controller!.onViewportReady(canvasKey()!, detached.vp);
    // A destroyed/unlaid canvas renders no frame: live + fog only.
    connections.at(-1)!.options.onStatus?.('live');
    connections.at(-1)!.options.fog!.manager.loadState(null, {
      origin: 'remote',
    });
    await tick(0);
    expect(cover()).toBe(DISPLAY_WAITING);
    // Readiness timeout → covered retry with a fresh canvas.
    await tick(15_000);
    await tick(1_000);
    const laidOut = viewportDouble({ w: 1024, h: 768 });
    controller!.onViewportReady(canvasKey()!, laidOut.vp);
    await goLive(laidOut);
    expect(cover()).toBeNull();
    // The view it now remembers is a real one.
    controller!.fitMap();
    expect(laidOut.camera.zoom).toBeGreaterThan(0);
  });

  it('rebinds to the newest viewport when the canvas remounts under one key (StrictMode)', async () => {
    start();
    await tick(0);
    const key = canvasKey()!;
    const destroyed = viewportDouble({ w: 0, h: 0 });
    const mounted = viewportDouble({ w: 1024, h: 768 });
    controller!.onViewportReady(key, destroyed.vp);
    controller!.onViewportReady(key, mounted.vp);
    expect(connections).toHaveLength(2);
    expect(connections[0]!.stop).toHaveBeenCalledTimes(1);
    expect(connections[1]!.options.store).toBe(mounted.vp.store);
    expect(destroyed.hooks.size).toBe(0);
    await goLive(mounted);
    expect(cover()).toBeNull();
  });

  it('a throwing camera application stays covered and retries instead of sticking', async () => {
    const applyView = vi.fn(() => {
      throw new Error('[fieldnotes] CameraView requires positive w and h');
    });
    const fitView = vi.fn(() => {
      throw new Error('fit failed');
    });
    start({ applyView, fitView });
    await tick(0);
    const first = viewportDouble({ w: 1024, h: 768 });
    controller!.onViewportReady(canvasKey()!, first.vp);
    await goLive(first);
    expect(cover()).toBe(DISPLAY_WAITING);
    const attaches = connections.length;
    await tick(1_000);
    expect(connections.length).toBeGreaterThanOrEqual(attaches);
    expect(views.at(-1)?.canvas?.key ?? 0).toBeGreaterThan(1);
  });

  it('Fit map never stores or applies a degenerate view', async () => {
    start();
    await tick(0);
    const double = viewportDouble({ w: 1024, h: 768 });
    controller!.onViewportReady(canvasKey()!, double.vp);
    await goLive(double);
    expect(cover()).toBeNull();
    double.size.w = 0;
    double.size.h = 0;
    expect(() => controller!.fitMap()).not.toThrow();
    // A reconnect of the same scene must still come back uncovered.
    connections.at(-1)!.options.onStatus?.('denied');
    await tick(1_000);
    const next = viewportDouble({ w: 1024, h: 768 });
    controller!.onViewportReady(canvasKey()!, next.vp);
    await goLive(next);
    expect(cover()).toBeNull();
  });
});
