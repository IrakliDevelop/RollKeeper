import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { ElementStore, createHtmlElement } from '@fieldnotes/core';
import type { HtmlElement } from '@fieldnotes/core';

import { MARKER_HTML_TYPE, buildMarkerData } from './markerData';
import type { MarkerAudienceTransition, OrphanGcResult } from './markerWrites';
import { useMarkerWrites } from './useMarkerWrites';
import type { MarkerWritesViewport } from './useMarkerWrites';

import { useBattleMapStore } from '@/store/battleMapStore';
import { useLocationStore } from '@/store/locationStore';
import type { BattleMap, MarkerDetail } from '@/types/battlemap';
import type { LocationMap } from '@/types/location';

const CODE = 'CAMP1';
const MAP_ID = 'map-1';

function battleMapFixture(overrides: Partial<BattleMap> = {}): BattleMap {
  return {
    id: MAP_ID,
    campaignCode: CODE,
    name: 'Battle map',
    mapImageUrl: 'https://example.test/bm.png',
    mapImageSize: { w: 100, h: 100 },
    canvasState: '',
    dmOnlyElements: {},
    gridEnabled: false,
    linkedEncounterIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function locationFixture(overrides: Partial<LocationMap> = {}): LocationMap {
  return {
    id: MAP_ID,
    campaignCode: CODE,
    name: 'Location',
    mapImageUrl: 'https://example.test/loc.png',
    mapImageSize: { w: 100, h: 100 },
    canvasState: '',
    dmOnlyElements: {},
    gridEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function readBattleMap(): BattleMap | undefined {
  return useBattleMapStore.getState().getBattleMap(CODE, MAP_ID);
}

function readLocation(): LocationMap | undefined {
  return useLocationStore.getState().getLocation(CODE, MAP_ID);
}

function makeViewport(): MarkerWritesViewport {
  const store = new ElementStore();
  return { store, transaction: operation => operation() };
}

const CREATE_INPUT = {
  kind: 'trap' as const,
  position: { x: 1, y: 2 },
  size: { w: 40, h: 40 },
  layerId: 'layer-1',
  title: 'Pit trap',
  body: 'DC 15 dex save',
  dmNotes: '2d6 piercing',
};

function seedSibling(viewport: MarkerWritesViewport, ref: string): HtmlElement {
  const element = createHtmlElement({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    layerId: 'layer-1',
    htmlType: MARKER_HTML_TYPE,
    data: { ...buildMarkerData({ kind: 'door', ref }) },
  });
  viewport.store.add(element);
  return element;
}

beforeEach(() => {
  useBattleMapStore.setState({
    battleMaps: { [CODE]: { [MAP_ID]: battleMapFixture() } },
  });
  useLocationStore.setState({
    locations: { [CODE]: { [MAP_ID]: locationFixture() } },
  });
});

describe('useMarkerWrites — store routing', () => {
  it('battlemap mode writes the detail and audience into useBattleMapStore only', () => {
    const viewport = makeViewport();
    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'battlemap',
        campaignCode: CODE,
        mapId: MAP_ID,
        getViewport: () => viewport,
      })
    );

    let created: { elementId: string; ref: string } | null = null;
    act(() => {
      created = result.current.createMarker(CREATE_INPUT);
    });

    const outcome = created as { elementId: string; ref: string } | null;
    expect(outcome).not.toBeNull();
    if (!outcome) return;

    expect(readBattleMap()?.markers).toEqual([
      {
        id: outcome.ref,
        title: 'Pit trap',
        body: 'DC 15 dex save',
        dmNotes: '2d6 piercing',
      },
    ]);
    expect(readBattleMap()?.dmOnlyElements).toEqual({
      [outcome.elementId]: true,
    });
    expect(viewport.store.getById(outcome.elementId)).toBeDefined();

    // …and nothing at all landed in the location store.
    expect(readLocation()?.markers).toBeUndefined();
    expect(readLocation()?.dmOnlyElements).toEqual({});
  });

  it('location mode writes the detail and audience into useLocationStore only', () => {
    const viewport = makeViewport();
    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'location',
        campaignCode: CODE,
        mapId: MAP_ID,
        getViewport: () => viewport,
      })
    );

    let created: { elementId: string; ref: string } | null = null;
    act(() => {
      created = result.current.createMarker(CREATE_INPUT);
    });

    const outcome = created as { elementId: string; ref: string } | null;
    expect(outcome).not.toBeNull();
    if (!outcome) return;

    expect(readLocation()?.markers).toEqual([
      {
        id: outcome.ref,
        title: 'Pit trap',
        body: 'DC 15 dex save',
        dmNotes: '2d6 piercing',
      },
    ]);
    expect(readLocation()?.dmOnlyElements).toEqual({
      [outcome.elementId]: true,
    });

    expect(readBattleMap()?.markers).toBeUndefined();
    expect(readBattleMap()?.dmOnlyElements).toEqual({});
  });

  it('exposes the current map markers and refreshes them after a write', () => {
    const viewport = makeViewport();
    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'battlemap',
        campaignCode: CODE,
        mapId: MAP_ID,
        getViewport: () => viewport,
      })
    );

    expect(result.current.markers).toEqual([]);

    let ref = '';
    act(() => {
      ref = result.current.createMarker(CREATE_INPUT)?.ref ?? '';
    });

    expect(result.current.markers.map(m => m.id)).toEqual([ref]);
    expect(result.current.findMarkerDetail(ref)?.title).toBe('Pit trap');
  });
});

