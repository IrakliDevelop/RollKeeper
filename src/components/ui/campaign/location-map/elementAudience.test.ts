import { beforeEach, describe, expect, it } from 'vitest';

import {
  isElementDmOnly,
  resolveElementAudience,
  resolveElementAudienceWithLayer,
  setElementDmOnly,
} from './elementAudience';
import { DM_AUDIENCE } from './markerData';

import { useBattleMapStore } from '@/store/battleMapStore';
import { useLocationStore } from '@/store/locationStore';
import type { BattleMap } from '@/types/battlemap';
import type { LocationMap } from '@/types/location';

const CODE = 'CAMP1';
const MAP_ID = 'map-1';

function battleMapFixture(overrides: Partial<BattleMap> = {}): BattleMap {
  return {
    id: MAP_ID,
    campaignCode: CODE,
    name: 'Battle map',
    mapImageUrl: '',
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

function seedBattleMap(map: BattleMap): void {
  useBattleMapStore.setState({ battleMaps: { [CODE]: { [MAP_ID]: map } } });
}

function seedLocation(location: LocationMap): void {
  useLocationStore.setState({ locations: { [CODE]: { [MAP_ID]: location } } });
}

beforeEach(() => {
  useBattleMapStore.setState({ battleMaps: {} });
  useLocationStore.setState({ locations: {} });
});

describe('resolveElementAudience — location mode', () => {
  it('resolves a DM-only location element to the DM audience', () => {
    seedLocation(locationFixture({ dmOnlyElements: { secret: true } }));
    expect(resolveElementAudience('location', CODE, MAP_ID, 'secret')).toBe(
      DM_AUDIENCE
    );
  });

  it('resolves an unflagged location element to public (undefined)', () => {
    seedLocation(locationFixture({ dmOnlyElements: { secret: true } }));
    expect(
      resolveElementAudience('location', CODE, MAP_ID, 'public-note')
    ).toBeUndefined();
  });

  it('FAILS CLOSED when the location record is missing, even if a battle map with the same id says public', () => {
    seedBattleMap(battleMapFixture({ dmOnlyElements: {} }));
    expect(resolveElementAudience('location', CODE, MAP_ID, 'anything')).toBe(
      DM_AUDIENCE
    );
  });

  it('FAILS CLOSED when the record has no readable dmOnlyElements map (legacy persisted record)', () => {
    seedLocation({
      ...locationFixture(),
      dmOnlyElements: undefined as unknown as Record<string, boolean>,
    });
    expect(resolveElementAudience('location', CODE, MAP_ID, 'anything')).toBe(
      DM_AUDIENCE
    );
  });

  it('never consults the battle-map store: a battle-map flag does not hide a public location element', () => {
    seedBattleMap(battleMapFixture({ dmOnlyElements: { shared: true } }));
    seedLocation(locationFixture({ dmOnlyElements: {} }));
    expect(
      resolveElementAudience('location', CODE, MAP_ID, 'shared')
    ).toBeUndefined();
  });

  it('reads LIVE: a flag written after the first call is honoured by the next', () => {
    seedLocation(locationFixture());
    expect(
      resolveElementAudience('location', CODE, MAP_ID, 'late')
    ).toBeUndefined();
    useLocationStore.getState().setDmOnly(CODE, MAP_ID, 'late', true);
    expect(resolveElementAudience('location', CODE, MAP_ID, 'late')).toBe(
      DM_AUDIENCE
    );
  });
});

describe('resolveElementAudience — battlemap mode', () => {
  it('keeps the shipped behaviour for a present record', () => {
    seedBattleMap(battleMapFixture({ dmOnlyElements: { secret: true } }));
    expect(resolveElementAudience('battlemap', CODE, MAP_ID, 'secret')).toBe(
      DM_AUDIENCE
    );
    expect(
      resolveElementAudience('battlemap', CODE, MAP_ID, 'token')
    ).toBeUndefined();
  });

  it('FAILS CLOSED when the battle-map record is missing, even if a location with the same id says public', () => {
    seedLocation(locationFixture({ dmOnlyElements: {} }));
    expect(resolveElementAudience('battlemap', CODE, MAP_ID, 'anything')).toBe(
      DM_AUDIENCE
    );
  });
});

describe('isElementDmOnly', () => {
  it('mirrors resolveElementAudience, including the fail-closed case', () => {
    expect(isElementDmOnly('location', CODE, MAP_ID, 'x')).toBe(true);
    seedLocation(locationFixture({ dmOnlyElements: { x: true } }));
    expect(isElementDmOnly('location', CODE, MAP_ID, 'x')).toBe(true);
    expect(isElementDmOnly('location', CODE, MAP_ID, 'y')).toBe(false);
  });
});

describe('setElementDmOnly', () => {
  it('writes to the location store in location mode and leaves the battle-map store alone', () => {
    seedBattleMap(battleMapFixture());
    seedLocation(locationFixture());
    setElementDmOnly('location', CODE, MAP_ID, 'el-1', true);
    expect(
      useLocationStore.getState().getLocation(CODE, MAP_ID)?.dmOnlyElements
    ).toEqual({ 'el-1': true });
    expect(
      useBattleMapStore.getState().getBattleMap(CODE, MAP_ID)?.dmOnlyElements
    ).toEqual({});
  });

  it('writes to the battle-map store in battlemap mode and leaves the location store alone', () => {
    seedBattleMap(battleMapFixture());
    seedLocation(locationFixture());
    setElementDmOnly('battlemap', CODE, MAP_ID, 'el-1', true);
    expect(
      useBattleMapStore.getState().getBattleMap(CODE, MAP_ID)?.dmOnlyElements
    ).toEqual({ 'el-1': true });
    expect(
      useLocationStore.getState().getLocation(CODE, MAP_ID)?.dmOnlyElements
    ).toEqual({});
  });
});

describe('resolveElementAudienceWithLayer — layer visibility (location mode)', () => {
  const hiddenLayers = (...ids: string[]) => {
    const set = new Set(ids);
    return (layerId: string) => set.has(layerId);
  };

  it('hides an UNFLAGGED element that sits on an invisible layer', () => {
    seedLocation(locationFixture({ dmOnlyElements: {} }));
    expect(
      resolveElementAudienceWithLayer(
        'location',
        CODE,
        MAP_ID,
        { id: 'note', layerId: 'layer-secrets' },
        hiddenLayers('layer-secrets')
      )
    ).toBe(DM_AUDIENCE);
  });

  it('leaves an element on a VISIBLE layer to the existing resolver', () => {
    seedLocation(locationFixture({ dmOnlyElements: { secret: true } }));
    expect(
      resolveElementAudienceWithLayer(
        'location',
        CODE,
        MAP_ID,
        { id: 'note', layerId: 'layer-annotations' },
        hiddenLayers('layer-secrets')
      )
    ).toBeUndefined();
    expect(
      resolveElementAudienceWithLayer(
        'location',
        CODE,
        MAP_ID,
        { id: 'secret', layerId: 'layer-annotations' },
        hiddenLayers('layer-secrets')
      )
    ).toBe(DM_AUDIENCE);
  });

  it('falls through for an absent or unknown layer id (legacy elements are not blanked)', () => {
    seedLocation(locationFixture({ dmOnlyElements: {} }));
    // `layerId: ''` is what `createShape` writes when no layer is supplied.
    expect(
      resolveElementAudienceWithLayer(
        'location',
        CODE,
        MAP_ID,
        { id: 'legacy', layerId: '' },
        hiddenLayers('layer-secrets')
      )
    ).toBeUndefined();
    expect(
      resolveElementAudienceWithLayer(
        'location',
        CODE,
        MAP_ID,
        { id: 'legacy' },
        hiddenLayers('layer-secrets')
      )
    ).toBeUndefined();
    // A layer id that no longer resolves is reported "not hidden" by the
    // lookup closure; the flag resolver still answers.
    expect(
      resolveElementAudienceWithLayer(
        'location',
        CODE,
        MAP_ID,
        { id: 'legacy', layerId: 'layer-deleted' },
        hiddenLayers('layer-secrets')
      )
    ).toBeUndefined();
  });

  it('FAILS CLOSED on a missing record even when the layer is visible', () => {
    expect(
      resolveElementAudienceWithLayer(
        'location',
        CODE,
        MAP_ID,
        { id: 'anything', layerId: 'layer-annotations' },
        hiddenLayers()
      )
    ).toBe(DM_AUDIENCE);
  });

  it('never calls the layer lookup in battlemap mode: an invisible layer stays PUBLIC (unchanged product boundary)', () => {
    seedBattleMap(battleMapFixture({ dmOnlyElements: {} }));
    let asked = 0;
    const lookup = (layerId: string) => {
      asked += 1;
      return layerId === 'layer-secrets';
    };
    expect(
      resolveElementAudienceWithLayer(
        'battlemap',
        CODE,
        MAP_ID,
        { id: 'token', layerId: 'layer-secrets' },
        lookup
      )
    ).toBeUndefined();
    expect(asked).toBe(0);
  });
});
