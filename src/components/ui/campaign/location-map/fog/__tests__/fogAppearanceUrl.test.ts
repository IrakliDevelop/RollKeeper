import { describe, expect, it } from 'vitest';
import {
  fogAppearanceRouteBase,
  playerFogAppearanceUrl,
} from '../fogAppearanceUrl';

describe('fogAppearanceRouteBase', () => {
  it('keeps the shipped battlemaps path byte-identical', () => {
    expect(fogAppearanceRouteBase('battlemap', 'CAMP01', 'bm-1')).toBe(
      '/api/campaign/CAMP01/battlemaps/bm-1/fog-appearance'
    );
  });

  it('targets the locations route for a location', () => {
    expect(fogAppearanceRouteBase('location', 'CAMP01', 'loc-1')).toBe(
      '/api/campaign/CAMP01/locations/loc-1/fog-appearance'
    );
  });

  it('encodes route segments', () => {
    expect(fogAppearanceRouteBase('location', 'CODE ONE', 'map/one')).toBe(
      '/api/campaign/CODE%20ONE/locations/map%2Fone/fog-appearance'
    );
  });
});

describe('playerFogAppearanceUrl', () => {
  it('appends the player read query', () => {
    expect(
      playerFogAppearanceUrl('location', 'CAMP01', 'loc-1', 'char a')
    ).toBe(
      '/api/campaign/CAMP01/locations/loc-1/fog-appearance?role=player&playerId=char%20a'
    );
  });
});
