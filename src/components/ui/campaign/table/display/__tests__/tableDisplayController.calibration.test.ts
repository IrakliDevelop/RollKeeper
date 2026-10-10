import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Camera, type CanvasElement, type Viewport } from '@fieldnotes/core';
import { createGrid, FogManager } from '@fieldnotes/vtt';

import type { ManagedConnectionOptions } from '@/lib/battlemapSync';
import {
  fieldnotesElementRegistry,
  getVttGridController,
  installVttGridController,
} from '@/lib/fieldnotesVtt';
import {
  mountRealViewport,
  type RealViewportHarness,
} from '@/test/realViewport';
import {
  TableDisplayController,
  type TableDisplayDeps,
  type TableDisplayView,
} from '../tableDisplayController';
import { defaultTableDisplayDeps } from '../tableDisplayDeps';
import {
  CALIBRATED_ZOOM_LIMITS,
  DEFAULT_ZOOM_LIMITS,
  setZoomLimits,
  zoomLimits,
} from '../calibration/geometry';
import type { EnvironmentSnapshot } from '../calibration/environment';
import {
  getCalibrationStore,
  resetCalibrationStores,
  type CalibrationStore,
} from '../calibration/session';
import { CALIBRATION_STORAGE_KEY } from '../calibration/settings';
import { DISPLAY_WAITING } from '../displayMessages';

/**
 * PR07 P1/P4/P5/P8, R3-1, M2 on the controller with real core viewports, the
 * real vtt grid controller and the real display projection. Frames are
 * driven by hand (rAF stubbed) so readiness/ACK ordering is deterministic.
 */

const CODE = 'CAMP1';
const EPOCH = '19a12345-1234-4123-8123-123456789abc';
const CREDENTIAL = {
  capability: 'Cap5Synthetic_display-capability_0123456789',
  nonce: 'Nonce5Synthetic_012345',
};
const REMOTE = { origin: 'remote' };
const SIZE = { w: 1000, h: 800 };
const C = 96;

type Grid = { type: 'square' | 'hex'; cellSize: number } | null;

interface Mounted {
  harness: RealViewportHarness;
  vp: Viewport;
  hooks: Set<{ afterAll?: () => void }>;
  frame(): void;
}

let mounted: Mounted[];
let connections: Array<{
  options: ManagedConnectionOptions;
  stop: ReturnType<typeof vi.fn>;
}>;
let views: TableDisplayView[];
let acks: Array<Record<string, unknown>>;
let descriptor: Record<string, unknown>;
let controller: TableDisplayController | null;
let store: CalibrationStore;
let env: EnvironmentSnapshot;
let fitView: ReturnType<typeof vi.fn<(viewport: Viewport) => void>>;
let applyView: ReturnType<typeof vi.fn<TableDisplayDeps['applyView']>>;
let scenes: Record<string, Grid>;

function mountViewport(): Mounted {
  const harness = mountRealViewport(
    { elementRegistry: fieldnotesElementRegistry },
    { ...SIZE }
  );
  const hooks = new Set<{ afterAll?: () => void }>();
  const registry = harness.viewport.renderHooks.viewport as unknown as {
    register: (entry: { afterAll?: () => void }) => () => void;
  };
  const original = registry.register.bind(registry);
  registry.register = entry => {
    hooks.add(entry);
    const off = original(entry);
    return () => {
      hooks.delete(entry);
      off();
    };
  };
  const result = {
    harness,
    vp: harness.viewport,
    hooks,
    frame() {
      for (const entry of [...hooks]) entry.afterAll?.();
    },
  };
  mounted.push(result);
  return result;
}

const sceneDescriptor = (sceneId: string, revision: number) => ({
  displayGeneration: 3,
  epoch: EPOCH,
  presentation: { sceneId, revision, blanked: false },
  scene: { sceneId, sourceMapId: `map-${sceneId}`, label: sceneId },
});
const emptyDescriptor = (revision: number, blanked: boolean) => ({
  displayGeneration: 3,
  epoch: EPOCH,
  presentation: { sceneId: null, revision, blanked },
  scene: null,
});

