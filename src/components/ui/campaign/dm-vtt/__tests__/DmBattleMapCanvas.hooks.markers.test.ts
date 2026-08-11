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

import { MARKER_TOOL_NAME } from '@/components/ui/campaign/location-map/DmMarkerTool';
import { MARKER_MIXED_AUDIENCE_MESSAGE } from '@/components/ui/campaign/location-map/markerAudienceCopy';
import {
  MARKER_HTML_TYPE,
  buildMarkerData,
  parseMarkerData,
} from '@/components/ui/campaign/location-map/markerData';
import { ANNOTATIONS_LAYER_ID } from '@/components/ui/campaign/location-map/layerContract';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { BattleMap } from '@/types/battlemap';

// Only RollKeeper's own transport module is stubbed, so the relay-configured
// positive control opens no socket. Every `@fieldnotes` module — including the
// whole marker stack — runs for real (CONSTRAINTS-B: zero @fieldnotes mocks).
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

import { useDmBattleMapCanvas } from '../DmBattleMapCanvas.hooks';

const CODE = 'TEST01';
const MAP_ID = 'bm-1';

/** See the twin in `DmLocationEditor.hooks.markers.test.ts` — real SDK store,
 *  layer manager and painter registry, so the registry assertions observe
 *  actual SDK state rather than a spy the test itself wired up. */
function makeStubViewport() {
  const store = new ElementStore();
  const layerManager = new LayerManager(store);
  layerManager.addLayerDirect({
    id: ANNOTATIONS_LAYER_ID,
    name: 'Annotations',
    visible: true,
    locked: false,
    order: 100,
    opacity: 1,
  });
  layerManager.setActiveLayer(ANNOTATIONS_LAYER_ID);
  const registry = new HtmlPainterRegistry();

  const selectionState = { selectedIds: [] as string[] };
  const selectionListeners = new Set<() => void>();
  const activateListeners = new Set<(event: ElementActivationEvent) => void>();
  const activationOptions: (ActivationOptions | null)[] = [];

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
      screenToWorld: vi.fn((point: { x: number; y: number }) => ({ ...point })),
      // The REAL AutoSave runs here and subscribes to camera changes.
      onChange: vi.fn(() => () => {}),
      position: { x: 0, y: 0 },
      zoom: 1,
    },
    transaction: <T>(operation: () => T): T => operation(),
    loadJSON: vi.fn(),
    exportJSON: vi.fn(() => '{}'),
    requestRender: vi.fn(),
    registerOverlay: vi.fn(() => () => {}),
    removeElements: vi.fn(),
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

function baseProps() {
  return {
    campaignCode: CODE,
    battleMapId: MAP_ID,
    dmId: 'dm-1',
    tokenConfigRef: { current: null },
    tokenInfoToggle: { mode: null, onCycle: vi.fn() },
    onExportError: vi.fn(),
  };
}

function setup() {
  const harness = makeStubViewport();
  const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));
  act(() => {
    result.current.handleReady(harness.vp);
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
    data: { ...buildMarkerData({ kind: 'loot', ref }) },
  });
  store.add(element);
  return element;
}

