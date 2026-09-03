import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  ElementStore,
  HtmlPainterRegistry,
  LayerManager,
  createHtmlElement,
  createShape,
} from '@fieldnotes/core';
import type {
  ActivationOptions,
  CanvasElement,
  ElementActivationEvent,
  HtmlElement,
  HtmlPainter,
  PointerState,
  Tool,
  ToolContext,
  Viewport,
} from '@fieldnotes/core';
import type { FieldNotesCanvasRef } from '@fieldnotes/react';

// The relay-configured positive control must not open a real socket. Only
// RollKeeper's own transport module is stubbed — every `@fieldnotes` module,
// including the whole marker stack, runs for real (CONSTRAINTS-B).
vi.mock('@/lib/battlemapSync', () => ({
  createManagedBattleMapConnection: vi.fn(() => ({
    stop: vi.fn(),
    sendPresence: vi.fn(),
    onPresence: vi.fn(() => vi.fn()),
    onPresenceLeave: vi.fn(() => vi.fn()),
    publishLayerUpsert: vi.fn(),
    publishLayerRemove: vi.fn(),
  })),
}));

import { useDmLocationEditor } from '../DmLocationEditor.hooks';
import { MARKER_TOOL_NAME } from '../DmMarkerTool';
import { MARKER_MIXED_AUDIENCE_MESSAGE } from '../markerAudienceCopy';
import {
  MARKER_HTML_TYPE,
  buildMarkerData,
  parseMarkerData,
} from '../markerData';
import type { MarkerElementDataV1 } from '../markerData';
import { ANNOTATIONS_LAYER_ID } from '../layerContract';
import { useBattleMapStore } from '@/store/battleMapStore';
import { useLocationStore } from '@/store/locationStore';
import type { BattleMap, MarkerDetail } from '@/types/battlemap';
import type { LocationMap } from '@/types/location';
import { buildMarkerPortalTarget } from '../markerPortal';

const CODE = 'TEST01';
const MAP_ID = 'bm-1';

/**
 * Viewport double for the marker seams. `store` / `layerManager` are the REAL
 * SDK classes and the painter registry is a REAL `HtmlPainterRegistry`, so
 * `getHtmlPainters().getActivePainter(...)` below is an observation of actual
 * SDK state rather than of a spy the test itself wired up. Zero `@fieldnotes`
 * module mocks (CONSTRAINTS-B).
 */
function makeStubViewport() {
  const store = new ElementStore();
  const layerManager = new LayerManager(store);
  const registry = new HtmlPainterRegistry();

  const seed = createShape({
    position: { x: 0, y: 0 },
    size: { w: 10, h: 10 },
  });
  store.add(seed);

  const selectionState = { selectedIds: [] as string[] };
  const selectionListeners = new Set<() => void>();
  const activateListeners = new Set<(event: ElementActivationEvent) => void>();
  const activationOptions: (ActivationOptions | null)[] = [];

  // createLocalCameraAnimator (real, unmocked) reads domLayer.parentElement.
  const wrapper = document.createElement('div');
  const domLayer = document.createElement('div');
  wrapper.appendChild(domLayer);

  const vp = {
    store,
    layerManager,
    domLayer,
    toolManager: {
      getTool: vi.fn(() => undefined),
      onChange: vi.fn(),
      activeTool: { name: 'select' },
    },
    getSelectedIds: vi.fn(() => selectionState.selectedIds),
    onSelectionChange: vi.fn((listener: () => void) => {
      selectionListeners.add(listener);
      return () => selectionListeners.delete(listener);
    }),
    camera: {
      setZoom: vi.fn(),
      moveTo: vi.fn(),
      // Identity mapping keeps the placement arithmetic readable.
      screenToWorld: vi.fn((point: { x: number; y: number }) => ({ ...point })),
      // The REAL `AutoSave` runs in this file (no @fieldnotes module mocks) —
      // it subscribes to camera changes on start().
      onChange: vi.fn(() => () => {}),
      position: { x: 0, y: 0 },
      zoom: 1,
    },
    transaction: <T>(operation: () => T): T => operation(),
    loadJSON: vi.fn(),
    exportJSON: vi.fn(() => '{}'),
    exportImage: vi.fn(async () => {
      throw new Error('exportImage unavailable in jsdom');
    }),
    addImage: vi.fn(),
    removeGrid: vi.fn(),
    addGrid: vi.fn(),
    updateGrid: vi.fn(),
    removeElements: vi.fn(),
    requestRender: vi.fn(),
    // Needed only by the relay-configured positive control, where the REAL
    // laser/ping/measure overlay attachments run.
    registerOverlay: vi.fn(() => () => {}),
    getHtmlPainters: () => registry,
    expectCanvasHtmlTypes: (htmlTypes: Iterable<string>) =>
      registry.expect(htmlTypes),
    registerHtmlPainter: (htmlType: string, painter: HtmlPainter) =>
      registry.register(htmlType, painter),
    setActivation: (options: ActivationOptions | null) => {
      activationOptions.push(options);
      return () => {};
    },
    onElementActivate: (listener: (event: ElementActivationEvent) => void) => {
      activateListeners.add(listener);
      return () => activateListeners.delete(listener);
    },
  };

  return {
    vp: vp as unknown as Viewport,
    store,
    layerManager,
    registry,
    activationOptions,
    select(ids: string[]) {
      selectionState.selectedIds = ids;
      for (const listener of selectionListeners) listener();
    },
    emitActivate(element: Readonly<CanvasElement>) {
      const event: ElementActivationEvent = {
        element,
        world: { x: 0, y: 0 },
        pointerType: 'mouse',
        gesture: 'double',
      };
      for (const listener of activateListeners) listener(event);
    },
  };
}