describe('useMarkerWrites — no viewport', () => {
  it('createMarker returns null and writes nothing when getViewport() is null', () => {
    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'battlemap',
        campaignCode: CODE,
        mapId: MAP_ID,
        getViewport: () => null,
      })
    );

    let created: { elementId: string; ref: string } | null = {
      elementId: 'sentinel',
      ref: 'sentinel',
    };
    act(() => {
      created = result.current.createMarker(CREATE_INPUT);
    });

    expect(created).toBeNull();
    expect(readBattleMap()?.markers).toBeUndefined();
    expect(readBattleMap()?.dmOnlyElements).toEqual({});
  });

  it('positive control: the same input with a viewport does create the marker', () => {
    const viewport = makeViewport();
    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'battlemap',
        campaignCode: CODE,
        mapId: MAP_ID,
        getViewport: () => viewport,
      })
    );

    act(() => {
      result.current.createMarker(CREATE_INPUT);
    });

    expect(readBattleMap()?.markers).toHaveLength(1);
    expect(Object.keys(readBattleMap()?.dmOnlyElements ?? {})).toHaveLength(1);
  });

  it('setMarkerAudienceForRef refuses with no-siblings and gc still runs without a viewport', () => {
    const detail: MarkerDetail = {
      id: 'orphan',
      title: '',
      body: '',
      dmNotes: '',
    };
    useBattleMapStore.setState({
      battleMaps: {
        [CODE]: {
          [MAP_ID]: battleMapFixture({
            markers: [detail],
            canvasState: JSON.stringify({
              version: 1,
              camera: { position: { x: 0, y: 0 }, zoom: 1 },
              elements: [],
            }),
          }),
        },
      },
    });

    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'battlemap',
        campaignCode: CODE,
        mapId: MAP_ID,
        getViewport: () => null,
      })
    );

    let transition: MarkerAudienceTransition | undefined;
    act(() => {
      transition = result.current.setMarkerAudienceForRef('orphan', true);
    });
    expect(transition).toEqual({
      status: 'refused',
      reason: 'no-siblings',
      elementIds: [],
    });

    // GC reads persisted canvas state, not the viewport, so it still works.
    let gc: OrphanGcResult | undefined;
    act(() => {
      gc = result.current.gcOrphanMarkerDetails(readBattleMap()?.canvasState);
    });
    expect(gc?.status).toBe('ran');
    expect(readBattleMap()?.markers?.[0]?.deletedAt).toBeDefined();
  });
});

