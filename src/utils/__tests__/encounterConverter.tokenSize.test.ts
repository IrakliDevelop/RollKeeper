import { describe, it, expect } from 'vitest';

import {
  monsterToEncounterEntity,
  sizeCodeToTokenCells,
} from '@/utils/encounterConverter';

import type { ProcessedMonster } from '@/types/bestiary';

/** Minimal ProcessedMonster fixture — only fields monsterToEncounterEntity
 * and its helpers actually read are filled in with realistic values. */
function buildMonster(
  overrides: Partial<ProcessedMonster> = {}
): ProcessedMonster {
  return {
    id: 'goblin',
    name: 'Goblin',
    size: ['S'],
    type: 'Humanoid',
    alignment: 'Neutral Evil',
    ac: '15',
    hp: '7 (2d6)',
    speed: '30 ft.',
    str: 8,
    dex: 14,
    con: 10,
    int: 10,
    wis: 8,
    cha: 8,
    saves: '',
    skills: '',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    senses: '',
    passivePerception: 9,
    languages: 'Common, Goblin',
    cr: '1/4',
    source: 'MM',
    page: 166,
    acValue: 15,
    hpAverage: 7,
    hpFormula: '2d6',
    legendaryActionCount: 0,
    conditionImmunities: [],
    ...overrides,
  };
}

describe('sizeCodeToTokenCells', () => {
  it.each([
    ['T', 1],
    ['S', 1],
    ['M', 1],
    ['L', 2],
    ['H', 3],
    ['G', 4],
    [undefined, 1],
    ['X', 1],
  ] as const)('%s → %i', (code, cells) => {
    expect(sizeCodeToTokenCells(code)).toBe(cells);
  });
});

describe('monsterToEncounterEntity tokenSize', () => {
  it('derives tokenSize from monster.size[0]', () => {
    expect(
      monsterToEncounterEntity(buildMonster({ size: ['M'] })).tokenSize
    ).toBe(1);
    expect(
      monsterToEncounterEntity(buildMonster({ size: ['L'] })).tokenSize
    ).toBe(2);
    expect(
      monsterToEncounterEntity(buildMonster({ size: ['H'] })).tokenSize
    ).toBe(3);
    expect(
      monsterToEncounterEntity(buildMonster({ size: ['G'] })).tokenSize
    ).toBe(4);
  });
});