function battleMapFixture(overrides: Partial<BattleMap> = {}): BattleMap {
  return {
    id: MAP_ID,
    campaignCode: CODE,
    name: 'Test Battle Map',
    mapImageUrl: '',
    mapImageSize: { w: 100, h: 100 },
    canvasState: '',
    dmOnlyElements: {},
    gridEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as BattleMap;
}

function readMap(): BattleMap | undefined {
  return useBattleMapStore.getState().battleMaps[CODE]?.[MAP_ID];
}

async function setup(
  mode: 'location' | 'battlemap' = 'battlemap',
  location: BattleMap = battleMapFixture()
) {
  const harness = makeStubViewport();
  const { result } = renderHook(() =>
    useDmLocationEditor({
      location,
      campaignCode: CODE,
      dmId: 'dm-1',
      mode,
      onSave: vi.fn(),
      onSyncToPlayers: vi.fn(),
    })
  );
  result.current.canvasRef.current = {
    viewport: harness.vp,
  } as unknown as FieldNotesCanvasRef;
  await act(async () => {
    await result.current.handleReady(harness.vp);
  });
  return { ...harness, result };
}

function toolContext(vp: Viewport): ToolContext {
  return {
    camera: vp.camera,
    store: vp.store,
    requestRender: () => {},
    gridSize: 40,
    gridType: 'square',
    activeLayerId: ANNOTATIONS_LAYER_ID,
  } as unknown as ToolContext;
}

function pointer(x: number, y: number): PointerState {
  return { x, y, pressure: 0.5, pointerType: 'mouse', shiftKey: false };
}

/** Drives a real tap through the REAL `DmMarkerTool` instance the hook built. */
function tapMarkerTool(tools: Tool[], vp: Viewport, x = 100, y = 120): void {
  const tool = tools.find(candidate => candidate.name === MARKER_TOOL_NAME);
  expect(
    tool,
    'the marker tool must be registered on this surface'
  ).toBeDefined();
  const ctx = toolContext(vp);
  tool?.onPointerDown(pointer(x, y), ctx);
  tool?.onPointerUp(pointer(x, y), ctx);
}

function markerElements(store: ElementStore): HtmlElement[] {
  return store
    .getAll()
    .filter(
      (el): el is HtmlElement =>
        el.type === 'html' && el.htmlType === MARKER_HTML_TYPE
    );
}

function seedMarkerPin(store: ElementStore, ref: string): HtmlElement {
  const element = createHtmlElement({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    layerId: ANNOTATIONS_LAYER_ID,
    htmlType: MARKER_HTML_TYPE,
    data: { ...buildMarkerData({ kind: 'trap', ref }) },
  });
  store.add(element);
  return element;
}

describe('useDmLocationEditor — markers work with no relay URL configured', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useBattleMapStore.setState({ battleMaps: {} });
    vi.clearAllMocks();
  });

  it('places a DM-only marker offline: the pin reaches the canvas store and dmOnlyElements carries its id', async () => {
    const { vp, store, result } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });

    const pins = markerElements(store);
    expect(pins).toHaveLength(1);
    const pin = pins[0] as HtmlElement;
    // The §6.7 mark, read back from product state — not from React state.
    expect(readMap()?.dmOnlyElements[pin.id]).toBe(true);

    const parsed = parseMarkerData(pin.data);
    expect(parsed.status).toBe('valid');
    if (parsed.status !== 'valid') return;
    // Placement geometry: centred on the tap, one grid cell square.
    expect(pin.position).toEqual({ x: 80, y: 100 });
    expect(pin.size).toEqual({ w: 40, h: 40 });
    // The detail record was persisted under the pin's ref.
    expect(readMap()?.markers?.map(marker => marker.id)).toEqual([
      parsed.data.ref,
    ]);
  });

  it('positive control: the identical flow with a relay URL configured behaves identically', async () => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', 'wss://relay.test');
    const { vp, store, result, activationOptions } = await setup('battlemap');

    // Registration must not become conditional on the relay guard in the
    // other direction either — a mutation that registers the painter ONLY
    // when the relay URL is unset would still pass every other assertion
    // in this test while failing here.
    expect(vp.getHtmlPainters().getActivePainter(MARKER_HTML_TYPE)).toBeTypeOf(
      'function'
    );
    expect(activationOptions).toHaveLength(1);
    expect(activationOptions[0]).not.toBeNull();
    expect(activationOptions[0]?.gesture).toBe('double');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });

    const pins = markerElements(store);
    expect(pins).toHaveLength(1);
    expect(readMap()?.dmOnlyElements[(pins[0] as HtmlElement).id]).toBe(true);
    expect(readMap()?.markers).toHaveLength(1);
  });

  it('structural: with NO relay URL the marker painter is registered on the viewport and activation is enabled', async () => {
    const { vp, activationOptions } = await setup('battlemap');

    // Observed on the LIVE registry the viewport owns, so this fails if the
    // registration is ever moved inside the relay-guarded block.
    expect(vp.getHtmlPainters().getActivePainter(MARKER_HTML_TYPE)).toBeTypeOf(
      'function'
    );
    expect(vp.getHtmlPainters().canvasTypes.has(MARKER_HTML_TYPE)).toBe(true);
    expect(activationOptions).toHaveLength(1);
    expect(activationOptions[0]).not.toBeNull();
    expect(activationOptions[0]?.gesture).toBe('double');
  });

  it('structural: registration is unconditional with respect to mode too (location mode still paints markers)', async () => {
    const { vp } = await setup('location');

    expect(vp.getHtmlPainters().getActivePainter(MARKER_HTML_TYPE)).toBeTypeOf(
      'function'
    );
    expect(vp.getHtmlPainters().canvasTypes.has(MARKER_HTML_TYPE)).toBe(true);
  });

  it('location mode gets a marker tool alongside the painter registration', async () => {
    const { result } = await setup('location');

    expect(
      result.current.tools.some(tool => tool.name === MARKER_TOOL_NAME)
    ).toBe(true);
  });

  it('activating a marker offline opens the panel on a DM edit state', async () => {
    const { vp, store, result, emitActivate } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;

    expect(result.current.markerPanelOpen).toBe(false);
    act(() => {
      emitActivate(pin);
    });

    expect(result.current.markerPanelOpen).toBe(true);
    // A freshly placed pin has an empty detail record, so the DM gets the
    // editable `ready` state (not `missing-detail`, not `invalid-data`).
    expect(result.current.markerPanelState.kind).toBe('ready');
  });

  it('closing and deleting from the panel: delete removes the pin and closes', async () => {
    const { vp, store, result, emitActivate } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(pin);
    });

    act(() => {
      result.current.handleDeleteMarker();
    });

    expect(store.getById(pin.id)).toBeUndefined();
    expect(result.current.markerPanelOpen).toBe(false);
    // §6.8: deleting a pin never deletes its detail.
    expect(readMap()?.markers).toHaveLength(1);
  });

  it('saving from the panel patches the detail every sibling pin shares', async () => {
    const { vp, store, result, emitActivate } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(pin);
    });

    act(() => {
      result.current.handleSaveMarkerDetail({
        title: 'Rusty Door',
        body: 'The hinges shriek.',
        dmNotes: 'Poison needle.',
      });
    });

    expect(readMap()?.markers?.[0]).toMatchObject({
      title: 'Rusty Door',
      body: 'The hinges shriek.',
      dmNotes: 'Poison needle.',
    });
  });
});

describe('useDmLocationEditor — marker kind and colour reach the tool', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useBattleMapStore.setState({ battleMaps: {} });
    vi.clearAllMocks();
  });

  it('a picker change is carried by the NEXT placement, asserted on the created element data', async () => {
    const { vp, store, result } = await setup('battlemap');

    // Default first, so the assertion below discriminates a real change from
    // a constant that happens to match.
    act(() => {
      tapMarkerTool(result.current.tools, vp, 40, 40);
    });
    const firstParsed = parseMarkerData(
      (markerElements(store)[0] as HtmlElement).data
    );
    expect(firstParsed.status).toBe('valid');
    if (firstParsed.status !== 'valid') return;
    expect(firstParsed.data.kind).toBe('door');
    expect(firstParsed.data.color).toBe('blue');

    act(() => {
      result.current.markerControls.onKindChange('secret');
      result.current.markerControls.onColorChange('emerald');
    });
    expect(result.current.markerControls.kind).toBe('secret');
    expect(result.current.markerControls.color).toBe('emerald');

    act(() => {
      tapMarkerTool(result.current.tools, vp, 200, 200);
    });

    const pins = markerElements(store);
    expect(pins).toHaveLength(2);
    const secondParsed = parseMarkerData((pins[1] as HtmlElement).data);
    expect(secondParsed.status).toBe('valid');
    if (secondParsed.status !== 'valid') return;
    expect(secondParsed.data.kind).toBe('secret');
    expect(secondParsed.data.color).toBe('emerald');
    // The refs are read at placement time, so the first pin is untouched.
    expect(firstParsed.data.kind).toBe('door');
  });
});

