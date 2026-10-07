import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElementStore,
  HtmlPainterRegistry,
  LayerManager,
  createHtmlElement,
  type Viewport,
} from '@fieldnotes/core';

import {
  MARKER_HTML_TYPE,
  buildMarkerData,
} from '@/components/ui/campaign/location-map/markerData';

import { ANNOTATIONS_LAYER_ID } from '@/components/ui/campaign/location-map/layerContract';
import {
  markerDetailsUrl,
  markerPublishRequest,
} from '@/components/ui/campaign/table/sideChannelRequests';
import type { TableSceneAdapter } from '@/lib/table/sceneAdapter';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { MarkerDetail } from '@/types/battlemap';

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
const SCENE = 'scene-1';
const CHEST_PIN = createHtmlElement({
  position: { x: 0, y: 0 },
  size: { w: 40, h: 40 },
  layerId: ANNOTATIONS_LAYER_ID,
  htmlType: MARKER_HTML_TYPE,
  data: { ...buildMarkerData({ kind: 'loot', ref: 'marker-chest' }) },
});
const CANVAS_STATE = JSON.stringify({ elements: [CHEST_PIN] });

function stubViewport(): Viewport {
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
  // The loot chest's canvas pin (an unreferenced detail would be GC'd).
  store.add(CHEST_PIN);
  const registry = new HtmlPainterRegistry();
  const wrapper = document.createElement('div');
  const domLayer = document.createElement('div');
  wrapper.appendChild(domLayer);
  return {
    store,
    layerManager,
    domLayer,
    fog: {
      on: vi.fn(() => () => {}),
      getState: vi.fn(() => null),
      getViewMode: vi.fn(() => 'off'),
      setViewMode: vi.fn(),
      setBounds: vi.fn(),
    },
    toolManager: {
      getTool: vi.fn(() => undefined),
      register: vi.fn(),
      onChange: vi.fn(),
      activeTool: { name: 'select' },
    },
    getSelectedIds: vi.fn(() => []),
    onSelectionChange: vi.fn(() => () => {}),
    camera: {
      screenToWorld: vi.fn((point: { x: number; y: number }) => point),
      onChange: vi.fn(() => () => {}),
      position: { x: 0, y: 0 },
      zoom: 1,
    },
    transaction: <T>(operation: () => T): T => operation(),
    loadJSON: vi.fn(),
    exportJSON: vi.fn(() => JSON.stringify({ elements: store.getAll() })),
    requestRender: vi.fn(),
    registerOverlay: vi.fn(() => () => {}),
    removeElements: vi.fn(),
    getHtmlPainters: () => registry,
    expectCanvasHtmlTypes: (types: Iterable<string>) => registry.expect(types),
    registerHtmlPainter: (type: string, painter: never) =>
      registry.register(type, painter),
    setActivation: () => () => {},
    onElementActivate: () => () => {},
  } as unknown as Viewport;
}

const lootMarker = (claimedQuantity = 0): MarkerDetail => ({
  id: 'marker-chest',
  title: 'Chest',
  body: '',
  dmNotes: '',
  loot: [
    {
      id: 'entry-potion',
      itemKind: 'inventory',
      item: { id: 'potion', name: 'Potion' } as never,
      quantity: 3,
      claimedQuantity,
    },
  ],
});

function tableAdapter(markers: MarkerDetail[]) {
  let current = markers;
  const listeners = new Set<() => void>();
  const setMarkers = vi.fn((next: MarkerDetail[]) => {
    current = next;
    listeners.forEach(listener => listener());
  });
  const adapter = {
    sceneId: SCENE,
    sourceMapId: 'map-original',
    subscribe: vi.fn(() => () => {}),
    resolveMovement: vi.fn(() => null),
    getBattleMap: vi.fn(() => ({
      id: SCENE,
      campaignCode: CODE,
      name: 'Adopted',
      mapImageUrl: '',
      mapImageSize: { w: 100, h: 100 },
      canvasState: CANVAS_STATE,
      dmOnlyElements: {},
      gridEnabled: false,
      linkedEncounterIds: [],
      createdAt: '2026-10-07T00:00:00.000Z',
      updatedAt: '2026-10-07T00:00:00.000Z',
      markers: current,
    })),
    updateBattleMap: vi.fn(),
    setDmOnly: vi.fn(),
    toggleDmOnly: vi.fn(),
    markerProductState: {
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getMarkers: () => current,
      setMarkers,
      getDmOnlyElements: () => ({}),
      setDmOnly: vi.fn(),
      setDmOnlyBulk: vi.fn(),
      isReadable: () => true,
    },
  } as unknown as TableSceneAdapter;
  return { adapter, setMarkers, current: () => current };
}

