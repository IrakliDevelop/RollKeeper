import React, { StrictMode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasElement, Viewport } from '@fieldnotes/core';
import { createGrid, FogManager } from '@fieldnotes/vtt';

import type { ManagedConnectionOptions } from '@/lib/battlemapSync';
import {
  fieldnotesElementRegistry,
  installVttGridController,
} from '@/lib/fieldnotesVtt';
import type { RealViewportHarness } from '@/test/realViewport';
import { expectNoLiveTimers, trackTimers } from '@/test/timerLeakGuard';
import { TableDisplayShell } from '../TableDisplayShell';
import type { TableDisplayDeps } from '../tableDisplayController';
import { defaultTableDisplayDeps } from '../tableDisplayDeps';
import { displayStorageKey } from '../displayCredentialStore';
import { resetCalibrationStores } from '../calibration/session';
import { CALIBRATION_STORAGE_KEY } from '../calibration/settings';

/**
 * PR07 P3, P5–P7, P12, R3-1/R3-2/R3-5, C7-2/C7-3 through the real shell:
 * `FieldNotesCanvas` is replaced by a host that mounts a REAL core Viewport
 * (real InputHandler, HandTool, camera, grid controller) into the canvas
 * container, so the capture-phase guards meet core's own listeners.
 */

const canvas = vi.hoisted(() => ({
  harnesses: [] as RealViewportHarness[],
  hooks: [] as Array<Set<{ afterAll?: () => void }>>,
  size: { w: 1000, h: 800 },
}));
vi.mock('@fieldnotes/react', async () => {
  const ReactModule = await import('react');
  const { mountRealViewport } = await import('@/test/realViewport');
  const vtt = await import('@/lib/fieldnotesVtt');
  function FieldNotesCanvas(props: {
    onReady: (vp: unknown) => void;
    tools?: Array<{ name: string }>;
    defaultTool?: string;
    style?: React.CSSProperties;
  }) {
    const ref = ReactModule.useRef<HTMLDivElement>(null);
    ReactModule.useEffect(() => {
      const harness = mountRealViewport(
        { elementRegistry: vtt.fieldnotesElementRegistry },
        { ...canvas.size },
        ref.current!
      );
      for (const tool of props.tools ?? [])
        harness.viewport.toolManager.register(tool as never);
      if (props.defaultTool) harness.viewport.setTool(props.defaultTool);
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
      canvas.harnesses.push(harness);
      canvas.hooks.push(hooks);
      props.onReady(harness.viewport);
      return () => harness.destroy();
    }, []);
    return <div ref={ref} style={props.style} />;
  }
  return { FieldNotesCanvas };
});
const markers = vi.hoisted(() => ({ register: vi.fn() }));
vi.mock('@/components/ui/campaign/location-map/useMarkerRegistration', () => ({
  useMarkerRegistration: markers.register,
}));

const CODE = 'CAMP1';
const CAPABILITY = 'Cap5Synthetic_display-capability_0123456789';
const NONCE = 'Nonce5Synthetic_012345';
const EPOCH = '19a12345-1234-4123-8123-123456789abc';
const REMOTE = { origin: 'remote' };

type Grid = { type: 'square' | 'hex'; cellSize: number } | null;
let scenes: Record<string, Grid>;
let descriptor: Record<string, unknown>;
let acks: Array<Record<string, unknown>>;
let connections: Array<{ options: ManagedConnectionOptions }>;
let deps: TableDisplayDeps;
let fitView: ReturnType<typeof vi.fn<(viewport: Viewport) => void>>;

const sceneDescriptor = (sceneId: string, revision: number) => ({
  displayGeneration: 7,
  epoch: EPOCH,
  presentation: { sceneId, revision, blanked: false },
  scene: { sceneId, sourceMapId: `map-${sceneId}`, label: sceneId },
});
const emptyDescriptor = (revision: number, blanked: boolean) => ({
  displayGeneration: 7,
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
    createGrid({ gridType: type, cellSize, layerId: 'map' })
  ) as unknown as CanvasElement;
  return { ...envelope, id: 'grid' } as CanvasElement;
}