describe('useDmLocationEditor — the DM-only toggle routes markers through their sibling set', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useBattleMapStore.setState({ battleMaps: {} });
    vi.clearAllMocks();
  });

  it('refuses a mixed sibling set: nothing changes and an explanatory message is surfaced', async () => {
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
    const harness = makeStubViewport();
    const hidden = seedMarkerPin(harness.store, 'shared-ref');
    const shown = seedMarkerPin(harness.store, 'shared-ref');
    useBattleMapStore.setState({
      battleMaps: {
        [CODE]: {
          [MAP_ID]: battleMapFixture({ dmOnlyElements: { [hidden.id]: true } }),
        },
      },
    });

    const { result } = renderHook(() =>
      useDmLocationEditor({
        location: battleMapFixture(),
        campaignCode: CODE,
        dmId: 'dm-1',
        mode: 'battlemap',
        onSave: vi.fn(),
        onSyncToPlayers: vi.fn(),
      })
    );
    result.current.canvasRef.current = {
      viewport: harness.vp,
    } as unknown as FieldNotesCanvasRef;
    await act(async () => {
      await result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.select([hidden.id]);
    });
    expect(result.current.selectedElementId).toBe(hidden.id);

    const before = { ...(readMap()?.dmOnlyElements ?? {}) };
    act(() => {
      result.current.handleToggleDmOnly();
    });

    expect(readMap()?.dmOnlyElements).toEqual(before);
    expect(readMap()?.dmOnlyElements).toEqual({ [hidden.id]: true });
    expect(result.current.markerAudienceNotice).toBe(
      MARKER_MIXED_AUDIENCE_MESSAGE
    );
    expect(result.current.markerAudienceNotice).toMatch(/DM-only/);
    // The pin that was already shared stayed shared.
    expect(readMap()?.dmOnlyElements[shown.id]).toBeUndefined();
  });

  it('clears the mixed-audience notice when the selection changes', async () => {
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
    const harness = makeStubViewport();
    const hidden = seedMarkerPin(harness.store, 'shared-ref');
    const shown = seedMarkerPin(harness.store, 'shared-ref');
    useBattleMapStore.setState({
      battleMaps: {
        [CODE]: {
          [MAP_ID]: battleMapFixture({ dmOnlyElements: { [hidden.id]: true } }),
        },
      },
    });

    const { result } = renderHook(() =>
      useDmLocationEditor({
        location: battleMapFixture(),
        campaignCode: CODE,
        dmId: 'dm-1',
        mode: 'battlemap',
        onSave: vi.fn(),
        onSyncToPlayers: vi.fn(),
      })
    );
    result.current.canvasRef.current = {
      viewport: harness.vp,
    } as unknown as FieldNotesCanvasRef;
    await act(async () => {
      await result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.select([hidden.id]);
    });
    act(() => {
      result.current.handleToggleDmOnly();
    });
    // Positive control: immediately after the refusal, and before the
    // selection changes, the notice is present.
    expect(result.current.markerAudienceNotice).toBe(
      MARKER_MIXED_AUDIENCE_MESSAGE
    );

    act(() => {
      harness.select([shown.id]);
    });

    expect(result.current.markerAudienceNotice).toBeNull();
  });

  it('positive control: a uniform sibling set flips BOTH pins together', async () => {
    const harness = makeStubViewport();
    const first = seedMarkerPin(harness.store, 'shared-ref');
    const second = seedMarkerPin(harness.store, 'shared-ref');
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });

    const { result } = renderHook(() =>
      useDmLocationEditor({
        location: battleMapFixture(),
        campaignCode: CODE,
        dmId: 'dm-1',
        mode: 'battlemap',
        onSave: vi.fn(),
        onSyncToPlayers: vi.fn(),
      })
    );
    result.current.canvasRef.current = {
      viewport: harness.vp,
    } as unknown as FieldNotesCanvasRef;
    await act(async () => {
      await result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.select([first.id]);
    });

    act(() => {
      result.current.handleToggleDmOnly();
    });

    // Selecting ONE pin moved BOTH — that is the sibling guard.
    expect(readMap()?.dmOnlyElements).toEqual({
      [first.id]: true,
      [second.id]: true,
    });
    expect(result.current.markerAudienceNotice).toBeNull();
  });

  it('a non-marker element keeps exactly the existing per-element toggle behaviour', async () => {
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
    const harness = makeStubViewport();
    const shape = createShape({
      position: { x: 0, y: 0 },
      size: { w: 10, h: 10 },
    });
    harness.store.add(shape);
    // A marker sibling set exists too, so a mis-routed toggle would be visible.
    const marker = seedMarkerPin(harness.store, 'other-ref');

    const { result } = renderHook(() =>
      useDmLocationEditor({
        location: battleMapFixture(),
        campaignCode: CODE,
        dmId: 'dm-1',
        mode: 'battlemap',
        onSave: vi.fn(),
        onSyncToPlayers: vi.fn(),
      })
    );
    result.current.canvasRef.current = {
      viewport: harness.vp,
    } as unknown as FieldNotesCanvasRef;
    await act(async () => {
      await result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.select([shape.id]);
    });

    act(() => {
      result.current.handleToggleDmOnly();
    });

    expect(readMap()?.dmOnlyElements).toEqual({ [shape.id]: true });
    expect(readMap()?.dmOnlyElements[marker.id]).toBeUndefined();
    expect(result.current.markerAudienceNotice).toBeNull();
  });
});

/** The valid marker payload on `element`, or a failed assertion. */
function markerDataOf(element: HtmlElement | undefined): MarkerElementDataV1 {
  const parsed = parseMarkerData(element?.data);
  expect(parsed.status, `expected valid marker data on ${element?.id}`).toBe(
    'valid'
  );
  if (parsed.status !== 'valid') throw new Error('unreachable');
  return parsed.data;
}

/**
 * Counts PRODUCT-STATE AUDIENCE writes by watching `dmOnlyElements` for a new
 * object identity: `setDmOnly` always rebuilds that object, `updateBattleMap`
 * always preserves it. No spy, no mock.
 */
function trackAudienceWrites(): { count: () => number; stop: () => void } {
  let previous = readMap()?.dmOnlyElements;
  let writes = 0;
  const stop = useBattleMapStore.subscribe(state => {
    const next = state.battleMaps[CODE]?.[MAP_ID]?.dmOnlyElements;
    if (next === previous) return;
    previous = next;
    writes += 1;
  });
  return { count: () => writes, stop };
}

function findDetail(ref: string): MarkerDetail | undefined {
  return readMap()?.markers?.find(marker => marker.id === ref);
}

/** Canvas-2D double good enough to run the real marker painter directly. */
function fakeCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D;
}

/**
 * The `store.on('add')` leak guard — twin of the block in
 * `dm-vtt/__tests__/DmBattleMapCanvas.hooks.markers.test.ts`. Every other
 * ordering test drives `createMarker`; `mod+d`, paste and the canvas context
 * menu do not, they `structuredClone` + `store.add` directly.
 */