describe('useMarkerWrites — fails closed when the bound map is absent from the store', () => {
  // Simulates persist not yet rehydrated, a removed map, or a wrong mapId
  // passed by the surface wiring: `getBattleMap`/`getLocation` return
  // undefined even though a viewport IS mounted. `createMarker` must degrade
  // the same way it does for a null viewport, rather than let
  // `insertMarkerRecord` throw after a detail write already landed.
  const MISSING_MAP_ID = 'does-not-exist';

  it('battlemap mode: createMarker returns null and nothing reaches the canvas store', () => {
    const viewport = makeViewport();
    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'battlemap',
        campaignCode: CODE,
        mapId: MISSING_MAP_ID,
        getViewport: () => viewport,
      })
    );

    let created: { elementId: string; ref: string } | null = {
      elementId: 'sentinel',
      ref: 'sentinel',
    };
    act(() => {
      created = result.current.createMarker(CREATE_INPUT);
    });

    expect(created).toBeNull();
    expect(viewport.store.getAll()).toHaveLength(0);
    expect(
      useBattleMapStore.getState().getBattleMap(CODE, MISSING_MAP_ID)
    ).toBeUndefined();
  });

  it('location mode: createMarker returns null and nothing reaches the canvas store', () => {
    const viewport = makeViewport();
    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'location',
        campaignCode: CODE,
        mapId: MISSING_MAP_ID,
        getViewport: () => viewport,
      })
    );

    let created: { elementId: string; ref: string } | null = {
      elementId: 'sentinel',
      ref: 'sentinel',
    };
    act(() => {
      created = result.current.createMarker(CREATE_INPUT);
    });

    expect(created).toBeNull();
    expect(viewport.store.getAll()).toHaveLength(0);
    expect(
      useLocationStore.getState().getLocation(CODE, MISSING_MAP_ID)
    ).toBeUndefined();
  });
});

describe('useMarkerWrites — bulk audience', () => {
  it('lands every sibling in ONE dmOnlyElements replacement', () => {
    const viewport = makeViewport();
    const ids = [
      seedSibling(viewport, 'shared-ref').id,
      seedSibling(viewport, 'shared-ref').id,
      seedSibling(viewport, 'shared-ref').id,
    ];
    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'battlemap',
        campaignCode: CODE,
        mapId: MAP_ID,
        getViewport: () => viewport,
      })
    );

    // Count the product-state actions: one zustand emission per action. Three
    // per-element writes would notify three times.
    let dmOnlyWrites = 0;
    let previous = readBattleMap()?.dmOnlyElements;
    const unsubscribe = useBattleMapStore.subscribe(state => {
      const next = state.battleMaps[CODE]?.[MAP_ID]?.dmOnlyElements;
      if (next !== previous) {
        previous = next;
        dmOnlyWrites += 1;
      }
    });

    let transition: MarkerAudienceTransition | undefined;
    act(() => {
      transition = result.current.setMarkerAudienceForRef('shared-ref', true);
    });
    unsubscribe();

    expect(transition?.status).toBe('applied');
    expect(dmOnlyWrites).toBe(1);
    expect(readBattleMap()?.dmOnlyElements).toEqual({
      [ids[0] as string]: true,
      [ids[1] as string]: true,
      [ids[2] as string]: true,
    });
  });

  it('removes every sibling key on the way back to shared, preserving unrelated entries', () => {
    const viewport = makeViewport();
    const ids = [
      seedSibling(viewport, 'shared-ref').id,
      seedSibling(viewport, 'shared-ref').id,
    ];
    useBattleMapStore.setState({
      battleMaps: {
        [CODE]: {
          [MAP_ID]: battleMapFixture({
            dmOnlyElements: {
              [ids[0] as string]: true,
              [ids[1] as string]: true,
              'unrelated-element': true,
            },
          }),
        },
      },
    });

    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'battlemap',
        campaignCode: CODE,
        mapId: MAP_ID,
        getViewport: () => viewport,
      })
    );

    act(() => {
      result.current.setMarkerAudienceForRef('shared-ref', false);
    });

    expect(readBattleMap()?.dmOnlyElements).toEqual({
      'unrelated-element': true,
    });
  });
});