function mapImage(): CanvasElement {
  return {
    id: 'map-image',
    type: 'shape',
    shape: 'rectangle',
    position: { x: 0, y: 0 },
    size: { w: 2000, h: 1500 },
    zIndex: 0,
    locked: true,
    layerId: 'map',
  } as unknown as CanvasElement;
}
function gridEnvelope(type: 'square' | 'hex', cellSize: number) {
  const adapter = fieldnotesElementRegistry.getAdapter('vtt:grid')!;
  const envelope = adapter.wrap(
    createGrid({ gridType: type, cellSize: 50, layerId: 'map' })
  ) as unknown as { id: string; data: Record<string, unknown> };
  envelope.id = 'grid';
  envelope.data = { ...envelope.data, cellSize };
  return envelope as unknown as CanvasElement;
}
function token(id: string, physical: boolean): CanvasElement {
  return {
    id,
    type: 'shape',
    shape: 'ellipse',
    position: { x: 100, y: 100 },
    size: { w: 50, h: 50 },
    zIndex: 1,
    locked: false,
    layerId: 'annotations',
    tokenKind: 'combatant',
    sceneMemberId: `member-${id}`,
    entityId: `member-${id}`,
    ...(physical ? { tableRepresentation: 'physical' } : {}),
  } as unknown as CanvasElement;
}

function start(withCalibration = true) {
  fitView = vi.fn<(viewport: Viewport) => void>(viewport =>
    viewport.fitToContent(60)
  );
  const base = defaultTableDisplayDeps();
  applyView = vi.fn<TableDisplayDeps['applyView']>(base.applyView);
  const deps: TableDisplayDeps = {
    ...base,
    createConnection: vi.fn((options: ManagedConnectionOptions) => {
      const connection = { options, stop: vi.fn() };
      connections.push(connection);
      // The relay snapshot for this scene lands in the connection's store.
      const sceneId = options.tokenRequest.sceneId!;
      options.store.add(mapImage(), REMOTE);
      const grid = scenes[sceneId];
      if (grid)
        options.store.add(gridEnvelope(grid.type, grid.cellSize), REMOTE);
      return connection as never;
    }),
    prepareViewport: viewport => installVttGridController(viewport),
    startFogAppearance: vi.fn(() => () => {}),
    createFogPlugin: () => ({ manager: new FogManager() }) as never,
    applyLayer: undefined,
    fitView,
    applyView,
  };
  controller = new TableDisplayController({
    code: CODE,
    credential: CREDENTIAL,
    relayUrl: 'wss://relay.test',
    deps,
    calibration: withCalibration
      ? { store, readEnvironment: () => ({ ...env }) }
      : undefined,
    onView: view => {
      views.push(view);
      const key = view.canvas?.key;
      if (key !== undefined && mounted.length < key) {
        const next = mountViewport();
        queueMicrotask(() => controller?.onViewportReady(key, next.vp));
      }
    },
    onCredentialDenied: () => {},
    fetcher: (async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/descriptor'))
        return new Response(JSON.stringify(descriptor));
      acks.push(JSON.parse(String(init?.body)).ack);
      return new Response(JSON.stringify({ receivedAt: 1 }));
    }) as typeof fetch,
  });
  controller.start();
}

const last = () => views.at(-1)!;
const cover = () => last().cover;
const report = () => last().calibration.report;
const current = () => mounted.at(-1)!;
const cameraOf = (target = current()) => ({
  ...target.vp.camera.position,
  zoom: target.vp.camera.zoom,
});
async function tick(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
}
async function goLive(connection = connections.at(-1)!) {
  connection.options.onStatus?.('live');
  connection.options.fog!.manager.loadState(null, { origin: 'remote' });
  await tick(0);
  // A nested 0 ms timer (e.g. the one-tick grid wait) is due 1 ms later.
  await tick(1);
  current().frame();
  await tick(0);
  current().frame();
  await tick(0);
}
async function show(next: Record<string, unknown>) {
  descriptor = next;
  await tick(2_000);
}
function confirm(cssPxPerSquare = C) {
  store.confirm({
    cssPxPerSquare,
    squareMm: 25.4,
    environment: { ...env },
    now: 1,
  });
}
/** Canvas CSS coordinates of a world point. */
const screenOf = (point: { x: number; y: number }, target = current()) =>
  target.vp.camera.worldToScreen(point);