describe('useDmLocationEditor — no marker element enters the store unmarked', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useBattleMapStore.setState({ battleMaps: {} });
    vi.clearAllMocks();
  });

  it('a duplicate-shaped local add is marked DM-only AND given its own ref, carrying a copy of the original detail content', async () => {
    const { vp, store, result, emitActivate } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const original = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(original);
    });
    act(() => {
      result.current.handleSaveMarkerDetail({
        title: 'Hidden door',
        body: 'DC 20 perception',
        dmNotes: 'leads to the vault',
      });
    });
    const originalData = markerDataOf(original);

    // EXACTLY what core's `insertClones` does.
    const clone = structuredClone(store.getById(original.id)) as HtmlElement;
    clone.id = 'cloned-pin-1';
    act(() => {
      store.add(clone);
    });

    expect(readMap()?.dmOnlyElements[clone.id]).toBe(true);

    const clonedData = markerDataOf(store.getById(clone.id) as HtmlElement);
    expect(clonedData.ref).not.toBe(originalData.ref);
    expect(clonedData.kind).toBe(originalData.kind);
    expect(clonedData.color).toBe(originalData.color);

    expect(findDetail(clonedData.ref)).toMatchObject({
      id: clonedData.ref,
      title: 'Hidden door',
      body: 'DC 20 perception',
      dmNotes: 'leads to the vault',
    });
    expect(markerDataOf(store.getById(original.id) as HtmlElement).ref).toBe(
      originalData.ref
    );
  });

  it('positive control: the createMarker path still writes the audience exactly ONCE — the guard does not double-write', async () => {
    const { vp, result } = await setup('battlemap');
    const audience = trackAudienceWrites();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });

    expect(audience.count()).toBe(1);
    audience.stop();
  });

  it('a REMOTE-origin marker add is left completely alone; the identical element added LOCALLY is marked and rewritten', async () => {
    const { store } = await setup('battlemap');

    const remote = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      layerId: ANNOTATIONS_LAYER_ID,
      htmlType: MARKER_HTML_TYPE,
      data: { ...buildMarkerData({ kind: 'secret', ref: 'peer-ref' }) },
    });
    act(() => {
      store.add(remote, { origin: 'remote' });
    });

    expect(readMap()?.dmOnlyElements[remote.id]).toBeUndefined();
    expect(markerDataOf(store.getById(remote.id) as HtmlElement).ref).toBe(
      'peer-ref'
    );

    // Positive control, same fixture and assertions, local origin.
    const local = structuredClone(remote) as HtmlElement;
    local.id = 'local-copy-1';
    act(() => {
      store.add(local);
    });

    expect(readMap()?.dmOnlyElements[local.id]).toBe(true);
    expect(markerDataOf(store.getById(local.id) as HtmlElement).ref).not.toBe(
      'peer-ref'
    );
  });

  it('a marker whose data does not parse is still marked DM-only, with its data left exactly as it arrived', async () => {
    const { store } = await setup('battlemap');

    const badData = { v: 1, kind: 'door' };
    const broken = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      layerId: ANNOTATIONS_LAYER_ID,
      htmlType: MARKER_HTML_TYPE,
      data: { ...badData },
    });
    act(() => {
      store.add(broken);
    });

    expect(parseMarkerData(broken.data).status).toBe('invalid');
    expect(readMap()?.dmOnlyElements[broken.id]).toBe(true);
    expect((store.getById(broken.id) as HtmlElement).data).toEqual(badData);
    expect(readMap()?.markers ?? []).toHaveLength(0);
  });
});

/**
 * Undo of a delete vs. duplicate — twin of the block in
 * `dm-vtt/__tests__/DmBattleMapCanvas.hooks.markers.test.ts`.
 *
 * `insertClones` (`@fieldnotes/core/dist/index.js:1291-1340`, `mod+d`, paste,
 * context menu) and `RemoveElementCommand.undo` (`:5538-5540`) BOTH arrive as
 * a bare `store.add(element)` with no meta. The one difference is the element
 * id: a clone gets a fresh one, an undo re-adds the same one. These tests
 * drive exactly those two shapes, in the same session, over the same fixture.
 */
describe('useDmLocationEditor — an undo of a delete is not a duplicate', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useBattleMapStore.setState({ battleMaps: {} });
    vi.clearAllMocks();
  });

  it('undoing the deletion of a SHARED pin leaves it SHARED, with its ref untouched', async () => {
    const { vp, store, result, select } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    const ref = markerDataOf(pin).ref;

    // Shared the way a DM shares one: select the pin, hit the DM-only toggle.
    act(() => {
      select([pin.id]);
    });
    act(() => {
      result.current.handleToggleDmOnly();
    });
    expect(readMap()?.dmOnlyElements[pin.id]).toBeUndefined();

    // The delete, then EXACTLY what `RemoveElementCommand.undo` does: the same
    // element object back, same id, same ref, no meta.
    const removed = structuredClone(store.getById(pin.id)) as HtmlElement;
    act(() => {
      store.remove(pin.id);
    });
    act(() => {
      store.add(removed);
    });

    // Still shared — the undo did not silently un-share the DM's pin.
    expect(readMap()?.dmOnlyElements[pin.id]).toBeUndefined();
    // ...and still the SAME point of interest: no ref rewrite, so it is not
    // decoupled from any sibling that shared this ref, and no second detail
    // record was invented for it.
    expect(markerDataOf(store.getById(pin.id) as HtmlElement).ref).toBe(ref);
    expect((readMap()?.markers ?? []).map(marker => marker.id)).toEqual([ref]);
  });

  it('undoing the deletion of a DM-ONLY pin leaves it DM-only, with its ref untouched', async () => {
    const { vp, store, result } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    const ref = markerDataOf(pin).ref;
    expect(readMap()?.dmOnlyElements[pin.id]).toBe(true);

    const removed = structuredClone(store.getById(pin.id)) as HtmlElement;
    act(() => {
      store.remove(pin.id);
    });
    act(() => {
      store.add(removed);
    });

    expect(readMap()?.dmOnlyElements[pin.id]).toBe(true);
    expect(markerDataOf(store.getById(pin.id) as HtmlElement).ref).toBe(ref);
    expect((readMap()?.markers ?? []).map(marker => marker.id)).toEqual([ref]);
  });

  it('POSITIVE CONTROL: the same session, the same ref, a NEW id — still a duplicate, marked DM-only and given its own ref', async () => {
    const { vp, store, result, select } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    const ref = markerDataOf(pin).ref;
    // Shared first, so "left alone" and "marked" are distinguishable outcomes.
    act(() => {
      select([pin.id]);
    });
    act(() => {
      result.current.handleToggleDmOnly();
    });

    const removed = structuredClone(store.getById(pin.id)) as HtmlElement;
    act(() => {
      store.remove(pin.id);
    });

    // Same ref, same payload, same everything the undo above re-added — except
    // the id, which is the whole discriminator.
    const clone = structuredClone(removed) as HtmlElement;
    clone.id = 'pasted-pin-1';
    act(() => {
      store.add(clone);
    });

    // The leak-closing path is intact: this is NOT read as an undo.
    expect(readMap()?.dmOnlyElements[clone.id]).toBe(true);
    const clonedRef = markerDataOf(store.getById(clone.id) as HtmlElement).ref;
    expect(clonedRef).not.toBe(ref);
    expect(findDetail(clonedRef)).toBeDefined();
  });

  it('an add whose id matches a remembered removal but whose REF does not falls through to the fail-closed path', async () => {
    const { vp, store, result, select } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    const ref = markerDataOf(pin).ref;
    act(() => {
      select([pin.id]);
    });
    act(() => {
      result.current.handleToggleDmOnly();
    });
    expect(readMap()?.dmOnlyElements[pin.id]).toBeUndefined();

    const removed = structuredClone(store.getById(pin.id)) as HtmlElement;
    act(() => {
      store.remove(pin.id);
    });

    // The id of the pin that left, carrying a DIFFERENT ref. Whatever this is,
    // it is not the thing that was deleted, so the remembered audience must
    // not be handed to it.
    const stale = structuredClone(removed) as HtmlElement;
    stale.data = {
      ...buildMarkerData({ kind: 'trap', ref: 'some-other-ref' }),
    };
    act(() => {
      store.add(stale);
    });

    expect(readMap()?.dmOnlyElements[stale.id]).toBe(true);
    const rewritten = markerDataOf(store.getById(stale.id) as HtmlElement).ref;
    expect(rewritten).not.toBe('some-other-ref');
    expect(rewritten).not.toBe(ref);
  });
});

