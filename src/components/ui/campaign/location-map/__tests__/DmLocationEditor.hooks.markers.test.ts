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
import { ANNOTATIONS_LAYER_ID } from '../layerContract';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { BattleMap } from '@/types/battlemap';

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

  it('location mode gets no marker TOOL (spec §7.2) even though the painter is registered', async () => {
    const { result } = await setup('location');

    expect(
      result.current.tools.some(tool => tool.name === MARKER_TOOL_NAME)
    ).toBe(false);
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