const centreWorld = (target = current()) =>
  target.vp.camera.screenToWorld({ x: SIZE.w / 2, y: SIZE.h / 2 });

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  window.localStorage.clear();
  resetCalibrationStores();
  store = getCalibrationStore(CODE);
  env = {
    fullscreen: true,
    devicePixelRatio: 1,
    viewportScale: 1,
    screenWidth: 1920,
    screenHeight: 1080,
    orientation: 'landscape-primary',
    screenX: 1920,
    screenY: 0,
    originLeft: 0,
    originTop: 0,
  };
  mounted = [];
  connections = [];
  views = [];
  acks = [];
  controller = null;
  scenes = {
    tavern: { type: 'square', cellSize: 50 },
    forest: { type: 'square', cellSize: 25 },
    cave: { type: 'hex', cellSize: 50 },
    void: null,
  };
  descriptor = sceneDescriptor('tavern', 2);
});
afterEach(() => {
  controller?.stop();
  for (const item of mounted) item.harness.destroy();
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetCalibrationStores();
});

describe('display projection wiring (M2)', () => {
  it('syncs into a private store: physical minis never reach the viewport store; readiness sees the projection', async () => {
    start();
    await tick(0);
    const connection = connections.at(-1)!;
    const source = connection.options.store;
    expect(source).not.toBe(current().vp.store);
    source.add(token('mini', true), REMOTE);
    source.add(token('goblin', false), REMOTE);
    await goLive();
    expect(cover()).toBeNull();
    expect(source.getById('mini')).toBeDefined();
    expect(current().vp.store.getById('mini')).toBeUndefined();
    expect(current().vp.store.getById('goblin')).toBeDefined();
    expect(current().vp.store.getById('map-image')).toBeDefined();
    // Toggling the field shows/hides the token at once.
    source.update(
      'goblin',
      { tableRepresentation: 'physical' } as never,
      REMOTE
    );
    expect(current().vp.store.getById('goblin')).toBeUndefined();
    expect(acks.at(-1)).toMatchObject({ phase: 'loaded', sceneId: 'tavern' });
  });
});