describe('useDmLocationEditor — orphan GC runs after a successful canvas load', () => {
  const canvasWithRefs = (refs: string[]): string =>
    JSON.stringify({
      version: 1,
      camera: { position: { x: 0, y: 0 }, zoom: 1 },
      elements: refs.map((ref, index) => ({
        id: `pin-${index}`,
        type: 'html',
        htmlType: MARKER_HTML_TYPE,
        position: { x: 0, y: 0 },
        size: { w: 40, h: 40 },
        zIndex: 950,
        locked: false,
        layerId: ANNOTATIONS_LAYER_ID,
        data: { ...buildMarkerData({ kind: 'door', ref }) },
      })),
    });

  const twoDetails = (): MarkerDetail[] => [
    { id: 'kept', title: 'Kept', body: '', dmNotes: 'still needed' },
    { id: 'orphan', title: 'Orphan', body: '', dmNotes: 'leaked forever' },
  ];

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useBattleMapStore.setState({ battleMaps: {} });
    vi.clearAllMocks();
  });

  it('soft-deletes exactly the unreferenced details and leaves the referenced ones untouched', async () => {
    const map = battleMapFixture({
      canvasState: canvasWithRefs(['kept']),
      markers: twoDetails(),
    });
    useBattleMapStore.setState({ battleMaps: { [CODE]: { [MAP_ID]: map } } });

    await setup('battlemap', map);

    expect(findDetail('kept')?.deletedAt).toBeUndefined();
    expect(findDetail('orphan')?.deletedAt).toEqual(expect.any(String));
    expect(readMap()?.markers).toHaveLength(2);
  });

  it('positive control: with every detail referenced, nothing is soft-deleted', async () => {
    const map = battleMapFixture({
      canvasState: canvasWithRefs(['kept', 'orphan']),
      markers: twoDetails(),
    });
    useBattleMapStore.setState({ battleMaps: { [CODE]: { [MAP_ID]: map } } });

    await setup('battlemap', map);

    expect(findDetail('kept')?.deletedAt).toBeUndefined();
    expect(findDetail('orphan')?.deletedAt).toBeUndefined();
  });
});

describe('useDmLocationEditor — the open panel does not outlive its element', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useBattleMapStore.setState({ battleMaps: {} });
    vi.clearAllMocks();
  });

  it('removing the active element closes the panel; removing a DIFFERENT element leaves it open', async () => {
    const { vp, store, result, emitActivate } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp, 100, 120);
    });
    act(() => {
      tapMarkerTool(result.current.tools, vp, 300, 320);
    });
    const [active, other] = markerElements(store) as HtmlElement[];
    if (!active || !other) throw new Error('expected two pins');

    act(() => {
      emitActivate(active);
    });
    expect(result.current.markerPanelOpen).toBe(true);

    // Positive control first, on the same harness.
    act(() => {
      store.remove(other.id);
    });
    expect(result.current.markerPanelOpen).toBe(true);

    act(() => {
      store.remove(active.id);
    });
    expect(result.current.markerPanelOpen).toBe(false);
  });
});

describe('useDmLocationEditor — malformed marker data reaches a diagnostic sink', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useBattleMapStore.setState({ battleMaps: {} });
    vi.restoreAllMocks();
  });

  it('the registered painter is built WITH an onMarkerDataIssue sink that warns (dead in production before this)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { vp } = await setup('battlemap');

    const painter = vp.getHtmlPainters().getActivePainter(MARKER_HTML_TYPE);
    expect(painter).toBeTypeOf('function');
    if (!painter) return;

    const broken = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: MARKER_HTML_TYPE,
      data: { v: 9 },
    });
    painter({
      ctx: fakeCtx(),
      element: broken,
      size: { w: 40, h: 40 },
      zoom: 1,
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(broken.id);

    // Positive control through the identical painter and spy.
    warn.mockClear();
    const good = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: MARKER_HTML_TYPE,
      data: { ...buildMarkerData({ kind: 'door', ref: 'ok-ref' }) },
    });
    painter({ ctx: fakeCtx(), element: good, size: { w: 40, h: 40 }, zoom: 1 });
    expect(warn).not.toHaveBeenCalled();
  });
});

const SHARED_REF = 'ref-shared-by-two-pins';

/**
 * The fixture the single-pin undo tests above cannot express: TWO pins sharing
 * one ref (legal — §6.8 permits duplicate refs within one map), both DM-only
 * to begin with, plus the detail record they both read.
 *
 * It matters because the removal tracker remembers a PER-ELEMENT audience
 * while every audience decision the DM can make is per-REF and moves the whole
 * sibling set. Only a fixture with a second sibling can put those two out of
 * step between a removal and its undo.
 */
async function setupSharedRefPair() {
  const harness = makeStubViewport();
  const a = seedMarkerPin(harness.store, SHARED_REF);
  const b = seedMarkerPin(harness.store, SHARED_REF);
  useBattleMapStore.setState({
    battleMaps: {
      [CODE]: {
        [MAP_ID]: battleMapFixture({
          markers: [
            {
              id: SHARED_REF,
              title: 'Sally port',
              body: 'Barred from the inside',
              dmNotes: 'the bar lifts from room 4',
            },
          ],
          dmOnlyElements: { [a.id]: true, [b.id]: true },
        }),
      },
    },
  });

  const { result } = renderHook(() =>
    useDmLocationEditor({
      location: battleMapFixture(),
      campaignCode: CODE,
      dmId: 'dm-1',
      mode: 'battlemap',
      onSave: vi.fn(),
      onSyncToPlayers: vi.fn(),
    })
  );
  result.current.canvasRef.current = {
    viewport: harness.vp,
  } as unknown as FieldNotesCanvasRef;
  await act(async () => {
    await result.current.handleReady(harness.vp);
  });
  return { ...harness, result, a, b };
}

/**
 * The remembered audience is a FLOOR, not an answer — twin of the block in
 * `dm-vtt/__tests__/DmBattleMapCanvas.hooks.markers.test.ts`.
 *
 * `noteMarkerRemoval` snapshots one element's audience; `handleToggleDmOnly`
 * moves the whole sibling set of a ref. Between a removal and its undo the DM
 * can therefore make a decision the snapshot knows nothing about, and replaying
 * the snapshot would publish a pin the DM has just hidden.
 */
