import { describe, expect, it } from 'vitest';

import type { EncounterCondition, EncounterEntity } from '@/types/encounter';

import {
  absorbDamage,
  applyTurnStart,
  clampHp,
  decrementConditionRounds,
  getSortedEntities,
  healHp,
  stackTempHp,
} from './combatMechanics';

function entity(
  id: string,
  initiative: number | null,
  patch: Partial<EncounterEntity> = {}
): EncounterEntity {
  return {
    id,
    type: 'monster',
    name: id,
    initiative,
    initiativeModifier: 0,
    currentHp: 10,
    maxHp: 10,
    tempHp: 0,
    armorClass: 10,
    conditions: [],
    ...patch,
  };
}

describe('store-free combat mechanics (D5 extraction)', () => {
  it('sorts by initiative desc, null last, and keeps input order on ties', () => {
    const sorted = getSortedEntities([
      entity('a', 10),
      entity('b', null),
      entity('c', 0),
      entity('d', 10),
      entity('e', 15),
    ]);
    expect(sorted.map(value => value.id)).toEqual(['e', 'a', 'd', 'c', 'b']);
  });

  it('lets lair actions lose ties and keeps summons behind their owner', () => {
    const sorted = getSortedEntities([
      entity('lair', 20, { type: 'lair' }),
      entity('summon', 25, { summonOwnerId: 'pc-1' }),
      entity('pc', 20, { type: 'player', playerCharacterId: 'pc-1' }),
    ]);
    expect(sorted.map(value => value.id)).toEqual(['pc', 'summon', 'lair']);
  });

  it('absorbs damage with temp HP first and never drops below 0', () => {
    expect(absorbDamage(10, 3, 2)).toEqual({
      currentHp: 10,
      tempHp: 1,
      remaining: 0,
    });
    expect(absorbDamage(10, 3, 5)).toEqual({
      currentHp: 8,
      tempHp: 0,
      remaining: 2,
    });
    expect(absorbDamage(4, 0, 9)).toEqual({
      currentHp: 0,
      tempHp: 0,
      remaining: 9,
    });
  });

  it('caps healing at max HP, clamps set HP, and never stacks temp HP', () => {
    expect(healHp(8, 10, 5)).toBe(10);
    expect(healHp(0, 10, 3)).toBe(3);
    expect(clampHp(15, 10)).toBe(10);
    expect(clampHp(-4, 10)).toBe(0);
    expect(stackTempHp(5, 3)).toBe(5);
    expect(stackTempHp(2, 6)).toBe(6);
  });

  it('decrements timed condition rounds and expires those reaching 0', () => {
    const conditions: EncounterCondition[] = [
      { id: 'a', name: 'Prone' },
      { id: 'b', name: 'Blessed', rounds: 2 },
      { id: 'c', name: 'Stunned', rounds: 1 },
      { id: 'd', name: 'Hasted', rounds: null },
    ];
    expect(decrementConditionRounds(conditions)).toEqual([
      { id: 'a', name: 'Prone' },
      { id: 'b', name: 'Blessed', rounds: 1 },
      { id: 'd', name: 'Hasted', rounds: null },
    ]);
  });

  it('applies turn-start resets only to the incoming entity', () => {
    const before = [
      entity('a', 10, { hasUsedReaction: true }),
      entity('b', 5, {
        hasUsedReaction: true,
        legendaryActions: { maxActions: 3, usedActions: 2, actions: [] },
        conditions: [{ id: 'x', name: 'Stunned', rounds: 1 }],
      }),
    ];
    const after = applyTurnStart(before, 1);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toMatchObject({
      hasUsedReaction: false,
      legendaryActions: { usedActions: 0 },
      conditions: [],
    });
  });
});
