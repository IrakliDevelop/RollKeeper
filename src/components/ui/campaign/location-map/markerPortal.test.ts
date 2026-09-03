import { describe, it, expect } from 'vitest';
import {
  MARKER_PORTAL_KINDS,
  MARKER_PORTAL_ID_MAX_CODE_POINTS,
  parseMarkerPortalTarget,
  buildMarkerPortalTarget,
  buildDmPortalHref,
  resolveDmPortalDestination,
  type MarkerPortalTargetV1,
  type PortalBattleMapStoreLike,
  type PortalLocationStoreLike,
} from './markerPortal';

/** Base fixture for a well-formed v1 battle-map portal target. Every
 * negative parse test mutates exactly one field off a fixture, mirroring
 * `markerData.test.ts`'s convention. */
function fixture(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    v: 1,
    kind: 'battlemap',
    id: 'map-1',
    ...overrides,
  };
}

function omit(
  payload: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const copy = { ...payload };
  delete copy[key];
  return copy;
}

describe('module constants', () => {
  it('MARKER_PORTAL_KINDS holds exactly battlemap and location', () => {
    expect(MARKER_PORTAL_KINDS).toEqual(['battlemap', 'location']);
  });

  it('MARKER_PORTAL_ID_MAX_CODE_POINTS is 200', () => {
    expect(MARKER_PORTAL_ID_MAX_CODE_POINTS).toBe(200);
  });
});

describe('parseMarkerPortalTarget — valid targets', () => {
  it('accepts a valid battlemap target', () => {
    const result = parseMarkerPortalTarget(fixture());
    expect(result).toEqual({
      status: 'valid',
      target: { v: 1, kind: 'battlemap', id: 'map-1' },
    });
  });

  it('accepts a valid location target', () => {
    const result = parseMarkerPortalTarget(
      fixture({ kind: 'location', id: 'loc-1' })
    );
    expect(result).toEqual({
      status: 'valid',
      target: { v: 1, kind: 'location', id: 'loc-1' },
    });
  });

  it('trims a valid id', () => {
    const result = parseMarkerPortalTarget(fixture({ id: '  map-1  ' }));
    expect(result).toEqual({
      status: 'valid',
      target: { v: 1, kind: 'battlemap', id: 'map-1' },
    });
  });

  it('returns a fresh object, not the caller input', () => {
    const input = fixture();
    const result = parseMarkerPortalTarget(input);
    if (result.status !== 'valid') throw new Error('expected valid');
    expect(result.target).not.toBe(input);
    expect(result.target).toEqual({ v: 1, kind: 'battlemap', id: 'map-1' });
  });

  it('does not mutate the caller input', () => {
    const input = fixture();
    const frozen = Object.freeze({ ...input });
    expect(() => parseMarkerPortalTarget(frozen)).not.toThrow();
    expect(frozen).toEqual(fixture());
  });

  it('ignores unknown extra fields on the input', () => {
    const result = parseMarkerPortalTarget(
      fixture({ name: 'Sneaky Cave', href: '/evil' })
    );
    expect(result).toEqual({
      status: 'valid',
      target: { v: 1, kind: 'battlemap', id: 'map-1' },
    });
    if (result.status === 'valid') {
      expect(result.target).not.toHaveProperty('name');
      expect(result.target).not.toHaveProperty('href');
    }
  });

  it('caps a 200-code-point id unchanged (positive control)', () => {
    const id = 'a'.repeat(200);
    const result = parseMarkerPortalTarget(fixture({ id }));
    expect(result).toEqual({
      status: 'valid',
      target: { v: 1, kind: 'battlemap', id },
    });
  });
});

describe('parseMarkerPortalTarget — id rule', () => {
  it('rejects a blank (whitespace-only) id', () => {
    const result = parseMarkerPortalTarget(fixture({ id: '   ' }));
    expect(result.status).toBe('invalid');
  });

  it('rejects an empty string id', () => {
    const result = parseMarkerPortalTarget(fixture({ id: '' }));
    expect(result.status).toBe('invalid');
  });

  it('rejects a non-string id', () => {
    const result = parseMarkerPortalTarget(fixture({ id: 42 }));
    expect(result.status).toBe('invalid');
  });

  it('rejects a missing id', () => {
    const result = parseMarkerPortalTarget(omit(fixture(), 'id'));
    expect(result.status).toBe('invalid');
  });

  it('caps a 201-code-point id to exactly 200 code points', () => {
    const id = 'a'.repeat(201);
    const expected = 'a'.repeat(200);
    const result = parseMarkerPortalTarget(fixture({ id }));
    expect(result).toEqual({
      status: 'valid',
      target: { v: 1, kind: 'battlemap', id: expected },
    });
  });

  it('caps a 300-code-point astral-plane id to exactly 200 code points', () => {
    const id = '😀'.repeat(300); // 300 code points, 600 UTF-16 units
    const expected = '😀'.repeat(200);
    const result = parseMarkerPortalTarget(fixture({ id }));
    expect(result).toEqual({
      status: 'valid',
      target: { v: 1, kind: 'battlemap', id: expected },
    });
  });
});