describe('calibrated camera (P4, P8)', () => {
  it('arrives at C/U exactly with the content centred; ACK reports verified', async () => {
    confirm();
    start();
    await tick(0);
    await goLive();
    expect(cover()).toBeNull();
    expect(current().vp.camera.zoom).toBe(1.92);
    expect(zoomLimits(current().vp.camera)).toEqual(CALIBRATED_ZOOM_LIMITS);
    const centre = screenOf({ x: 1000, y: 750 });
    expect(centre.x).toBeCloseTo(500, 9);
    expect(centre.y).toBeCloseTo(400, 9);
    expect(fitView).not.toHaveBeenCalled();
    expect(report()).toBe('verified');
    expect(acks.at(-1)).toMatchObject({
      phase: 'loaded',
      calibration: 'verified',
    });
  });

  it('reconnect (non-live → live) never fits, follows or re-applies, and keeps verified', async () => {
    confirm();
    start();
    await tick(0);
    await goLive();
    current().vp.camera.pan(-37, 21);
    const panned = cameraOf();
    const connection = connections.at(-1)!;
    connection.options.onStatus?.('offline');
    await tick(0);
    expect(cover()).toBe(DISPLAY_WAITING);
    await goLive(connection);
    expect(cover()).toBeNull();
    expect(cameraOf()).toEqual(panned);
    expect(fitView).not.toHaveBeenCalled();
    expect(applyView).not.toHaveBeenCalled();
    expect(report()).toBe('verified');
  });

  it('uncalibrated reconnect never fits again either (regression)', async () => {
    start();
    await tick(0);
    await goLive();
    expect(fitView).toHaveBeenCalledTimes(1);
    current().vp.camera.pan(5, 5);
    const panned = cameraOf();
    const connection = connections.at(-1)!;
    connection.options.onStatus?.('recovering');
    await tick(0);
    await goLive(connection);
    expect(cameraOf()).toEqual(panned);
    expect(fitView).toHaveBeenCalledTimes(1);
    expect(report()).toBe('uncalibrated');
  });

  it('restores the remembered origin exactly on re-attach; a scene switch uses the new U with the same C', async () => {
    confirm();
    start();
    await tick(0);
    await goLive();
    current().vp.camera.pan(-120.5, 64.25);
    const tavernOrigin = cameraOf();
    await show(sceneDescriptor('forest', 3));
    await goLive();
    expect(current().vp.camera.zoom).toBe(96 / 25);
    const forestCentre = screenOf({ x: 1000, y: 750 });
    expect(forestCentre.x).toBeCloseTo(500, 9);
    await show(sceneDescriptor('tavern', 4));
    await goLive();
    expect(cameraOf()).toEqual(tavernOrigin);
    expect(report()).toBe('verified');
  });

  it('a descriptor revision change keeps the attach, the camera and verified', async () => {
    confirm();
    start();
    await tick(0);
    await goLive();
    const before = cameraOf();
    const attaches = connections.length;
    await show(sceneDescriptor('tavern', 9));
    expect(connections).toHaveLength(attaches);
    expect(cameraOf()).toEqual(before);
    expect(report()).toBe('verified');
    expect(acks.at(-1)).toMatchObject({
      presentationRevision: 9,
      calibration: 'verified',
    });
  });

  it('O7-1a: a reload with saved values (legacy preferCalibrated) starts uncalibrated; Confirm on the uncovered attach keeps the canvas-centre world point', async () => {
    window.localStorage.setItem(
      CALIBRATION_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        cssPxPerSquare: 96,
        squareMm: 25.4,
        preferCalibrated: true,
        savedAt: 1,
      })
    );
    resetCalibrationStores();
    store = getCalibrationStore(CODE);
    start();
    await tick(0);
    await goLive();
    // Page start: the E11 camera, no calibrated claim and no freeze.
    expect(report()).toBe('uncalibrated');
    expect(fitView).toHaveBeenCalledTimes(1);
    expect(current().vp.camera.zoom).not.toBe(1.92);
    expect(acks.at(-1)).toMatchObject({ calibration: 'uncalibrated' });
    const world = centreWorld();
    const sent = acks.length;
    confirm();
    expect(current().vp.camera.zoom).toBe(1.92);
    const after = screenOf(world);
    expect(after.x).toBeCloseTo(500, 9);
    expect(after.y).toBeCloseTo(400, 9);
    expect(report()).toBe('verified');
    // Sent at once, not on the 5 s heartbeat.
    expect(acks.length).toBe(sent + 1);
    await tick(0);
    expect(acks.at(-1)).toMatchObject({ calibration: 'verified' });
  });

  it('a scale outside the supported range is unsupported with the E11 camera', async () => {
    confirm(1000);
    scenes.tavern = { type: 'square', cellSize: 10 };
    start();
    await tick(0);
    await goLive();
    expect(report()).toBe('unsupported');
    expect(last().calibration.unsupported).toBe('range');
    expect(fitView).toHaveBeenCalledTimes(1);
    expect(zoomLimits(current().vp.camera)).toEqual(DEFAULT_ZOOM_LIMITS);
  });

  it('waits one tick for a grid that lands after live; a missing grid never blocks the ACK', async () => {
    confirm();
    scenes.tavern = null;
    start();
    await tick(0);
    const connection = connections.at(-1)!;
    connection.options.onStatus?.('live');
    connection.options.fog!.manager.loadState(null, { origin: 'remote' });
    await tick(0);
    connection.options.store.add(gridEnvelope('square', 50), REMOTE);
    // Fake timers give a 0 ms timer created inside a tick a 1 ms delay.
    await tick(1);
    current().frame();
    await tick(0);
    current().frame();
    await tick(0);
    expect(current().vp.camera.zoom).toBe(1.92);
    expect(report()).toBe('verified');

    await show(sceneDescriptor('void', 5));
    await goLive();
    expect(cover()).toBeNull();
    expect(report()).toBe('unsupported');
    expect(last().calibration.unsupported).toBe('grid');
    expect(acks.at(-1)).toMatchObject({
      sceneId: 'void',
      phase: 'loaded',
      calibration: 'unsupported',
    });
  });

  it('Centre map pans the content centre to the canvas centre at fixed zoom', async () => {
    confirm();
    start();
    await tick(0);
    await goLive();
    current().vp.camera.pan(300, -200);
    controller!.fitMap();
    expect(current().vp.camera.zoom).toBe(1.92);
    const centre = screenOf({ x: 1000, y: 750 });
    expect(centre.x).toBeCloseTo(500, 9);
    expect(centre.y).toBeCloseTo(400, 9);
    expect(fitView).not.toHaveBeenCalled();
  });

  it('the zoom watcher restores C/U keeping the canvas-centre world point', async () => {
    confirm();
    start();
    await tick(0);
    await goLive();
    // Replica of the disturbed camera: the world point it shows at the
    // canvas centre is what the watcher keeps there while restoring C/U.
    const replica = new Camera();
    setZoomLimits(replica, CALIBRATED_ZOOM_LIMITS);
    replica.setZoom(current().vp.camera.zoom);
    replica.moveTo(
      current().vp.camera.position.x,
      current().vp.camera.position.y
    );
    replica.zoomAt(3, { x: 10, y: 10 });
    const world = replica.screenToWorld({ x: SIZE.w / 2, y: SIZE.h / 2 });
    current().vp.camera.zoomAt(3, { x: 10, y: 10 });
    expect(current().vp.camera.zoom).toBe(1.92);
    const after = screenOf(world);
    expect(after.x).toBeCloseTo(500, 9);
    expect(after.y).toBeCloseTo(400, 9);
  });

  it('rebinding to a remounted canvas re-applies the calibrated camera exactly once on the new viewport', async () => {
    confirm();
    start();
    await tick(0);
    const key = last().canvas!.key;
    const first = current();
    const connection = connections.at(-1)!;
    connection.options.onStatus?.('live');
    connection.options.fog!.manager.loadState(null, { origin: 'remote' });
    await tick(0);
    await tick(0);
    expect(first.vp.camera.zoom).toBe(1.92);
    const second = mountViewport();
    const zoomSpy = vi.spyOn(second.vp.camera, 'zoomAt');
    controller!.onViewportReady(key, second.vp);
    await goLive();
    expect(second.vp.camera.zoom).toBe(1.92);
    expect(zoomSpy).toHaveBeenCalledTimes(1);
    expect(cover()).toBeNull();
  });
});