describe('useDmBattleMapCanvas — markers work with no relay URL configured', () => {
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

  it('places a DM-only marker offline: the pin reaches the canvas store and dmOnlyElements carries its id', () => {
    const { vp, store, result } = setup();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });

    const pins = markerElements(store);
    expect(pins).toHaveLength(1);
    const pin = pins[0] as HtmlElement;
    expect(readMap()?.dmOnlyElements[pin.id]).toBe(true);

    const parsed = parseMarkerData(pin.data);
    expect(parsed.status).toBe('valid');
    if (parsed.status !== 'valid') return;
    expect(pin.position).toEqual({ x: 80, y: 100 });
    expect(readMap()?.markers?.map(marker => marker.id)).toEqual([
      parsed.data.ref,
    ]);
  });

  it('positive control: the identical flow with a relay URL configured behaves identically', () => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', 'wss://relay.test');
    const { vp, store, result, activationOptions } = setup();

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

  it('structural: with NO relay URL the marker painter is registered on the viewport and activation is enabled', () => {
    const { vp, activationOptions } = setup();

    expect(vp.getHtmlPainters().getActivePainter(MARKER_HTML_TYPE)).toBeTypeOf(
      'function'
    );
    expect(vp.getHtmlPainters().canvasTypes.has(MARKER_HTML_TYPE)).toBe(true);
    expect(activationOptions).toHaveLength(1);
    expect(activationOptions[0]).not.toBeNull();
    expect(activationOptions[0]?.gesture).toBe('double');
  });

  it('activating a marker offline opens the panel on a DM edit state', () => {
    const { vp, store, result, emitActivate } = setup();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const pin = markerElements(store)[0] as HtmlElement;

    expect(result.current.markerPanelOpen).toBe(false);
    act(() => {
      emitActivate(pin);
    });

    expect(result.current.markerPanelOpen).toBe(true);
    expect(result.current.markerPanelState.kind).toBe('ready');
  });

  it('a picker change is carried by the NEXT placement, asserted on the created element data', () => {
    const { vp, store, result } = setup();

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
      result.current.markerControls.onKindChange('loot');
      result.current.markerControls.onColorChange('amber');
    });

    act(() => {
      tapMarkerTool(result.current.tools, vp, 200, 200);
    });

    const pins = markerElements(store);
    expect(pins).toHaveLength(2);
    const secondParsed = parseMarkerData((pins[1] as HtmlElement).data);
    expect(secondParsed.status).toBe('valid');
    if (secondParsed.status !== 'valid') return;
    expect(secondParsed.data.kind).toBe('loot');
    expect(secondParsed.data.color).toBe('amber');
    expect(firstParsed.data.kind).toBe('door');
  });
});

describe('useDmBattleMapCanvas — the DM-only toggle routes markers through their sibling set', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useBattleMapStore.setState({ battleMaps: {} });
    vi.clearAllMocks();
  });

  it('refuses a mixed sibling set: nothing changes and an explanatory message is surfaced', () => {
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

    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));
    act(() => {
      result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.select([hidden.id]);
    });
    expect(result.current.selectedElementId).toBe(hidden.id);
    expect(result.current.selectedElementIsMarker).toBe(true);

    const before = { ...(readMap()?.dmOnlyElements ?? {}) };
    act(() => {
      result.current.handleToggleSelectedDmOnly();
    });

    expect(readMap()?.dmOnlyElements).toEqual(before);
    expect(readMap()?.dmOnlyElements).toEqual({ [hidden.id]: true });
    expect(readMap()?.dmOnlyElements[shown.id]).toBeUndefined();
    expect(result.current.markerAudienceNotice).toBe(
      MARKER_MIXED_AUDIENCE_MESSAGE
    );
  });

  it('clears the mixed-audience notice when the selection changes', () => {
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

    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));
    act(() => {
      result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.select([hidden.id]);
    });
    act(() => {
      result.current.handleToggleSelectedDmOnly();
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

  it('positive control: a uniform sibling set flips BOTH pins together', () => {
    const harness = makeStubViewport();
    const first = seedMarkerPin(harness.store, 'shared-ref');
    const second = seedMarkerPin(harness.store, 'shared-ref');
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });

    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));
    act(() => {
      result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.select([first.id]);
    });

    act(() => {
      result.current.handleToggleSelectedDmOnly();
    });

    expect(readMap()?.dmOnlyElements).toEqual({
      [first.id]: true,
      [second.id]: true,
    });
    expect(result.current.markerAudienceNotice).toBeNull();
  });

  it('a non-marker element keeps exactly the existing per-element toggle behaviour', () => {
    const harness = makeStubViewport();
    const shape = createShape({
      position: { x: 0, y: 0 },
      size: { w: 10, h: 10 },
    });
    harness.store.add(shape);
    const marker = seedMarkerPin(harness.store, 'other-ref');
    useBattleMapStore.setState({
      battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
    });

    const { result } = renderHook(() => useDmBattleMapCanvas(baseProps()));
    act(() => {
      result.current.handleReady(harness.vp);
    });
    act(() => {
      harness.select([shape.id]);
    });
    expect(result.current.selectedElementIsMarker).toBe(false);

    act(() => {
      result.current.handleToggleSelectedDmOnly();
    });

    expect(readMap()?.dmOnlyElements).toEqual({ [shape.id]: true });
    expect(readMap()?.dmOnlyElements[marker.id]).toBeUndefined();
    expect(result.current.markerAudienceNotice).toBeNull();
  });
});