/** jsdom has no physical-setup APIs: give it controllable ones. */
const physical = {
  fullscreen: true,
  dpr: 1,
  scale: 1,
  screenWidth: 1920,
  screenHeight: 1080,
  orientation: 'landscape-primary',
  screenX: 1920,
  screenY: 0,
  originLeft: 0,
  originTop: 0,
};
let queries: EventTarget[];
let visualViewport: EventTarget & { scale: number };
let orientation: EventTarget & { type: string };
function installPhysicalEnvironment() {
  Object.assign(physical, {
    fullscreen: true,
    dpr: 1,
    scale: 1,
    screenWidth: 1920,
    screenHeight: 1080,
    orientation: 'landscape-primary',
    screenX: 1920,
    screenY: 0,
    originLeft: 0,
    originTop: 0,
  });
  queries = [];
  const define = (target: object, key: string, get: () => unknown) =>
    Object.defineProperty(target, key, { configurable: true, get });
  // Live getters (Object.assign would copy a getter's value once).
  visualViewport = new EventTarget() as EventTarget & { scale: number };
  define(visualViewport, 'scale', () => physical.scale);
  orientation = new EventTarget() as EventTarget & { type: string };
  define(orientation, 'type', () => physical.orientation);
  define(document, 'fullscreenElement', () =>
    physical.fullscreen ? document.body : null
  );
  define(window, 'devicePixelRatio', () => physical.dpr);
  define(window, 'visualViewport', () => visualViewport);
  define(window, 'screenX', () => physical.screenX);
  define(window, 'screenY', () => physical.screenY);
  define(window.screen, 'width', () => physical.screenWidth);
  define(window.screen, 'height', () => physical.screenHeight);
  define(window.screen, 'orientation', () => orientation);
  vi.stubGlobal('matchMedia', (media: string) => {
    const query = Object.assign(new EventTarget(), { media, matches: true });
    queries.push(query);
    return query;
  });
}
function uninstallPhysicalEnvironment() {
  for (const [target, key] of [
    [document, 'fullscreenElement'],
    [window, 'devicePixelRatio'],
    [window, 'visualViewport'],
    [window, 'screenX'],
    [window, 'screenY'],
    [window.screen, 'width'],
    [window.screen, 'height'],
    [window.screen, 'orientation'],
  ] as const)
    delete (target as unknown as Record<string, unknown>)[key];
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
    ],
  });
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  installPhysicalEnvironment();
  canvas.harnesses = [];
  canvas.hooks = [];
  canvas.size = { w: 1000, h: 800 };
  scenes = {
    tavern: { type: 'square', cellSize: 50 },
    cave: { type: 'hex', cellSize: 50 },
  };
  descriptor = sceneDescriptor('tavern', 2);
  acks = [];
  connections = [];
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetCalibrationStores();
  window.sessionStorage.setItem(
    displayStorageKey(CODE),
    JSON.stringify({ capability: CAPABILITY, nonce: NONCE })
  );
  process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/table/display/descriptor'))
        return new Response(JSON.stringify(descriptor));
      if (url.endsWith('/table/display/ack')) {
        acks.push(JSON.parse(String(init?.body)).ack);
        return new Response(JSON.stringify({ receivedAt: 1 }));
      }
      return new Response(JSON.stringify({ fogAppearance: 'solid' }));
    })
  );
  fitView = vi.fn<(viewport: Viewport) => void>(viewport =>
    viewport.fitToContent(60)
  );
  deps = {
    ...defaultTableDisplayDeps(),
    createConnection: vi.fn((options: ManagedConnectionOptions) => {
      connections.push({ options });
      options.store.add(mapImage(), REMOTE);
      const grid = scenes[options.tokenRequest.sceneId!];
      if (grid)
        options.store.add(gridEnvelope(grid.type, grid.cellSize), REMOTE);
      return { stop: vi.fn() } as never;
    }),
    prepareViewport: viewport => installVttGridController(viewport),
    startFogAppearance: vi.fn(() => () => {}),
    createFogPlugin: () => ({ manager: new FogManager() }) as never,
    applyLayer: undefined,
    fitView,
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  uninstallPhysicalEnvironment();
  window.localStorage.clear();
  resetCalibrationStores();
  delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
});