describe('useMarkerWrites — the re-emit gate is bound to the surface mode', () => {
  /**
   * The gate itself (`deps.reemitAudience !== false`) is covered in
   * `markerWrites.test.ts`, but only with the flag passed as an explicit
   * literal — so nothing there can see the BINDING in this file
   * (`const reemitAudience = mode === 'battlemap'`). These two cases observe
   * `store.update` through the hook, which is the only place that binding is
   * made, and they are a matched pair on one fixture: same siblings, same spy,
   * same call, only `mode` differs.
   */
  function renderForMode(
    mode: 'battlemap' | 'location',
    viewport: MarkerWritesViewport
  ) {
    return renderHook(() =>
      useMarkerWrites({
        mode,
        campaignCode: CODE,
        mapId: MAP_ID,
        getViewport: () => viewport,
      })
    );
  }

  it('location mode issues NO canvas re-emit — relay-less surfaces must not dirty the canvas on a pure audience change', () => {
    const viewport = makeViewport();
    seedSibling(viewport, 'shared-ref');
    seedSibling(viewport, 'shared-ref');
    const update = vi.spyOn(viewport.store, 'update');

    const { result } = renderForMode('location', viewport);

    let transition: MarkerAudienceTransition | undefined;
    act(() => {
      transition = result.current.setMarkerAudienceForRef('shared-ref', true);
    });

    // The audience itself still lands — the gate covers only the re-emit.
    expect(transition?.status).toBe('applied');
    expect(transition?.elementIds).toHaveLength(2);
    expect(update).not.toHaveBeenCalled();
  });

  it('positive control: battlemap mode re-emits once per sibling on the same fixture and spy', () => {
    const viewport = makeViewport();
    seedSibling(viewport, 'shared-ref');
    seedSibling(viewport, 'shared-ref');
    const update = vi.spyOn(viewport.store, 'update');

    const { result } = renderForMode('battlemap', viewport);

    let transition: MarkerAudienceTransition | undefined;
    act(() => {
      transition = result.current.setMarkerAudienceForRef('shared-ref', true);
    });

    expect(transition?.status).toBe('applied');
    expect(update).toHaveBeenCalledTimes(2);
    for (const id of transition?.elementIds ?? []) {
      expect(update).toHaveBeenCalledWith(id, {});
    }
  });
});

describe('useMarkerWrites — no render-time snapshots', () => {
  it('createMarker appends to the map as it is at call time, not as it was at render time', () => {
    const viewport = makeViewport();
    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'battlemap',
        campaignCode: CODE,
        mapId: MAP_ID,
        getViewport: () => viewport,
      })
    );

    const existing: MarkerDetail = {
      id: 'pre-existing',
      title: 'Written elsewhere',
      body: '',
      dmNotes: '',
    };

    // Replace the whole map object and issue the write inside the SAME act
    // block, so React has no chance to re-render in between: a hook that read
    // its markers from a render-time snapshot would drop `pre-existing`.
    act(() => {
      useBattleMapStore.setState({
        battleMaps: {
          [CODE]: {
            [MAP_ID]: battleMapFixture({
              name: 'Replaced map',
              markers: [existing],
            }),
          },
        },
      });
      result.current.createMarker(CREATE_INPUT);
    });

    const markers = readBattleMap()?.markers ?? [];
    expect(markers.map(m => m.id)[0]).toBe('pre-existing');
    expect(markers).toHaveLength(2);
    expect(readBattleMap()?.name).toBe('Replaced map');
  });

  it('editMarkerDetail patches the map as it is at call time', () => {
    const viewport = makeViewport();
    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'battlemap',
        campaignCode: CODE,
        mapId: MAP_ID,
        getViewport: () => viewport,
      })
    );

    let applied: boolean | undefined;
    act(() => {
      useBattleMapStore.setState({
        battleMaps: {
          [CODE]: {
            [MAP_ID]: battleMapFixture({
              markers: [
                { id: 'late-ref', title: 'Before', body: 'b', dmNotes: 'n' },
              ],
            }),
          },
        },
      });
      applied = result.current.editMarkerDetail('late-ref', {
        title: 'After',
      });
    });

    expect(applied).toBe(true);
    expect(readBattleMap()?.markers).toEqual([
      { id: 'late-ref', title: 'After', body: 'b', dmNotes: 'n' },
    ]);
  });
});

describe('useMarkerWrites — delete', () => {
  it('removes the pin from the canvas and keeps the detail and the DM-only entry', () => {
    const viewport = makeViewport();
    const { result } = renderHook(() =>
      useMarkerWrites({
        mode: 'battlemap',
        campaignCode: CODE,
        mapId: MAP_ID,
        getViewport: () => viewport,
      })
    );

    let created: { elementId: string; ref: string } | null = null;
    act(() => {
      created = result.current.createMarker(CREATE_INPUT);
    });
    const outcome = created as { elementId: string; ref: string } | null;
    if (!outcome) throw new Error('marker was not created');

    act(() => {
      result.current.deleteMarker(outcome.elementId);
    });

    expect(viewport.store.getById(outcome.elementId)).toBeUndefined();
    expect(readBattleMap()?.markers).toHaveLength(1);
    expect(readBattleMap()?.dmOnlyElements).toEqual({
      [outcome.elementId]: true,
    });
  });
});
