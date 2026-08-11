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
import type { MarkerElementDataV1 } from '@/components/ui/campaign/location-map/markerData';
import { MARKER_ELEMENT_ZINDEX } from '@/components/ui/campaign/location-map/tokenSnap';
import { ANNOTATIONS_LAYER_ID } from '@/components/ui/campaign/location-map/layerContract';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { BattleMap, MarkerDetail } from '@/types/battlemap';

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
 * object identity. `battleMapStore.setDmOnly` always rebuilds that object (even
 * when the value is unchanged) and `updateBattleMap` always preserves it, so
 * this counts audience writes and nothing else — no spy, no mock.
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

/**
 * A canvas-2D double good enough to run the real marker painter. `rect` and
 * `clip` are not optional in general (core clips before invoking a painter);
 * here the painter is invoked directly, but they stay so this double can be
 * handed to `paintHtmlElement` unchanged.
 */
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

/**
 * The `store.on('add')` leak guard.
 *
 * Every other ordering test on this branch drives `createMarker`, which is the
 * function that OWNS the §6.7 ordering — so they prove "the ordering function
 * orders correctly", not "no marker element can enter the store unmarked".
 * `@fieldnotes/core`'s `duplicate` (`mod+d`), `paste` and the canvas context
 * menu all `structuredClone` the selected element, assign a new id, and call
 * `store.add` directly, bypassing `createMarker` entirely. These tests add
 * elements by exactly that route.
 */
describe('useDmBattleMapCanvas — no marker element enters the store unmarked', () => {
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

  it('a duplicate-shaped local add is marked DM-only AND given its own ref, carrying a copy of the original detail content', () => {
    const { vp, store, result, emitActivate } = setup();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });
    const original = markerElements(store)[0] as HtmlElement;
    act(() => {
      emitActivate(original);
    });
    act(() => {
      result.current.handleSaveMarkerDetail({
        title: 'Pit trap',
        body: 'DC 15 dex save',
        dmNotes: 'never shared',
      });
    });
    const originalData = markerDataOf(original);

    // EXACTLY what core's `insertClones` does: structuredClone, new id, same
    // everything else — including the ref — then a bare `store.add`.
    const clone = structuredClone(store.getById(original.id)) as HtmlElement;
    clone.id = 'cloned-pin-1';
    act(() => {
      store.add(clone);
    });

    // 1. The leak itself: the clone is DM-only in product state.
    expect(readMap()?.dmOnlyElements[clone.id]).toBe(true);

    // 2. The wedge: the clone owns a DIFFERENT ref, so the original's ref is
    //    not left permanently mixed-audience.
    const clonedData = markerDataOf(store.getById(clone.id) as HtmlElement);
    expect(clonedData.ref).not.toBe(originalData.ref);
    // Presentation is preserved — only the ref moved.
    expect(clonedData.kind).toBe(originalData.kind);
    expect(clonedData.color).toBe(originalData.color);

    // 3. The clone's own detail record carries the original's content.
    expect(findDetail(clonedData.ref)).toMatchObject({
      id: clonedData.ref,
      title: 'Pit trap',
      body: 'DC 15 dex save',
      dmNotes: 'never shared',
    });
    // The original is untouched by the guard.
    expect(markerDataOf(store.getById(original.id) as HtmlElement).ref).toBe(
      originalData.ref
    );
    expect(findDetail(originalData.ref)?.title).toBe('Pit trap');
  });

  it('positive control: the createMarker path still writes the audience exactly ONCE — the guard does not double-write', () => {
    const { vp, result } = setup();
    const audience = trackAudienceWrites();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });

    // One write, from §6.7 step 3. Two would mean the guard re-marked an
    // element `createMarker` had already marked.
    expect(audience.count()).toBe(1);
    audience.stop();
  });

  it('a REMOTE-origin marker add is left completely alone; the identical element added LOCALLY is marked and rewritten', () => {
    const { store } = setup();

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

    // Positive control, same fixture and same assertions: with a LOCAL
    // origin the very same shape IS marked and IS rewritten — so the
    // assertions above cannot pass because the guard is simply inert.
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

  it('a marker whose data does not parse is still marked DM-only, with its data left exactly as it arrived', () => {
    const { store } = setup();

    // `ref` missing => parseMarkerData returns `invalid`, so there is no
    // trustworthy ref to rewrite.
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
    // Fail closed: marked anyway.
    expect(readMap()?.dmOnlyElements[broken.id]).toBe(true);
    // ...but the unreadable payload is untouched, and no detail was invented.
    expect((store.getById(broken.id) as HtmlElement).data).toEqual(badData);
    expect(readMap()?.markers ?? []).toHaveLength(0);
  });

  it('a non-marker local add is ignored by the guard entirely', () => {
    const { store } = setup();
    const shape = createShape({
      position: { x: 0, y: 0 },
      size: { w: 10, h: 10 },
    });

    act(() => {
      store.add(shape);
    });

    expect(readMap()?.dmOnlyElements[shape.id]).toBeUndefined();
  });
});