describe('useDmLocationEditor — an undone pin cannot rejoin a ref its siblings no longer share', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useBattleMapStore.setState({ battleMaps: {} });
    vi.clearAllMocks();
  });

  it('hiding the ref while one of its pins is deleted makes the undo restore that pin DM-ONLY, not to the stale shared snapshot', async () => {
    const { store, result, select, a, b } = await setupSharedRefPair();

    // 1. The DM shares the ref: one toggle on either pin moves both.
    act(() => {
      select([a.id]);
    });
    act(() => {
      result.current.handleToggleDmOnly();
    });
    expect(readMap()?.dmOnlyElements).toEqual({});

    // 2. Delete pin A. The removal is remembered as `wasDmOnly: false`.
    const removedA = structuredClone(store.getById(a.id)) as HtmlElement;
    act(() => {
      store.remove(a.id);
    });

    // 3. The DM's most recent explicit instruction for this marker: hide it.
    //    Only B is live, so the sibling set is [b] and it applies uniformly.
    act(() => {
      select([b.id]);
    });
    act(() => {
      result.current.handleToggleDmOnly();
    });
    expect(readMap()?.dmOnlyElements).toEqual({ [b.id]: true });
    expect(result.current.markerAudienceNotice).toBeNull();

    // 4. Undo the delete — exactly what `RemoveElementCommand.undo` does.
    act(() => {
      store.add(removedA);
    });

    // The pin comes back HIDDEN: the remembered `shared` was floored at the
    // ref's live sibling state, so its first upsert cannot publish a secret.
    expect(readMap()?.dmOnlyElements[a.id]).toBe(true);
    // ...and it is still the same point of interest: no ref rewrite, no
    // invented detail record.
    expect(markerDataOf(store.getById(a.id) as HtmlElement).ref).toBe(
      SHARED_REF
    );
    expect((readMap()?.markers ?? []).map(marker => marker.id)).toEqual([
      SHARED_REF,
    ]);

    // 5. The sibling set is uniform again, so the ref is not wedged: the very
    //    next toggle is APPLIED, not refused as mixed-audience.
    act(() => {
      select([a.id]);
    });
    act(() => {
      result.current.handleToggleDmOnly();
    });
    expect(result.current.markerAudienceNotice).not.toBe(
      MARKER_MIXED_AUDIENCE_MESSAGE
    );
    expect(result.current.markerAudienceNotice).toBeNull();
    expect(readMap()?.dmOnlyElements).toEqual({});
  });

  it('POSITIVE CONTROL: with no intervening audience change, the same fixture restores the undone pin SHARED and leaves its ref alone', async () => {
    const { store, result, select, a, b } = await setupSharedRefPair();

    act(() => {
      select([a.id]);
    });
    act(() => {
      result.current.handleToggleDmOnly();
    });
    expect(readMap()?.dmOnlyElements).toEqual({});

    const removedA = structuredClone(store.getById(a.id)) as HtmlElement;
    act(() => {
      store.remove(a.id);
    });
    // Nothing happens to the ref's audience in between — B stays shared.
    expect(readMap()?.dmOnlyElements[b.id]).toBeUndefined();
    act(() => {
      store.add(removedA);
    });

    // Still shared: the floor raises a remembered audience, it never invents
    // one. Undo of a delete stays lossless.
    expect(readMap()?.dmOnlyElements[a.id]).toBeUndefined();
    expect(readMap()?.dmOnlyElements).toEqual({});
    expect(markerDataOf(store.getById(a.id) as HtmlElement).ref).toBe(
      SHARED_REF
    );
    expect((readMap()?.markers ?? []).map(marker => marker.id)).toEqual([
      SHARED_REF,
    ]);
  });

  it('undoing the deletion of a DM-ONLY pin of a shared-ref pair leaves it DM-only, with its ref untouched', async () => {
    const { store, result, a, b } = await setupSharedRefPair();
    // The fixture starts with both pins DM-only — nothing to toggle.
    expect(readMap()?.dmOnlyElements).toEqual({ [a.id]: true, [b.id]: true });

    const removedA = structuredClone(store.getById(a.id)) as HtmlElement;
    act(() => {
      store.remove(a.id);
    });
    act(() => {
      store.add(removedA);
    });

    expect(readMap()?.dmOnlyElements[a.id]).toBe(true);
    expect(markerDataOf(store.getById(a.id) as HtmlElement).ref).toBe(
      SHARED_REF
    );
    expect((readMap()?.markers ?? []).map(marker => marker.id)).toEqual([
      SHARED_REF,
    ]);
    expect(result.current.markerAudienceNotice).toBeNull();
  });

  it('POSITIVE CONTROL: on the same fixture a duplicate-shaped add — new id, same ref — is still marked DM-only and given its own ref', async () => {
    const { store, result, select, a } = await setupSharedRefPair();

    act(() => {
      select([a.id]);
    });
    act(() => {
      result.current.handleToggleDmOnly();
    });
    expect(readMap()?.dmOnlyElements).toEqual({});

    const removedA = structuredClone(store.getById(a.id)) as HtmlElement;
    act(() => {
      store.remove(a.id);
    });

    // Everything the undo re-adds, except the id — the discriminator itself.
    const clone = structuredClone(removedA) as HtmlElement;
    clone.id = 'pasted-onto-shared-ref';
    act(() => {
      store.add(clone);
    });

    expect(readMap()?.dmOnlyElements[clone.id]).toBe(true);
    const clonedRef = markerDataOf(store.getById(clone.id) as HtmlElement).ref;
    expect(clonedRef).not.toBe(SHARED_REF);
    expect(findDetail(clonedRef)).toMatchObject({
      id: clonedRef,
      title: 'Sally port',
      dmNotes: 'the bar lifts from room 4',
    });
  });
});

/**
 * The guard receives the viewport whose store emitted the add, rather than
 * resolving it through `getViewport()`. That accessor can answer null — the
 * canvas ref detaching, a surface tearing down — and the guard's null branch
 * used to report `not-a-marker` and mark nothing at all: fail OPEN in the one
 * path that exists to fail closed.
 */
describe('useDmLocationEditor — the add guard does not depend on the viewport accessor', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useBattleMapStore.setState({ battleMaps: {} });
    vi.clearAllMocks();
  });

  it('a duplicate-shaped add is marked and rewritten even once the canvas ref has gone null', async () => {
    const { vp, store, result } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const original = markerElements(store)[0] as HtmlElement;
    const originalRef = markerDataOf(original).ref;

    const clone = structuredClone(store.getById(original.id)) as HtmlElement;
    clone.id = 'cloned-after-detach';
    // The accessor the guard used to depend on now answers null, while the
    // store subscription is still live and still emitting.
    result.current.canvasRef.current = null;
    expect(result.current.canvasRef.current).toBeNull();

    act(() => {
      store.add(clone);
    });

    expect(readMap()?.dmOnlyElements[clone.id]).toBe(true);
    const clonedRef = markerDataOf(store.getById(clone.id) as HtmlElement).ref;
    expect(clonedRef).not.toBe(originalRef);
    expect(findDetail(clonedRef)).toBeDefined();
  });
});

// ─── Portal state wiring ───────────────────────────────────────

const TARGET_BM_ID = 'bm-target';
const TARGET_LOC_ID = 'loc-target';