describe('review 01 F2 discriminating cases', () => {
  it('KEEP_CENTRE: uncalibrated → pan → Calibrate → Confirm keeps the panned canvas-centre world point', async () => {
    start();
    await tick(0);
    await goLive();
    expect(report()).toBe('uncalibrated');
    current().vp.camera.pan(-233, 117);
    const world = centreWorld();
    expect(world.x).not.toBeCloseTo(1000, 3);
    confirm();
    expect(current().vp.camera.zoom).toBe(1.92);
    const after = screenOf(world);
    expect(after.x).toBeCloseTo(500, 9);
    expect(after.y).toBeCloseTo(400, 9);
  });

  it('VIEWS_EXCL2: a non-live status on an uncovered calibrated camera never feeds the E11 view memory', async () => {
    confirm();
    start();
    await tick(0);
    await goLive();
    expect(current().vp.camera.zoom).toBe(1.92);
    const connection = connections.at(-1)!;
    connection.options.onStatus?.('offline');
    await tick(0);
    store.invalidate();
    connection.options.onStatus?.('denied');
    await tick(1_000);
    await goLive();
    expect(cover()).toBeNull();
    expect(report()).toBe('verify-required');
    expect(applyView).not.toHaveBeenCalled();
    expect(fitView.mock.calls.at(-1)?.[0]).toBe(current().vp);
    expect(current().vp.camera.zoom).not.toBe(1.92);
  });

  it('REBIND_CALNULL: a rebind drops the old calibrated state, so a later uncalibrated camera is remembered (E11)', async () => {
    confirm();
    start();
    await tick(0);
    const key = last().canvas!.key;
    const first = current();
    const connection = connections.at(-1)!;
    connection.options.onStatus?.('live');
    connection.options.fog!.manager.loadState(null, { origin: 'remote' });
    await tick(0);
    await tick(1);
    expect(first.vp.camera.zoom).toBe(1.92);
    // Canvas remount, then the session is cleared before the new viewport
    // is ready: the new camera is the E11 fit.
    const second = mountViewport();
    controller!.onViewportReady(key, second.vp);
    store.invalidate();
    await goLive();
    expect(cover()).toBeNull();
    expect(second.vp.camera.zoom).not.toBe(1.92);
    second.vp.camera.pan(41, -17);
    const panned = second.vp.getVisibleRect();
    const next = connections.at(-1)!;
    next.options.onStatus?.('offline');
    next.options.onStatus?.('denied');
    await tick(1_000);
    // The hand-mounted remount shifted the auto-mount count: mount the
    // retry's canvas explicitly.
    const third = mountViewport();
    controller!.onViewportReady(last().canvas!.key, third.vp);
    await goLive();
    expect(cover()).toBeNull();
    expect(applyView).toHaveBeenCalled();
    const restored = current().vp.getVisibleRect();
    for (const side of ['x', 'y', 'w', 'h'] as const)
      expect(restored[side]).toBeCloseTo(panned[side], 6);
  });
});

