import { describe, it, expect } from 'vitest';
import { findLinkedBattleMap, planMapLinkSwitch } from '../battleMapLinks';

import type { BattleMap } from '@/types/battlemap';

function map(id: string, linked: string[]): BattleMap {
  return {
    id,
    campaignCode: 'ABC123',
    name: `Map ${id}`,
    mapImageUrl: '',
    mapImageSize: { w: 0, h: 0 },
    canvasState: '',
    dmOnlyElements: {},
    gridEnabled: false,
    linkedEncounterIds: linked,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('findLinkedBattleMap', () => {
  it('returns the first map containing the encounter id', () => {
    const maps = [map('m1', ['other']), map('m2', ['e1']), map('m3', ['e1'])];
    expect(findLinkedBattleMap(maps, 'e1')?.id).toBe('m2');
  });

  it('returns undefined when no map links the encounter', () => {
    expect(findLinkedBattleMap([map('m1', [])], 'e1')).toBeUndefined();
  });
});

describe('planMapLinkSwitch', () => {
  it('links only, when the encounter has no current map', () => {
    expect(planMapLinkSwitch(null, 'm2')).toEqual({
      linkTo: 'm2',
      unlinkFrom: null,
    });
  });

  it('links the new and unlinks the old on a switch', () => {
    expect(planMapLinkSwitch('m1', 'm2')).toEqual({
      linkTo: 'm2',
      unlinkFrom: 'm1',
    });
  });

  it('plans no writes when selecting the current map', () => {
    expect(planMapLinkSwitch('m1', 'm1')).toEqual({
      linkTo: null,
      unlinkFrom: null,
    });
  });
});