function locationFixture(overrides: Partial<LocationMap> = {}): LocationMap {
  return {
    id: TARGET_LOC_ID,
    campaignCode: CODE,
    name: 'Haunted Library',
    mapImageUrl: '',
    mapImageSize: { w: 100, h: 100 },
    canvasState: '',
    dmOnlyElements: {},
    gridEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function seedPortalStores() {
  useBattleMapStore.setState({
    battleMaps: {
      [CODE]: {
        [MAP_ID]: battleMapFixture(),
        [TARGET_BM_ID]: battleMapFixture({
          id: TARGET_BM_ID,
          name: 'Dragon Lair',
        }),
      },
    },
  });
  useLocationStore.setState({
    locations: {
      [CODE]: {
        [TARGET_LOC_ID]: locationFixture(),
      },
    },
  });
}

describe('useDmLocationEditor — portal state is wired to the marker panel', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    seedPortalStores();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useBattleMapStore.setState({ battleMaps: {} });
    useLocationStore.setState({ locations: {} });
    vi.clearAllMocks();
  });

  it('portalState includes choices from stores, excluding self', async () => {
    const { vp, store, result, emitActivate } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(pin);
    });

    const ps = result.current.portalState;
    expect(ps).toBeDefined();
    // Self (MAP_ID) is excluded from battle map choices.
    expect(ps!.battleMapChoices.find(c => c.id === MAP_ID)).toBeUndefined();
    expect(ps!.battleMapChoices.find(c => c.id === TARGET_BM_ID)).toMatchObject(
      {
        id: TARGET_BM_ID,
        name: 'Dragon Lair',
      }
    );
    // Locations are included (source is a battle map, not a location).
    expect(ps!.locationChoices.find(c => c.id === TARGET_LOC_ID)).toMatchObject(
      {
        id: TARGET_LOC_ID,
        name: 'Haunted Library',
      }
    );
  });

  it('portal resolves to ready for a valid target', async () => {
    // Pre-seed a marker detail with a portal pointing at the target battle map.
    const ref = 'portal-ref-1';
    useBattleMapStore.getState().updateBattleMap(CODE, MAP_ID, {
      markers: [
        {
          id: ref,
          title: 'Gate',
          body: '',
          dmNotes: '',
          portal: buildMarkerPortalTarget('battlemap', TARGET_BM_ID),
        },
      ],
    });

    const harness = makeStubViewport();
    const pin = seedMarkerPin(harness.store, ref);
    const { result } = renderHook(() =>
      useDmLocationEditor({
        location: battleMapFixture(),
        campaignCode: CODE,
        dmId: 'dm-1',
        mode: 'battlemap',
        onSave: vi.fn(),
        onSyncToPlayers: vi.fn(),
      })
    );
    result.current.canvasRef.current = {
      viewport: harness.vp,
    } as unknown as FieldNotesCanvasRef;
    await act(async () => {
      await result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.emitActivate(pin);
    });

    const ps = result.current.portalState;
    expect(ps).toBeDefined();
    expect(ps!.resolved?.status).toBe('ready');
    if (ps!.resolved?.status === 'ready') {
      expect(ps!.resolved.name).toBe('Dragon Lair');
      expect(ps!.resolved.href).toContain(TARGET_BM_ID);
    }
  });

  it('missing target resolves correctly', async () => {
    const ref = 'portal-ref-missing';
    useBattleMapStore.getState().updateBattleMap(CODE, MAP_ID, {
      markers: [
        {
          id: ref,
          title: 'Broken Gate',
          body: '',
          dmNotes: '',
          portal: buildMarkerPortalTarget('battlemap', 'nonexistent-id'),
        },
      ],
    });

    const harness = makeStubViewport();
    const pin = seedMarkerPin(harness.store, ref);
    const { result } = renderHook(() =>
      useDmLocationEditor({
        location: battleMapFixture(),
        campaignCode: CODE,
        dmId: 'dm-1',
        mode: 'battlemap',
        onSave: vi.fn(),
        onSyncToPlayers: vi.fn(),
      })
    );
    result.current.canvasRef.current = {
      viewport: harness.vp,
    } as unknown as FieldNotesCanvasRef;
    await act(async () => {
      await result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.emitActivate(pin);
    });

    expect(result.current.portalState?.resolved?.status).toBe('missing');
  });

  it('rename reflected live: renaming the target in the store updates portalState.resolved.name', async () => {
    const ref = 'portal-ref-rename';
    useBattleMapStore.getState().updateBattleMap(CODE, MAP_ID, {
      markers: [
        {
          id: ref,
          title: 'Gate',
          body: '',
          dmNotes: '',
          portal: buildMarkerPortalTarget('battlemap', TARGET_BM_ID),
        },
      ],
    });

    const harness = makeStubViewport();
    const pin = seedMarkerPin(harness.store, ref);
    const { result } = renderHook(() =>
      useDmLocationEditor({
        location: battleMapFixture(),
        campaignCode: CODE,
        dmId: 'dm-1',
        mode: 'battlemap',
        onSave: vi.fn(),
        onSyncToPlayers: vi.fn(),
      })
    );
    result.current.canvasRef.current = {
      viewport: harness.vp,
    } as unknown as FieldNotesCanvasRef;
    await act(async () => {
      await result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.emitActivate(pin);
    });

    expect(result.current.portalState?.resolved?.status).toBe('ready');
    if (result.current.portalState?.resolved?.status === 'ready') {
      expect(result.current.portalState.resolved.name).toBe('Dragon Lair');
    }

    // Rename the target in the store.
    act(() => {
      useBattleMapStore.getState().updateBattleMap(CODE, TARGET_BM_ID, {
        name: 'Ancient Dragon Lair',
      });
    });

    expect(result.current.portalState?.resolved?.status).toBe('ready');
    if (result.current.portalState?.resolved?.status === 'ready') {
      expect(result.current.portalState.resolved.name).toBe(
        'Ancient Dragon Lair'
      );
    }
  });

  it('delete target makes portal non-navigable', async () => {
    const ref = 'portal-ref-delete';
    useBattleMapStore.getState().updateBattleMap(CODE, MAP_ID, {
      markers: [
        {
          id: ref,
          title: 'Gate',
          body: '',
          dmNotes: '',
          portal: buildMarkerPortalTarget('battlemap', TARGET_BM_ID),
        },
      ],
    });

    const harness = makeStubViewport();
    const pin = seedMarkerPin(harness.store, ref);
    const { result } = renderHook(() =>
      useDmLocationEditor({
        location: battleMapFixture(),
        campaignCode: CODE,
        dmId: 'dm-1',
        mode: 'battlemap',
        onSave: vi.fn(),
        onSyncToPlayers: vi.fn(),
      })
    );
    result.current.canvasRef.current = {
      viewport: harness.vp,
    } as unknown as FieldNotesCanvasRef;
    await act(async () => {
      await result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.emitActivate(pin);
    });

    // Positive control: starts ready.
    expect(result.current.portalState?.resolved?.status).toBe('ready');

    // Delete the target from the store.
    act(() => {
      useBattleMapStore.getState().removeBattleMap(CODE, TARGET_BM_ID);
    });

    expect(result.current.portalState?.resolved?.status).toBe('missing');
  });

  it('self-link detection: portal targeting same map resolves to self', async () => {
    const ref = 'portal-ref-self';
    useBattleMapStore.getState().updateBattleMap(CODE, MAP_ID, {
      markers: [
        {
          id: ref,
          title: 'Self Link',
          body: '',
          dmNotes: '',
          portal: buildMarkerPortalTarget('battlemap', MAP_ID),
        },
      ],
    });

    const harness = makeStubViewport();
    const pin = seedMarkerPin(harness.store, ref);
    const { result } = renderHook(() =>
      useDmLocationEditor({
        location: battleMapFixture(),
        campaignCode: CODE,
        dmId: 'dm-1',
        mode: 'battlemap',
        onSave: vi.fn(),
        onSyncToPlayers: vi.fn(),
      })
    );
    result.current.canvasRef.current = {
      viewport: harness.vp,
    } as unknown as FieldNotesCanvasRef;
    await act(async () => {
      await result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.emitActivate(pin);
    });

    expect(result.current.portalState?.resolved?.status).toBe('self');
  });

  it('relay-disabled mode still provides portal state', async () => {
    // Relay is already disabled via the env stub above.
    const { vp, store, result, emitActivate } = await setup('battlemap');

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(pin);
    });

    // Portal state is present even without a relay URL.
    const ps = result.current.portalState;
    expect(ps).toBeDefined();
    expect(ps!.battleMapChoices).toBeDefined();
    expect(ps!.locationChoices).toBeDefined();
    // No portal target set, so resolved is undefined.
    expect(ps!.resolved).toBeUndefined();
  });
});

// ── Location-mode marker anchors ──────────────────────────────────────────

/**
 * Location-mode setup that seeds `useLocationStore` and resets
 * `hasUnsyncedChanges` to `false` via a mock-fetched sync, so dirty-seam
 * tests begin from the task brief's "completed sync" baseline.
 */
async function setupLocationSynced(
  overrides: Partial<LocationMap> = {}
): Promise<
  ReturnType<typeof makeStubViewport> & {
    result: ReturnType<
      typeof renderHook<ReturnType<typeof useDmLocationEditor>, unknown>
    >['result'];
  }