const root = () => screen.getByTestId('table-display');
const state = () => root().getAttribute('data-calibration-state');
const viewport = () => canvas.harnesses.at(-1)!.viewport;
const wrapper = () => canvas.harnesses.at(-1)!.wrapper;
const camera = () => ({
  ...viewport().camera.position,
  zoom: viewport().camera.zoom,
});
const cssPxPerSquare = () => viewport().camera.zoom * 50;

async function flush() {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
async function mount(strict = false) {
  const tree = <TableDisplayShell code={CODE} deps={deps} />;
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  await flush();
  await advance(0);
}
async function goLive() {
  const connection = connections.at(-1)!;
  await act(async () => {
    connection.options.onStatus?.('live');
    connection.options.fog!.manager.loadState(null, { origin: 'remote' });
  });
  await advance(0);
  await advance(1);
  const hooks = canvas.hooks.at(-1)!;
  await act(async () => {
    for (const entry of [...hooks]) entry.afterAll?.();
  });
  await advance(0);
  await act(async () => {
    for (const entry of [...hooks]) entry.afterAll?.();
  });
  await flush();
}
async function show(next: Record<string, unknown>) {
  descriptor = next;
  await advance(2_000);
}
async function calibrate() {
  fireEvent.pointerMove(window);
  fireEvent.click(screen.getByRole('button', { name: 'Calibrate minis' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await flush();
}

function pointer(type: string, id: number, x: number, y: number, extra = {}) {
  wrapper().dispatchEvent(
    new PointerEvent(type, {
      pointerId: id,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1,
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      ...extra,
    })
  );
}
function wheel(extra: WheelEventInit = {}) {
  wrapper().dispatchEvent(
    new WheelEvent('wheel', {
      deltaY: -300,
      clientX: 400,
      clientY: 300,
      bubbles: true,
      cancelable: true,
      ...extra,
    })
  );
}
function mouseDrag(dx: number, dy: number) {
  const base = { pointerType: 'mouse' };
  pointer('pointerdown', 1, 300, 300, base);
  pointer('pointermove', 1, 300 + dx / 2, 300 + dy / 2, base);
  pointer('pointermove', 1, 300 + dx, 300 + dy, base);
  pointer('pointerup', 1, 300 + dx, 300 + dy, base);
}

describe('ruler calibration panel (P3)', () => {
  it('shows a reference square of exactly C CSS px, adjusts by buttons and arrow keys, and leaves the camera alone until Confirm', async () => {
    await mount();
    await goLive();
    expect(state()).toBe('uncalibrated');
    const before = camera();
    fireEvent.pointerMove(window);
    fireEvent.click(screen.getByRole('button', { name: 'Calibrate minis' }));
    const panel = screen.getByRole('region', { name: 'Ruler calibration' });
    const square = screen.getByTestId('calibration-reference-square');
    expect(square.style.width).toBe('96px');
    expect(square.style.height).toBe('96px');
    expect(square.style.boxSizing).toBe('border-box');
    expect(panel.textContent).toContain(
      'Hold a ruler against the square. Adjust until each side measures 25.4 mm on this screen, then Confirm.'
    );
    expect(panel.textContent).toContain(
      'Calibrated minis support: extended monitor, browser fullscreen, browser zoom 100%. Verify scale again after moving the window to another display, changing browser zoom, OS scaling or resolution, or leaving fullscreen — the browser cannot detect every change.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 1 px' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 1 px' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease by 0.1 px' }));
    expect(square.style.width).toBe('97.9px');
    fireEvent.keyDown(panel, { key: 'ArrowDown' });
    fireEvent.keyDown(panel, { key: 'ArrowUp', shiftKey: true });
    expect(square.style.width).toBe('97px');
    fireEvent.keyDown(panel, { key: 'ArrowLeft' });
    expect(square.style.width).toBe('96px');
    fireEvent.change(screen.getByLabelText('Square size (mm)'), {
      target: { value: '30' },
    });
    expect(panel.textContent).toContain('measures 30 mm on this screen');
    expect(camera()).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await flush();
    expect(state()).toBe('verified');
    expect(viewport().camera.zoom).toBe(96 / 50);
    expect(cssPxPerSquare()).toBeCloseTo(96, 12);
    expect(
      screen.queryByRole('region', { name: 'Ruler calibration' })
    ).toBeNull();
    expect(acks.at(-1)!).toMatchObject({ calibration: 'verified' });
    // Storage audit: one namespaced key of non-secret numbers; the
    // credential stays in sessionStorage only.
    expect(Object.keys(window.localStorage)).toEqual([CALIBRATION_STORAGE_KEY]);
    const saved = JSON.parse(
      window.localStorage.getItem(CALIBRATION_STORAGE_KEY)!
    );
    expect(Object.keys(saved).sort()).toEqual([
      'cssPxPerSquare',
      'preferCalibrated',
      'savedAt',
      'squareMm',
      'v',
    ]);
    expect(saved).toMatchObject({ cssPxPerSquare: 96, squareMm: 30 });
    expect(JSON.stringify(saved)).not.toContain(CAPABILITY);
  });

  it('Cancel changes nothing; Use uncalibrated view keeps PR05 behaviour', async () => {
    await mount();
    await goLive();
    const before = camera();
    fireEvent.pointerMove(window);
    fireEvent.click(screen.getByRole('button', { name: 'Calibrate minis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 1 px' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(state()).toBe('uncalibrated');
    expect(camera()).toEqual(before);
    expect(window.localStorage.getItem(CALIBRATION_STORAGE_KEY)).toBeNull();
    await calibrate();
    expect(state()).toBe('verified');
    fireEvent.pointerMove(window);
    fireEvent.click(screen.getByRole('button', { name: 'Verify scale' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Use uncalibrated view' })
    );
    await flush();
    expect(state()).toBe('uncalibrated');
    fireEvent.pointerMove(window);
    expect(screen.getByRole('button', { name: 'Fit map' })).toBeTruthy();
  });
});

describe('session-only verification (P1)', () => {
  it('StrictMode remount keeps verified; a new page with saved values is verify-required and offers the prior value', async () => {
    await mount(true);
    await goLive();
    await calibrate();
    expect(state()).toBe('verified');
    cleanup();
    await mount(true);
    await goLive();
    expect(state()).toBe('verified');
    cleanup();
    // A reload: the module store is gone, the saved values remain.
    resetCalibrationStores();
    await mount();
    await goLive();
    expect(state()).toBe('verify-required');
    expect(viewport().camera.zoom).not.toBe(96 / 50);
    const status = screen.getByTestId('table-display-calibration');
    expect(status.textContent).toContain('Scale needs verification');
    fireEvent.click(screen.getByRole('button', { name: 'Verify scale' }));
    const panel = screen.getByRole('region', { name: 'Ruler calibration' });
    expect(panel.textContent).toMatch(
      /Saved ruler setting from .+ — confirm it with your ruler/u
    );
    expect(panel.textContent).not.toMatch(/this monitor|identif/iu);
    expect(acks.at(-1)!).toMatchObject({
      calibration: 'verify-required',
    });
  });
});

describe('invalidation freezes the transform (P5, P6)', () => {
  const signals: Array<[string, () => void]> = [
    [
      'fullscreenchange',
      () => {
        physical.fullscreen = false;
        document.dispatchEvent(new Event('fullscreenchange'));
      },
    ],
    [
      'devicePixelRatio change',
      () => {
        physical.dpr = 1.5;
        queries.at(-1)!.dispatchEvent(new Event('change'));
      },
    ],
    [
      'visualViewport scale',
      () => {
        physical.scale = 1.1;
        visualViewport.dispatchEvent(new Event('resize'));
      },
    ],
    [
      'screen size',
      () => {
        physical.screenWidth = 2560;
        window.dispatchEvent(new Event('resize'));
      },
    ],
    [
      'screen orientation',
      () => {
        physical.orientation = 'portrait-primary';
        orientation.dispatchEvent(new Event('change'));
      },
    ],
    [
      'window move (poll)',
      () => {
        physical.screenX = 0;
      },
    ],
    [
      'canvas origin move (poll)',
      () => {
        physical.originLeft = 40;
      },
    ],
  ];

  it.each(signals)(
    '%s → verify-required, byte-identical camera, frozen input, immediate ACK',
    async (_name, fire) => {
      await mount();
      vi.spyOn(root(), 'getBoundingClientRect').mockImplementation(
        () =>
          ({
            left: physical.originLeft,
            top: physical.originTop,
          }) as DOMRect
      );
      await goLive();
      await calibrate();
      expect(state()).toBe('verified');
      mouseDrag(-40, 25);
      const before = camera();
      const sent = acks.length;
      await act(async () => fire());
      await advance(1_000);
      expect(state()).toBe('verify-required');
      expect(camera()).toEqual(before);
      expect(acks.length).toBeGreaterThan(sent);
      expect(acks[sent]!).toMatchObject({
        calibration: 'verify-required',
      });
      // Frozen: drag, wheel and pinch never move the camera.
      mouseDrag(80, 80);
      wheel();
      pointer('pointerdown', 7, 100, 100);
      pointer('pointerdown', 8, 200, 200);
      pointer('pointermove', 8, 400, 400);
      expect(camera()).toEqual(before);
      expect(
        screen.getByTestId('table-display-calibration').textContent
      ).toContain('Scale needs verification');
      fireEvent.pointerMove(window);
      expect(
        screen.queryByRole('button', { name: /Centre map|Fit map/u })
      ).toBeNull();
    }
  );

  it('stable-origin resize keeps a world point at identical canvas coordinates; an origin move freezes', async () => {
    await mount();
    const rect = vi
      .spyOn(root(), 'getBoundingClientRect')
      .mockImplementation(
        () => ({ left: physical.originLeft, top: 0 }) as DOMRect
      );
    await goLive();
    await calibrate();
    const fits = fitView.mock.calls.length;
    const resized = vi.fn();
    viewport().onResize(resized);
    const point = { x: 1234.5, y: 678.25 };
    const at = viewport().camera.worldToScreen(point);
    // Grow, then shrink, at the right/bottom: window resize events plus
    // core's own ResizeObserver path, with every P5 listener attached.
    for (const [w, h] of [
      [1400, 1000],
      [700, 500],
      [1000, 800],
    ]) {
      await act(async () => {
        canvas.harnesses.at(-1)!.resize(w, h);
        window.dispatchEvent(new Event('resize'));
      });
      await advance(1_000);
      expect(viewport().getCanvasSize()).toEqual({ w, h });
      expect(viewport().camera.worldToScreen(point)).toEqual(at);
      expect(state()).toBe('verified');
    }
    expect(fitView.mock.calls.length).toBe(fits);
    expect(resized).toHaveBeenCalledTimes(3);
    const before = camera();
    physical.originLeft = 15;
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(state()).toBe('verify-required');
    expect(camera()).toEqual(before);
    rect.mockRestore();
  });
});

describe('input policy (P7, R3-2, C7-3)', () => {
  it('verified: HandTool pan keeps CSS px per square; wheel, ctrl+wheel, pinch and keyboard zoom are blocked', async () => {
    await mount();
    await goLive();
    await calibrate();
    const before = camera();
    mouseDrag(-60, 35);
    const after = camera();
    expect(after.x).toBe(before.x - 60);
    expect(after.y).toBe(before.y + 35);
    expect(cssPxPerSquare()).toBeCloseTo(96, 12);
    wheel();
    wheel({ ctrlKey: true, deltaY: -50 });
    expect(camera()).toEqual(after);
    // A real two-pointer pinch through core's InputHandler.
    pointer('pointerdown', 11, 100, 100);
    pointer('pointerdown', 12, 200, 200);
    pointer('pointermove', 12, 420, 420);
    pointer('pointermove', 11, 50, 50);
    pointer('pointerup', 12, 420, 420);
    pointer('pointerup', 11, 50, 50);
    expect(viewport().camera.zoom).toBe(96 / 50);
    // Gesture events (Safari trackpad pinch) never reach the canvas.
    const gesture = new Event('gesturestart', {
      bubbles: true,
      cancelable: true,
    });
    wrapper().dispatchEvent(gesture);
    expect(gesture.defaultPrevented).toBe(true);
    const bindings = viewport().shortcuts.getBindings();
    for (const action of [
      'view.zoom-in',
      'view.zoom-out',
      'view.zoom-reset',
      'view.zoom-to-fit',
    ])
      expect(bindings[action] ?? []).toEqual([]);
    expect(
      (screen.getByTestId('table-display-canvas') as HTMLElement).style
        .touchAction
    ).toBe('none');
    fireEvent.pointerMove(window);
    expect(screen.getByRole('button', { name: 'Centre map' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fit map' })).toBeNull();
  });

  it('hovering the guarded canvas still reveals Centre map and the edge status', async () => {
    await mount();
    await goLive();
    await calibrate();
    await advance(3_000);
    expect(screen.queryByRole('button', { name: 'Centre map' })).toBeNull();
    // A real hover over the canvas: the guard swallows it for the camera,
    // but the page-level visibility listener must still see it.
    act(() =>
      pointer('pointermove', 1, 420, 300, { pointerType: 'mouse', buttons: 0 })
    );
    expect(screen.getByRole('button', { name: 'Centre map' })).toBeTruthy();
    expect(
      screen.getByTestId('table-display-calibration').textContent
    ).toContain('Scale verified');
  });

  it('a freeze mid-drag ends the drag: after Use uncalibrated a plain hover never pans (review F3)', async () => {
    await mount();
    await goLive();
    await calibrate();
    const mouse = { pointerType: 'mouse' };
    pointer('pointerdown', 1, 300, 300, mouse);
    pointer('pointermove', 1, 320, 310, mouse);
    await act(async () => {
      physical.fullscreen = false;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(state()).toBe('verify-required');
    const frozen = camera();
    pointer('pointermove', 1, 360, 340, mouse);
    pointer('pointerup', 1, 360, 340, { ...mouse, buttons: 0 });
    expect(camera()).toEqual(frozen);
    fireEvent.click(
      screen.getByRole('button', { name: 'Use uncalibrated view' })
    );
    await flush();
    expect(state()).toBe('uncalibrated');
    const free = camera();
    pointer('pointermove', 1, 500, 500, { ...mouse, buttons: 0 });
    pointer('pointermove', 1, 600, 450, { ...mouse, buttons: 0 });
    expect(camera()).toEqual(free);
  });

  it('a blocked second pointer moves nothing while the first keeps panning', async () => {
    await mount();
    await goLive();
    await calibrate();
    const mouse = { pointerType: 'mouse' };
    pointer('pointerdown', 1, 300, 300, mouse);
    pointer('pointerdown', 2, 500, 500);
    const held = camera();
    pointer('pointermove', 2, 700, 700);
    pointer('pointermove', 2, 900, 100);
    pointer('pointerup', 2, 900, 100);
    expect(camera()).toEqual(held);
    pointer('pointermove', 1, 320, 310, mouse);
    pointer('pointerup', 1, 320, 310, mouse);
    expect(viewport().camera.zoom).toBe(96 / 50);
  });

  it('uncalibrated regression: wheel and pinch zoom and Fit map still work', async () => {
    await mount();
    await goLive();
    const zoom = viewport().camera.zoom;
    wheel();
    expect(viewport().camera.zoom).toBeGreaterThan(zoom);
    const afterWheel = viewport().camera.zoom;
    pointer('pointerdown', 21, 100, 100);
    pointer('pointerdown', 22, 200, 200);
    pointer('pointermove', 22, 400, 400);
    expect(viewport().camera.zoom).not.toBe(afterWheel);
    const bindings = viewport().shortcuts.getBindings();
    expect(bindings['view.zoom-in']).not.toEqual([]);
    fireEvent.pointerMove(window);
    fireEvent.click(screen.getByRole('button', { name: 'Fit map' }));
    expect(fitView).toHaveBeenCalledTimes(2);
  });
});

describe('unsupported geometry (P4, C7-2, C7-3)', () => {
  it('session held on a hex scene: unsupported message, uncalibrated camera and free input', async () => {
    await mount();
    await goLive();
    await calibrate();
    await show(sceneDescriptor('cave', 3));
    await goLive();
    expect(state()).toBe('unsupported');
    expect(
      screen.getByTestId('table-display-calibration').textContent
    ).toContain(
      'Calibrated minis need a square grid on this scene — showing the uncalibrated view'
    );
    const zoom = viewport().camera.zoom;
    wheel();
    expect(viewport().camera.zoom).not.toBe(zoom);
    expect(acks.at(-1)!).toMatchObject({ calibration: 'unsupported' });
  });

  it('no session on a hex scene: Verify scale and the unsupported message, frozen input, ACK verify-required', async () => {
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
    descriptor = sceneDescriptor('cave', 2);
    await mount();
    await goLive();
    expect(state()).toBe('verify-required');
    const status = screen.getByTestId('table-display-calibration');
    expect(status.textContent).toContain(
      'Calibrated minis need a square grid on this scene — showing the uncalibrated view'
    );
    expect(screen.getByRole('button', { name: 'Verify scale' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Use uncalibrated view' })
    ).toBeTruthy();
    const before = camera();
    wheel();
    mouseDrag(50, 50);
    expect(camera()).toEqual(before);
    expect(acks.at(-1)!).toMatchObject({
      calibration: 'verify-required',
    });
  });

  it('blank and waiting with no canvas never clear the session by themselves', async () => {
    await mount();
    await goLive();
    await calibrate();
    await show(emptyDescriptor(3, true));
    await advance(10_000);
    await show(emptyDescriptor(4, false));
    await advance(10_000);
    expect(state()).toBe('verified');
    expect(acks.at(-1)!).toMatchObject({ calibration: 'verified' });
    await show(sceneDescriptor('tavern', 5));
    await goLive();
    expect(state()).toBe('verified');
    expect(viewport().camera.zoom).toBe(96 / 50);
  });
});

describe('testability and resource discipline (P12)', () => {
  it('exposes the public camera transform on the display container', async () => {
    await mount();
    await goLive();
    await calibrate();
    mouseDrag(-10, 20);
    const { x, y } = viewport().camera.position;
    expect(root().getAttribute('data-camera-x')).toBe(String(x));
    expect(root().getAttribute('data-camera-y')).toBe(String(y));
    expect(root().getAttribute('data-camera-zoom')).toBe(String(96 / 50));
  });

  it('unmount releases every calibration listener and the poll', async () => {
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    const docAdded = vi.spyOn(document, 'addEventListener');
    const docRemoved = vi.spyOn(document, 'removeEventListener');
    await mount();
    await goLive();
    await calibrate();
    await advance(3_000);
    cleanup();
    // Core's own viewport listeners are released through an AbortSignal;
    // the calibration listeners are removed explicitly.
    const watched = new Set([
      'resize',
      'orientationchange',
      'fullscreenchange',
      'pointermove',
    ]);
    const count = (calls: unknown[][]) =>
      calls.reduce<Record<string, number>>((acc, call) => {
        const type = String(call[0]);
        if (watched.has(type)) acc[type] = (acc[type] ?? 0) + 1;
        return acc;
      }, {});
    expect(count(added.mock.calls)).toHaveProperty('resize');
    expect(count(removed.mock.calls)).toEqual(count(added.mock.calls));
    expect(count(docAdded.mock.calls)).toHaveProperty('fullscreenchange');
    expect(count(docRemoved.mock.calls)).toEqual(count(docAdded.mock.calls));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no live interval with real timers (timer-leak guard)', async () => {
    vi.useRealTimers();
    trackTimers();
    try {
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
      render(<TableDisplayShell code={CODE} deps={deps} />);
      await flush();
      fireEvent.click(
        await screen.findByRole('button', { name: 'Verify scale' })
      );
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      await flush();
      cleanup();
    } finally {
      expectNoLiveTimers();
    }
  });
});