describe('useDmBattleMapCanvas — markers are created in their own zIndex band', () => {
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

  it('a placed pin carries MARKER_ELEMENT_ZINDEX, asserted against the literal 950', () => {
    const { vp, store, result } = setup();

    act(() => {
      tapMarkerTool(result.current.tools, vp);
    });

    const pin = markerElements(store)[0] as HtmlElement;
    expect(pin.zIndex).toBe(MARKER_ELEMENT_ZINDEX);
    // The literal too, mirroring PlayerTokenTool.test.ts: renaming the
    // constant must not be able to silently move the band.
    expect(pin.zIndex).toBe(950);
    // Never the `createHtmlElement` default, which is what ties with the map
    // background and lets a resync bury the pin.
    expect(pin.zIndex).not.toBe(0);
  });
});

describe('useDmBattleMapCanvas — the open panel does not outlive its element', () => {
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

  it('removing the active element closes the panel; removing a DIFFERENT element leaves it open', () => {
    const { vp, store, result, emitActivate } = setup();

    act(() => {
      tapMarkerTool(result.current.tools, vp, 100, 120);
    });
    act(() => {
      tapMarkerTool(result.current.tools, vp, 300, 320);
    });
    const [active, other] = markerElements(store) as HtmlElement[];
    expect(active && other).toBeTruthy();
    if (!active || !other) return;

    act(() => {
      emitActivate(active);
    });
    expect(result.current.markerPanelOpen).toBe(true);

    // Positive control FIRST, on the same harness: an unrelated removal must
    // NOT close the panel, so the assertion below cannot be satisfied by a
    // listener that closes on every remove.
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

describe('useDmBattleMapCanvas — malformed marker data reaches a diagnostic sink', () => {
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

  it('the registered painter is built WITH an onMarkerDataIssue sink that warns (dead in production before this)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { vp } = setup();

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

    // Positive control: a VALID payload through the identical painter and
    // spy emits nothing, so the assertion above is not satisfied by a sink
    // that fires on every paint.
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

/**
 * §6.8 orphan GC. `gcOrphanMarkerDetails` shipped with no production caller at
 * all, so the soft delete never ran and detail records — `dmNotes` included —
 * accumulated in localStorage forever after their pins were deleted.
 */
describe('useDmBattleMapCanvas — orphan GC runs after a successful canvas load', () => {
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
        zIndex: MARKER_ELEMENT_ZINDEX,
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

  it('soft-deletes exactly the unreferenced details and leaves the referenced ones untouched', () => {
    useBattleMapStore.setState({
      battleMaps: {
        [CODE]: {
          [MAP_ID]: battleMapFixture({
            canvasState: canvasWithRefs(['kept']),
            markers: twoDetails(),
          }),
        },
      },
    });

    setup();

    expect(findDetail('kept')?.deletedAt).toBeUndefined();
    expect(findDetail('orphan')?.deletedAt).toEqual(expect.any(String));
    // Soft, never hard: nothing is dropped from the list.
    expect(readMap()?.markers).toHaveLength(2);
  });

  it('positive control: with every detail referenced, nothing is soft-deleted', () => {
    useBattleMapStore.setState({
      battleMaps: {
        [CODE]: {
          [MAP_ID]: battleMapFixture({
            canvasState: canvasWithRefs(['kept', 'orphan']),
            markers: twoDetails(),
          }),
        },
      },
    });

    setup();

    expect(findDetail('kept')?.deletedAt).toBeUndefined();
    expect(findDetail('orphan')?.deletedAt).toBeUndefined();
  });
});