describe('parseMarkerPortalTarget — kind rule', () => {
  it('rejects an unknown kind', () => {
    const result = parseMarkerPortalTarget(fixture({ kind: 'dungeon' }));
    expect(result.status).toBe('invalid');
  });

  it('rejects a missing kind', () => {
    const result = parseMarkerPortalTarget(omit(fixture(), 'kind'));
    expect(result.status).toBe('invalid');
  });

  it('rejects a non-string kind', () => {
    const result = parseMarkerPortalTarget(fixture({ kind: 7 }));
    expect(result.status).toBe('invalid');
  });
});

describe('parseMarkerPortalTarget — version rule', () => {
  it('treats v > 1 as unsupported and reports the version', () => {
    const result = parseMarkerPortalTarget(fixture({ v: 2 }));
    expect(result).toEqual({ status: 'unsupported', version: 2 });
  });

  it('rejects a missing version', () => {
    const result = parseMarkerPortalTarget(omit(fixture(), 'v'));
    expect(result.status).toBe('invalid');
  });

  it('rejects a non-integer version', () => {
    const result = parseMarkerPortalTarget(fixture({ v: 1.5 }));
    expect(result.status).toBe('invalid');
  });

  it('rejects v: 0', () => {
    const result = parseMarkerPortalTarget(fixture({ v: 0 }));
    expect(result.status).toBe('invalid');
  });
});

describe('parseMarkerPortalTarget — non-record input', () => {
  it('rejects null', () => {
    expect(parseMarkerPortalTarget(null).status).toBe('invalid');
  });

  it('rejects an array', () => {
    expect(parseMarkerPortalTarget([1, 2, 3]).status).toBe('invalid');
  });

  it('rejects a string', () => {
    expect(parseMarkerPortalTarget('battlemap:map-1').status).toBe('invalid');
  });

  it('rejects a number', () => {
    expect(parseMarkerPortalTarget(1).status).toBe('invalid');
  });

  it('rejects undefined', () => {
    expect(parseMarkerPortalTarget(undefined).status).toBe('invalid');
  });
});

describe('buildMarkerPortalTarget', () => {
  it('constructs a v1 battlemap target', () => {
    expect(buildMarkerPortalTarget('battlemap', 'map-1')).toEqual({
      v: 1,
      kind: 'battlemap',
      id: 'map-1',
    });
  });

  it('constructs a v1 location target', () => {
    expect(buildMarkerPortalTarget('location', 'loc-1')).toEqual({
      v: 1,
      kind: 'location',
      id: 'loc-1',
    });
  });

  it('round-trips through parseMarkerPortalTarget as valid', () => {
    const built = buildMarkerPortalTarget('location', 'loc-9');
    expect(parseMarkerPortalTarget(built)).toEqual({
      status: 'valid',
      target: built,
    });
  });
});

describe('buildDmPortalHref', () => {
  it('builds a battlemap href', () => {
    const href = buildDmPortalHref('ABCD', {
      v: 1,
      kind: 'battlemap',
      id: 'map-1',
    });
    expect(href).toBe('/dm/campaign/ABCD/battlemaps/map-1');
  });

  it('builds a location href', () => {
    const href = buildDmPortalHref('ABCD', {
      v: 1,
      kind: 'location',
      id: 'loc-1',
    });
    expect(href).toBe('/dm/campaign/ABCD/locations/loc-1');
  });

  it('percent-encodes special characters in the campaign code and id', () => {
    const href = buildDmPortalHref('camp/code?x=1', {
      v: 1,
      kind: 'location',
      id: 'a b&c/d#e',
    });
    expect(href).toBe(
      `/dm/campaign/${encodeURIComponent('camp/code?x=1')}/locations/${encodeURIComponent('a b&c/d#e')}`
    );
    // No raw reserved characters leak into the path outside their segment.
    expect(href).not.toContain('camp/code');
    expect(href).not.toContain('a b&c/d#e');
  });

  it('does not mutate the target it is given', () => {
    const target: MarkerPortalTargetV1 = {
      v: 1,
      kind: 'battlemap',
      id: 'map-1',
    };
    const frozen = Object.freeze({ ...target });
    buildDmPortalHref('ABCD', frozen);
    expect(frozen).toEqual(target);
  });
});