const props = (adapter?: TableSceneAdapter) => ({
  campaignCode: CODE,
  battleMapId: adapter ? SCENE : 'bm-legacy',
  dmId: 'dm-1',
  tokenConfigRef: { current: null },
  tokenInfoToggle: { mode: null, onCycle: vi.fn() },
  onExportError: vi.fn(),
  ...(adapter ? { tableSceneAdapter: adapter } : {}),
});

const fetchFn = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
  fetchFn.mockReset();
  fetchFn.mockImplementation(async () => Response.json({ success: true }));
  vi.stubGlobal('fetch', fetchFn);
  useBattleMapStore.setState({ battleMaps: {} });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const callsTo = (url: string, method?: string) =>
  fetchFn.mock.calls.filter(
    ([input, init]) =>
      String(input) === url &&
      (method === undefined ||
        (init as RequestInit | undefined)?.method === method)
  );

describe('Table DM side channels (PR04 P7, Q2a, C4-2)', () => {
  it('publishes markers for the scene id with the exact client request (CSRF)', async () => {
    const { adapter } = tableAdapter([lootMarker()]);
    const { result } = renderHook(() => useDmBattleMapCanvas(props(adapter)));
    act(() => result.current.handleReady(stubViewport()));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    const expected = markerPublishRequest(CODE, SCENE, {
      dmId: 'dm-1',
      markers: [],
      loot: [],
    });
    const [call] = callsTo(expected.url, 'PUT');
    expect(call).toBeDefined();
    const init = call![1] as RequestInit;
    expect(new Headers(init.headers).get('x-rollkeeper-csrf')).toBe('1');
    expect(JSON.parse(String(init.body))).toMatchObject({ dmId: 'dm-1' });
  });

  it('surfaces a refused marker publication instead of dropping it silently', async () => {
    fetchFn.mockImplementation(async () =>
      Response.json(
        { error: 'Request origin or CSRF validation failed' },
        { status: 403 }
      )
    );
    const { adapter } = tableAdapter([lootMarker()]);
    const { result } = renderHook(() => useDmBattleMapCanvas(props(adapter)));
    act(() => result.current.handleReady(stubViewport()));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current.markerShareNotice).toBe(
      'Markers not shared with players'
    );
  });

  it('polls claims every 10 s and writes them back only through the scene repository', async () => {
    const { adapter, setMarkers, current } = tableAdapter([lootMarker()]);
    const claimUrl = markerDetailsUrl(CODE, SCENE, {
      role: 'dm',
      dmId: 'dm-1',
    });
    fetchFn.mockImplementation(async (input: RequestInfo | URL) =>
      String(input) === claimUrl
        ? Response.json({
            markers: [
              {
                id: 'marker-chest',
                title: 'Chest',
                body: '',
                loot: [
                  {
                    id: 'entry-potion',
                    name: 'Potion',
                    itemKind: 'inventory',
                    quantity: 3,
                    remainingQuantity: 1,
                  },
                ],
              },
            ],
          })
        : Response.json({ success: true })
    );
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const legacyStore = useBattleMapStore.getState();
    const { result, unmount } = renderHook(() =>
      useDmBattleMapCanvas(props(adapter))
    );
    act(() => result.current.handleReady(stubViewport()));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchFn.mock.calls.map(([url]) => String(url))).toContain(claimUrl);
    expect(callsTo(claimUrl).length).toBe(1);
    expect(setMarkers).toHaveBeenCalled();
    expect(current()[0]!.loot![0]!.claimedQuantity).toBe(2);
    expect(useBattleMapStore.getState()).toBe(legacyStore);
    expect(
      storage.mock.calls.filter(([key]) => String(key).includes('battlemap'))
    ).toEqual([]);
    // Paused while hidden, refreshed on visibility.
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(callsTo(claimUrl).length).toBe(1);
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(callsTo(claimUrl).length).toBe(2);
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(callsTo(claimUrl).length).toBe(2);
  });

  it('does not poll a scene without loot markers, and never polls legacy maps', async () => {
    const { adapter } = tableAdapter([{ ...lootMarker(), loot: [] }]);
    const { result } = renderHook(() => useDmBattleMapCanvas(props(adapter)));
    act(() => result.current.handleReady(stubViewport()));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(
      fetchFn.mock.calls.filter(([url]) => String(url).includes('/markers?'))
    ).toEqual([]);
  });
});