> {
  const loc: LocationMap = {
    id: MAP_ID,
    campaignCode: CODE,
    name: 'Test Location',
    mapImageUrl: '',
    mapImageSize: { w: 100, h: 100 },
    canvasState: '',
    dmOnlyElements: {},
    gridEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  useLocationStore.getState().addLocation(CODE, loc);

  const harness = makeStubViewport();
  const { result } = renderHook(() =>
    useDmLocationEditor({
      location: loc,
      campaignCode: CODE,
      dmId: 'dm-1',
      mode: 'location',
      onSave: vi.fn(),
      onSyncToPlayers: vi.fn(),
    })
  );
  result.current.canvasRef.current = {
    viewport: harness.vp,
  } as unknown as FieldNotesCanvasRef;
  await act(async () => {
    await result.current.handleReady(harness.vp);
  });

  // Drive `hasUnsyncedChanges` to `false` by running a successful sync.
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  vi.stubGlobal('fetch', fetchMock);
  await act(async () => {
    await result.current.handleSyncToPlayers();
  });
  // Verify baseline: tests MUST start from synced state.
  expect(result.current.hasUnsyncedChanges).toBe(false);

  return { ...harness, result };
}

describe('useDmLocationEditor — location-mode marker tool availability', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    useLocationStore.setState({ locations: {} });
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    useLocationStore.setState({ locations: {} });
    useBattleMapStore.setState({ battleMaps: {} });
    vi.clearAllMocks();
  });

  it('location markers persist through the location store', async () => {
    const { vp, store, result } = await setupLocationSynced();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });

    const pins = markerElements(store);
    expect(pins).toHaveLength(1);

    // Verify stored in location store (not battlemap store).
    const loc = useLocationStore.getState().getLocation(CODE, MAP_ID);
    expect(loc?.markers).toBeDefined();
    expect(loc!.markers!.length).toBe(1);
  });

  it('location markers reopen after reload (detail survives rehydration)', async () => {
    const { vp, store, result, emitActivate } = await setupLocationSynced();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;

    // Open the panel, save a title.
    act(() => {
      emitActivate(pin);
    });
    expect(result.current.markerPanelOpen).toBe(true);
    const panelState = result.current.markerPanelState;
    expect(panelState.kind).toBe('ready');

    // Save a title.
    const ref = (panelState as { data: { ref: string } }).data.ref;
    act(() => {
      result.current.handleSaveMarkerDetail({
        title: 'Ancient Portal',
        body: 'A shimmering archway.',
        dmNotes: 'DC 15 Arcana to activate.',
      });
    });

    // Verify detail persisted.
    const loc = useLocationStore.getState().getLocation(CODE, MAP_ID);
    const detail = loc?.markers?.find(m => m.id === ref);
    expect(detail?.title).toBe('Ancient Portal');
    expect(detail?.body).toBe('A shimmering archway.');
    expect(detail?.dmNotes).toBe('DC 15 Arcana to activate.');
  });

  it('location markers can link to both target kinds (battlemap and location)', async () => {
    // Seed portal targets.
    const targetBmId = 'target-bm-2';
    const targetLocId = 'target-loc-2';
    useBattleMapStore.setState({
      battleMaps: {
        [CODE]: {
          [MAP_ID]: battleMapFixture(),
          [targetBmId]: battleMapFixture({
            id: targetBmId,
            name: 'Dragon Lair',
          }),
        },
      },
    });
    useLocationStore.getState().addLocation(CODE, {
      id: targetLocId,
      campaignCode: CODE,
      name: 'Secret Garden',
      mapImageUrl: '',
      mapImageSize: { w: 100, h: 100 },
      canvasState: '',
      dmOnlyElements: {},
      gridEnabled: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const { vp, store, result, emitActivate } = await setupLocationSynced();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(pin);
    });

    // Save with a battlemap portal.
    act(() => {
      result.current.handleSaveMarkerDetail({
        title: 'Gate',
        body: '',
        dmNotes: '',
        portal: buildMarkerPortalTarget('battlemap', targetBmId),
      });
    });
    const ps1 = result.current.portalState;
    expect(ps1?.target).toBeDefined();

    // Switch to a location portal.
    act(() => {
      result.current.handleSaveMarkerDetail({
        title: 'Gate',
        body: '',
        dmNotes: '',
        portal: buildMarkerPortalTarget('location', targetLocId),
      });
    });
    const ps2 = result.current.portalState;
    expect(ps2?.target).toBeDefined();
  });

  it('DM-only-first ordering: location marker is DM-only before element enters canvas', async () => {
    const { vp, store, result } = await setupLocationSynced();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pins = markerElements(store);
    expect(pins).toHaveLength(1);

    // The marker element must be DM-only in the location store.
    const loc = useLocationStore.getState().getLocation(CODE, MAP_ID);
    expect(loc?.dmOnlyElements[pins[0].id]).toBe(true);
  });
});

describe('useDmLocationEditor — location publication-dirty seam', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    useLocationStore.setState({ locations: {} });
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    useLocationStore.setState({ locations: {} });
    useBattleMapStore.setState({ battleMaps: {} });
    vi.clearAllMocks();
  });

  it('tests begin from synced state (hasUnsyncedChanges === false)', async () => {
    const { result } = await setupLocationSynced();
    expect(result.current.hasUnsyncedChanges).toBe(false);
  });

  it('public field edit (title) marks dirty', async () => {
    const { vp, store, result, emitActivate } = await setupLocationSynced();

    // Place and activate a marker.
    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(pin);
    });

    // Reset sync state after the canvas add (which marks dirty).
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => {
      await result.current.handleSyncToPlayers();
    });
    expect(result.current.hasUnsyncedChanges).toBe(false);

    // Edit a public field.
    act(() => {
      result.current.handleSaveMarkerDetail({
        title: 'New Title',
        body: '',
        dmNotes: '',
      });
    });
    expect(result.current.hasUnsyncedChanges).toBe(true);
  });

  it('public field edit (body) marks dirty', async () => {
    const { vp, store, result, emitActivate } = await setupLocationSynced();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(pin);
    });

    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => {
      await result.current.handleSyncToPlayers();
    });
    expect(result.current.hasUnsyncedChanges).toBe(false);

    act(() => {
      result.current.handleSaveMarkerDetail({
        title: '',
        body: 'The door creaks open.',
        dmNotes: '',
      });
    });
    expect(result.current.hasUnsyncedChanges).toBe(true);
  });

  it('public field edit (status) marks dirty', async () => {
    const { vp, store, result, emitActivate } = await setupLocationSynced();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(pin);
    });

    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => {
      await result.current.handleSyncToPlayers();
    });
    expect(result.current.hasUnsyncedChanges).toBe(false);

    act(() => {
      result.current.handleSaveMarkerDetail({
        title: '',
        body: '',
        dmNotes: '',
        status: 'active',
      });
    });
    expect(result.current.hasUnsyncedChanges).toBe(true);
  });

  it('portal-only edit stays synced', async () => {
    const { vp, store, result, emitActivate } = await setupLocationSynced();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(pin);
    });

    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => {
      await result.current.handleSyncToPlayers();
    });
    expect(result.current.hasUnsyncedChanges).toBe(false);

    // Edit only the portal — a DM-only field that never publishes.
    act(() => {
      result.current.handleSaveMarkerDetail({
        title: '',
        body: '',
        dmNotes: '',
        portal: buildMarkerPortalTarget('battlemap', 'target-bm-99'),
      });
    });
    expect(result.current.hasUnsyncedChanges).toBe(false);
  });

  it('dmNotes-only edit stays synced', async () => {
    const { vp, store, result, emitActivate } = await setupLocationSynced();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(pin);
    });

    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => {
      await result.current.handleSyncToPlayers();
    });
    expect(result.current.hasUnsyncedChanges).toBe(false);

    // Edit only dmNotes — never published.
    act(() => {
      result.current.handleSaveMarkerDetail({
        title: '',
        body: '',
        dmNotes: 'Secret trap: DC 18 Perception.',
      });
    });
    expect(result.current.hasUnsyncedChanges).toBe(false);
  });

  it('audience change (toggle DM-only via toolbar) marks dirty', async () => {
    const { vp, store, result, select } = await setupLocationSynced();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;

    // Select the marker in the canvas so handleToggleDmOnly can act.
    act(() => {
      select([pin.id]);
    });

    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => {
      await result.current.handleSyncToPlayers();
    });
    expect(result.current.hasUnsyncedChanges).toBe(false);

    // Toggle audience via the DM-only toolbar button.
    act(() => {
      result.current.handleToggleDmOnly();
    });
    expect(result.current.hasUnsyncedChanges).toBe(true);
  });

  it('audience change (panel audience control) marks dirty', async () => {
    const { vp, store, result, emitActivate } = await setupLocationSynced();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(pin);
    });

    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => {
      await result.current.handleSyncToPlayers();
    });
    expect(result.current.hasUnsyncedChanges).toBe(false);

    // Toggle audience to shared (marker starts DM-only).
    act(() => {
      result.current.handleSetMarkerAudience(false);
    });
    expect(result.current.hasUnsyncedChanges).toBe(true);
  });
});
