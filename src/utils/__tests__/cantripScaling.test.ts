import { describe, it, expect } from 'vitest';

import {
  extractCantripScaling,
  getScaledSpellDamage,
  getCantripUpgrades,
  resolveDamageScalingOnEdit,
} from '@/utils/cantripScaling';
import type { SpellScalingLevelDice } from '@/types/spells';
import type { Spell } from '@/types/character';

const SHOCKING_GRASP: SpellScalingLevelDice = {
  label: 'Lightning damage',
  scaling: { '1': '1d8', '5': '2d8', '11': '3d8', '17': '4d8' },
};

const TOLL_THE_DEAD: SpellScalingLevelDice[] = [
  {
    label: 'Necrotic damage',
    scaling: { '1': '1d8', '5': '2d8', '11': '3d8', '17': '4d8' },
  },
  {
    label: 'Necrotic damage to wounded creature',
    scaling: { '1': '1d12', '5': '2d12', '11': '3d12', '17': '4d12' },
  },
];

// Real shape from spells-tce.json: first track is formula placeholders, second
// is plain dice with NO level-1 row.
const GREEN_FLAME_BLADE: SpellScalingLevelDice[] = [
  {
    label: 'fire damage to secondary creature',
    scaling: {
      '1': '{{spellcasting_mod}}',
      '5': '1d8 + {{spellcasting_mod}}',
      '11': '2d8 + {{spellcasting_mod}}',
      '17': '3d8 + {{spellcasting_mod}}',
    },
  },
  {
    label: 'fire damage on hit',
    scaling: { '5': '1d8', '11': '2d8', '17': '3d8' },
  },
];

function cantrip(
  overrides: Partial<Spell>
): Pick<Spell, 'level' | 'damage' | 'damageScaling' | 'name'> {
  return { name: 'Test Cantrip', level: 0, damage: '1d8', ...overrides };
}

describe('extractCantripScaling', () => {
  it('normalizes the single-object shape to a numeric-keyed table', () => {
    expect(extractCantripScaling(SHOCKING_GRASP)).toEqual({
      1: '1d8',
      5: '2d8',
      11: '3d8',
      17: '4d8',
    });
  });

  it('picks the array track whose level-1 die matches the base damage', () => {
    expect(extractCantripScaling(TOLL_THE_DEAD, '1d12')).toEqual({
      1: '1d12',
      5: '2d12',
      11: '3d12',
      17: '4d12',
    });
  });

  it('falls back to the first track when no base damage matches', () => {
    expect(extractCantripScaling(TOLL_THE_DEAD, '2d6')).toEqual({
      1: '1d8',
      5: '2d8',
      11: '3d8',
      17: '4d8',
    });
    expect(extractCantripScaling(TOLL_THE_DEAD)).toEqual({
      1: '1d8',
      5: '2d8',
      11: '3d8',
      17: '4d8',
    });
  });

  it('drops placeholder-formula tracks and rows (Green-Flame Blade)', () => {
    // Track 1 is all {{spellcasting_mod}} templates → unusable; track 2 wins
    // even though the base damage matches neither.
    expect(extractCantripScaling(GREEN_FLAME_BLADE, '1d8')).toEqual({
      5: '1d8',
      11: '2d8',
      17: '3d8',
    });
  });

  it('returns undefined for missing or empty input', () => {
    expect(extractCantripScaling(undefined)).toBeUndefined();
    expect(extractCantripScaling([])).toBeUndefined();
    expect(extractCantripScaling({ label: 'x', scaling: {} })).toBeUndefined();
    expect(
      extractCantripScaling({
        label: 'x',
        scaling: { '1': '{{spellcasting_mod}}' },
      })
    ).toBeUndefined();
  });
});

describe('getScaledSpellDamage', () => {
  const scaled = cantrip({
    damageScaling: { 1: '1d8', 5: '2d8', 11: '3d8', 17: '4d8' },
  });

  it.each([
    [1, '1d8'],
    [4, '1d8'],
    [5, '2d8'],
    [10, '2d8'],
    [11, '3d8'],
    [16, '3d8'],
    [17, '4d8'],
    [20, '4d8'],
  ])('level %i → %s', (level, expected) => {
    expect(getScaledSpellDamage(scaled, level)).toBe(expected);
  });

  it('returns base damage when scaling is null (user-custom)', () => {
    expect(
      getScaledSpellDamage(cantrip({ damage: '3d4', damageScaling: null }), 17)
    ).toBe('3d4');
  });

  it('returns base damage when scaling is undefined', () => {
    expect(getScaledSpellDamage(cantrip({}), 17)).toBe('1d8');
  });

  it('passes leveled spells through untouched', () => {
    expect(
      getScaledSpellDamage(
        { level: 3, damage: '8d6', damageScaling: { 1: '1d8', 5: '2d8' } },
        17
      )
    ).toBe('8d6');
  });

  it('returns undefined for a cantrip with no damage at all', () => {
    expect(
      getScaledSpellDamage(
        { level: 0, damage: undefined, damageScaling: undefined },
        5
      )
    ).toBeUndefined();
  });

  it('falls back to base damage below the lowest threshold (True Strike-style table)', () => {
    const trueStrike = cantrip({
      damage: undefined,
      damageScaling: { 5: '1d6', 11: '2d6', 17: '3d6' },
    });
    expect(getScaledSpellDamage(trueStrike, 3)).toBeUndefined();
    expect(getScaledSpellDamage(trueStrike, 5)).toBe('1d6');
  });
});

describe('getCantripUpgrades', () => {
  const spells = [
    cantrip({
      name: 'Shocking Grasp',
      damageScaling: { 1: '1d8', 5: '2d8', 11: '3d8', 17: '4d8' },
    }),
    cantrip({ name: 'Custom Zap', damageScaling: null }),
    cantrip({ name: 'No Table' }),
    { name: 'Fireball', level: 3, damage: '8d6' },
  ] as Spell[];

  it('lists only cantrips whose dice change across the level-up', () => {
    expect(getCantripUpgrades(spells, 4, 5)).toEqual([
      { name: 'Shocking Grasp', from: '1d8', to: '2d8' },
    ]);
  });

  it('returns empty when no threshold is crossed', () => {
    expect(getCantripUpgrades(spells, 5, 6)).toEqual([]);
  });
});

describe('resolveDamageScalingOnEdit', () => {
  const table = { 1: '1d8', 5: '2d8' };

  it('returns null when damage changed on a scaling cantrip', () => {
    expect(
      resolveDamageScalingOnEdit({ damage: '1d8', damageScaling: table }, '2d6')
    ).toBeNull();
  });

  it('keeps the table when damage is unchanged', () => {
    expect(
      resolveDamageScalingOnEdit({ damage: '1d8', damageScaling: table }, '1d8')
    ).toEqual(table);
  });

  it('stays null once user-customized', () => {
    expect(
      resolveDamageScalingOnEdit({ damage: '2d6', damageScaling: null }, '3d6')
    ).toBeNull();
  });

  it('stays undefined for never-enriched spells', () => {
    expect(
      resolveDamageScalingOnEdit(
        { damage: '1d8', damageScaling: undefined },
        '2d6'
      )
    ).toBeUndefined();
  });
});