/** Minimal in-memory store doubles for resolution tests. */
function makeStores(overrides?: {
  battleMaps?: Record<string, Record<string, { id: string; name: string }>>;
  locations?: Record<string, Record<string, { id: string; name: string }>>;
}): {
  battleMaps: PortalBattleMapStoreLike;
  locations: PortalLocationStoreLike;
} {
  const battleMaps = overrides?.battleMaps ?? {};
  const locations = overrides?.locations ?? {};
  return {
    battleMaps: {
      getBattleMap: (campaignCode, id) => battleMaps[campaignCode]?.[id],
    },
    locations: {
      getLocation: (campaignCode, id) => locations[campaignCode]?.[id],
    },
  };
}

describe('resolveDmPortalDestination — ready', () => {
  it('resolves a battlemap target to ready with live name and href', () => {
    const stores = makeStores({
      battleMaps: { CAMP: { 'map-2': { id: 'map-2', name: 'The Ossuary' } } },
    });
    const target: MarkerPortalTargetV1 = {
      v: 1,
      kind: 'battlemap',
      id: 'map-2',
    };
    const result = resolveDmPortalDestination(
      target,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(result).toEqual({
      status: 'ready',
      href: '/dm/campaign/CAMP/battlemaps/map-2',
      name: 'The Ossuary',
    });
  });

  it('resolves a location target to ready with live name and href', () => {
    const stores = makeStores({
      locations: { CAMP: { 'loc-2': { id: 'loc-2', name: 'The Tavern' } } },
    });
    const target: MarkerPortalTargetV1 = {
      v: 1,
      kind: 'location',
      id: 'loc-2',
    };
    const result = resolveDmPortalDestination(
      target,
      'CAMP',
      'loc-1',
      'location',
      stores
    );
    expect(result).toEqual({
      status: 'ready',
      href: '/dm/campaign/CAMP/locations/loc-2',
      name: 'The Tavern',
    });
  });

  it('reflects a target rename live without the persisted target changing', () => {
    const store: Record<string, { id: string; name: string }> = {
      'map-2': { id: 'map-2', name: 'Old Name' },
    };
    const stores = makeStores({ battleMaps: { CAMP: store } });
    const target: MarkerPortalTargetV1 = {
      v: 1,
      kind: 'battlemap',
      id: 'map-2',
    };
    const frozenTarget = Object.freeze({ ...target });

    const before = resolveDmPortalDestination(
      frozenTarget,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(before).toMatchObject({ status: 'ready', name: 'Old Name' });

    store['map-2'] = { id: 'map-2', name: 'New Name' };

    const after = resolveDmPortalDestination(
      frozenTarget,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(after).toMatchObject({ status: 'ready', name: 'New Name' });

    // The persisted target itself was never rewritten.
    expect(frozenTarget).toEqual(target);
  });

  it('resolves a two-map cycle in both directions without recursion', () => {
    const stores = makeStores({
      battleMaps: {
        CAMP: {
          'map-a': { id: 'map-a', name: 'Map A' },
          'map-b': { id: 'map-b', name: 'Map B' },
        },
      },
    });
    const aToB: MarkerPortalTargetV1 = { v: 1, kind: 'battlemap', id: 'map-b' };
    const bToA: MarkerPortalTargetV1 = { v: 1, kind: 'battlemap', id: 'map-a' };

    const resultFromA = resolveDmPortalDestination(
      aToB,
      'CAMP',
      'map-a',
      'battlemap',
      stores
    );
    const resultFromB = resolveDmPortalDestination(
      bToA,
      'CAMP',
      'map-b',
      'battlemap',
      stores
    );

    expect(resultFromA).toEqual({
      status: 'ready',
      href: '/dm/campaign/CAMP/battlemaps/map-b',
      name: 'Map B',
    });
    expect(resultFromB).toEqual({
      status: 'ready',
      href: '/dm/campaign/CAMP/battlemaps/map-a',
      name: 'Map A',
    });
  });
});

describe('resolveDmPortalDestination — missing', () => {
  it('reports missing when the target id is absent from the store', () => {
    const stores = makeStores();
    const target: MarkerPortalTargetV1 = {
      v: 1,
      kind: 'battlemap',
      id: 'ghost',
    };
    const result = resolveDmPortalDestination(
      target,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(result).toEqual({ status: 'missing' });
  });

  it('reports missing when the id exists but only under the other kind', () => {
    const stores = makeStores({
      locations: {
        CAMP: { shared_id: { id: 'shared_id', name: 'A Location' } },
      },
    });
    const target: MarkerPortalTargetV1 = {
      v: 1,
      kind: 'battlemap',
      id: 'shared_id',
    };
    const result = resolveDmPortalDestination(
      target,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(result).toEqual({ status: 'missing' });
  });

  it('reports missing when the id exists but under a different campaign', () => {
    const stores = makeStores({
      battleMaps: { OTHER: { 'map-2': { id: 'map-2', name: 'Elsewhere' } } },
    });
    const target: MarkerPortalTargetV1 = {
      v: 1,
      kind: 'battlemap',
      id: 'map-2',
    };
    const result = resolveDmPortalDestination(
      target,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(result).toEqual({ status: 'missing' });
  });
});

describe('resolveDmPortalDestination — invalid / unsupported input produces no href', () => {
  it('returns invalid for a malformed target and includes no href', () => {
    const stores = makeStores();
    const result = resolveDmPortalDestination(
      { v: 1, kind: 'battlemap', id: '' },
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(result).toEqual({ status: 'invalid' });
    expect(result).not.toHaveProperty('href');
  });

  it('returns invalid for non-record input and includes no href', () => {
    const stores = makeStores();
    const result = resolveDmPortalDestination(
      'not-a-target',
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(result).toEqual({ status: 'invalid' });
    expect(result).not.toHaveProperty('href');
  });

  it('returns unsupported for a future version and includes no href', () => {
    const stores = makeStores();
    const result = resolveDmPortalDestination(
      { v: 2, kind: 'battlemap', id: 'map-2' },
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(result).toEqual({ status: 'unsupported' });
    expect(result).not.toHaveProperty('href');
  });

  it('does not mutate a frozen invalid input', () => {
    const stores = makeStores();
    const input = Object.freeze({ v: 1, kind: 'battlemap', id: '' });
    const before = { ...input };
    expect(() =>
      resolveDmPortalDestination(input, 'CAMP', 'map-1', 'battlemap', stores)
    ).not.toThrow();
    expect(input).toEqual(before);
  });
});

describe('resolveDmPortalDestination — self-link refusal', () => {
  it('refuses a target pointing at the same kind and id as the source', () => {
    const stores = makeStores({
      battleMaps: { CAMP: { 'map-1': { id: 'map-1', name: 'This Map' } } },
    });
    const target: MarkerPortalTargetV1 = {
      v: 1,
      kind: 'battlemap',
      id: 'map-1',
    };
    const result = resolveDmPortalDestination(
      target,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(result).toEqual({ status: 'self' });
  });

  it('does not treat the same id under a different kind as self', () => {
    const stores = makeStores({
      locations: {
        CAMP: { shared_id: { id: 'shared_id', name: 'A Location' } },
      },
    });
    const target: MarkerPortalTargetV1 = {
      v: 1,
      kind: 'location',
      id: 'shared_id',
    };
    const result = resolveDmPortalDestination(
      target,
      'CAMP',
      'shared_id',
      'battlemap',
      stores
    );
    expect(result).toEqual({
      status: 'ready',
      href: '/dm/campaign/CAMP/locations/shared_id',
      name: 'A Location',
    });
  });

  it('does not mutate the target or stores when refusing a self-link', () => {
    const stores = makeStores({
      battleMaps: { CAMP: { 'map-1': { id: 'map-1', name: 'This Map' } } },
    });
    const target = Object.freeze({ v: 1, kind: 'battlemap', id: 'map-1' });
    const before = { ...target };
    const result = resolveDmPortalDestination(
      target,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(result).toEqual({ status: 'self' });
    expect(target).toEqual(before);
  });
});