describe('freeze and invalidation (P5, P6, R3-1, C7-1)', () => {
  it('an invalidation freezes the transform byte-identically and reports verify-required at once', async () => {
    confirm();
    start();
    await tick(0);
    await goLive();
    current().vp.camera.pan(-11.125, 3.5);
    const before = cameraOf();
    const limits = zoomLimits(current().vp.camera);
    const sent = acks.length;
    store.invalidate();
    expect(cameraOf()).toEqual(before);
    expect(zoomLimits(current().vp.camera)).toEqual(limits);
    expect(report()).toBe('verify-required');
    expect(acks.length).toBe(sent + 1);
    await tick(0);
    expect(acks.at(-1)).toMatchObject({ calibration: 'verify-required' });
    // Fit/Centre are not camera paths while frozen.
    controller!.fitMap();
    expect(cameraOf()).toEqual(before);
    expect(fitView).not.toHaveBeenCalled();
  });

  it('a grid cell size or type change on the shown scene requires re-verification; style-only changes do not', async () => {
    confirm();
    start();
    await tick(0);
    await goLive();
    const source = connections.at(-1)!.options.store;
    const grid = source.getById('grid') as unknown as {
      data: Record<string, unknown>;
    };
    source.update(
      'grid',
      { data: { ...grid.data, strokeColor: '#ff0000', opacity: 0.5 } } as never,
      REMOTE
    );
    expect(report()).toBe('verified');
    const before = cameraOf();
    const latest = source.getById('grid') as unknown as {
      data: Record<string, unknown>;
    };
    source.update(
      'grid',
      { data: { ...latest.data, cellSize: 60 } } as never,
      REMOTE
    );
    expect(report()).toBe('verify-required');
    expect(cameraOf()).toEqual(before);
    expect(getVttGridController(current().vp).getInfo()?.cellSize).toBe(60);
  });

  it('a hex grid becoming square in place does not claim verified with an uncalibrated camera', async () => {
    confirm();
    descriptor = sceneDescriptor('cave', 2);
    start();
    await tick(0);
    await goLive();
    expect(report()).toBe('unsupported');
    const source = connections.at(-1)!.options.store;
    const grid = source.getById('grid') as unknown as {
      data: Record<string, unknown>;
    };
    source.update(
      'grid',
      { data: { ...grid.data, gridType: 'square' } } as never,
      REMOTE
    );
    expect(report()).toBe('verify-required');
  });

  const invalidateVia = {
    hex: async () => {
      await show(sceneDescriptor('cave', 3));
      await goLive();
      expect(report()).toBe('unsupported');
      expect(fitView).toHaveBeenCalledTimes(1);
      expect(zoomLimits(current().vp.camera)).toEqual(DEFAULT_ZOOM_LIMITS);
      store.invalidate();
    },
    blank: async () => {
      await show(emptyDescriptor(3, true));
      expect(acks.at(-1)).toMatchObject({ phase: 'blank' });
      store.invalidate();
    },
    waiting: async () => {
      await show(emptyDescriptor(3, false));
      store.invalidate();
    },
    covered: async () => {
      await show(sceneDescriptor('forest', 3));
      expect(cover()).toBe(DISPLAY_WAITING);
      store.invalidate();
      await goLive();
    },
  };

  it.each(Object.keys(invalidateVia) as Array<keyof typeof invalidateVia>)(
    'verified → %s → signal → square shown ⇒ verify-required, E11 camera, never a verified ACK',
    async path => {
      confirm();
      start();
      await tick(0);
      await goLive();
      expect(report()).toBe('verified');
      await invalidateVia[path]();
      const mark = acks.length;
      await show(sceneDescriptor('tavern', 6));
      await goLive();
      expect(cover()).toBeNull();
      expect(report()).toBe('verify-required');
      expect(current().vp.camera.zoom).not.toBe(1.92);
      expect(fitView.mock.calls.at(-1)?.[0]).toBe(current().vp);
      expect(zoomLimits(current().vp.camera)).toEqual(DEFAULT_ZOOM_LIMITS);
      expect(acks.slice(mark).map(ack => ack.calibration)).not.toContain(
        'verified'
      );
      expect(acks.at(-1)).toMatchObject({
        sceneId: 'tavern',
        calibration: 'verify-required',
      });
    }
  );

  it('the session survives hex, blank and waiting without a signal: square returns verified with the same C', async () => {
    confirm();
    start();
    await tick(0);
    await goLive();
    await show(sceneDescriptor('cave', 3));
    await goLive();
    expect(report()).toBe('unsupported');
    await show(emptyDescriptor(4, true));
    expect(report()).toBe('verified');
    await show(emptyDescriptor(5, false));
    await show(sceneDescriptor('forest', 6));
    await goLive();
    expect(report()).toBe('verified');
    expect(current().vp.camera.zoom).toBe(96 / 25);
  });

  it('re-checks the environment immediately before applying: a mismatch clears the session and applies no C/U', async () => {
    confirm();
    env = { ...env, screenX: 0 };
    start();
    await tick(0);
    await goLive();
    expect(store.getState().session).toBeNull();
    expect(report()).toBe('verify-required');
    expect(current().vp.camera.zoom).not.toBe(1.92);
    expect(fitView).toHaveBeenCalledTimes(1);
  });

  it('Use uncalibrated restores the default limits without changing the camera; Fit map then fits (E11)', async () => {
    confirm();
    start();
    await tick(0);
    await goLive();
    const before = cameraOf();
    store.useUncalibrated();
    expect(cameraOf()).toEqual(before);
    expect(zoomLimits(current().vp.camera)).toEqual(DEFAULT_ZOOM_LIMITS);
    expect(report()).toBe('uncalibrated');
    controller!.fitMap();
    expect(fitView).toHaveBeenCalledTimes(1);
    // The core default clamp applies again.
    current().vp.camera.setZoom(40);
    expect(current().vp.camera.zoom).toBe(10);
  });

  it('without the calibration option the ACK keeps the six PR05 keys', async () => {
    start(false);
    await tick(0);
    await goLive();
    expect(Object.keys(acks.at(-1)!).sort()).toEqual([
      'blanked',
      'displayGeneration',
      'epoch',
      'phase',
      'presentationRevision',
      'sceneId',
    ]);
  });
});
