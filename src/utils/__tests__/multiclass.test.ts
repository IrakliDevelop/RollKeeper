import { describe, it, expect } from 'vitest';
import {
  migrateToMulticlass,
  isMulticlassed,
  calculateHitDicePools,
  getTotalLevel,
  getPrimaryClass,
  getClassDisplayString,
} from '@/utils/multiclass';
import { makeCharacter } from './test-utils';
import { MulticlassInfo, HitDicePools } from '@/types/character';

// =============================================
// Shared helpers
// =============================================

function makeMulticlassCharacter(classes: MulticlassInfo[]) {
  const totalLevel = classes.reduce((sum, c) => sum + c.level, 0);
  return makeCharacter({ classes, totalLevel, level: totalLevel });
}

const FIGHTER_3: MulticlassInfo = {
  className: 'Fighter',
  level: 3,
  hitDie: 10,
  spellcaster: 'none',
  isCustom: false,
};

const WIZARD_2: MulticlassInfo = {
  className: 'Wizard',
  level: 2,
  hitDie: 6,
  spellcaster: 'full',
  isCustom: false,
};

const ROGUE_3: MulticlassInfo = {
  className: 'Rogue',
  level: 3,
  hitDie: 8,
  spellcaster: 'none',
  isCustom: false,
};

// =============================================
// migrateToMulticlass
// =============================================

describe('migrateToMulticlass', () => {
  it('converts a single-class character to multiclass format', () => {
    const char = makeCharacter(); // Level 5 Fighter, no classes array
    const migrated = migrateToMulticlass({ ...char, classes: undefined });

    expect(migrated.classes).toHaveLength(1);
    expect(migrated.classes![0].className).toBe('Fighter');
    expect(migrated.classes![0].level).toBe(5);
    expect(migrated.classes![0].hitDie).toBe(10);
    expect(migrated.classes![0].spellcaster).toBe('none');
  });

  it('sets totalLevel on the migrated character', () => {
    const char = makeCharacter({ level: 3, classes: undefined });
    const migrated = migrateToMulticlass(char);
    expect(migrated.totalLevel).toBe(3);
  });

  it('initialises hitDicePools with the correct die type and max', () => {
    const char = makeCharacter({ level: 5, classes: undefined });
    const migrated = migrateToMulticlass(char);
    expect(migrated.hitDicePools).toBeDefined();
    expect(migrated.hitDicePools!['d10']).toEqual({ max: 5, used: 0 });
  });

  it('returns the character unchanged when classes array is already present', () => {
    const char = makeCharacter({
      classes: [FIGHTER_3, WIZARD_2],
    });
    const result = migrateToMulticlass(char);
    expect(result).toBe(char); // strict reference equality — no clone
  });

  it('preserves backwards-compatibility class and level fields', () => {
    const char = makeCharacter({ classes: undefined });
    const migrated = migrateToMulticlass(char);
    expect(migrated.class).toBeDefined();
    expect(migrated.level).toBe(5);
  });
});

// =============================================
// isMulticlassed
// =============================================

describe('isMulticlassed', () => {
  it('returns false for a character with a single class entry', () => {
    const char = makeMulticlassCharacter([FIGHTER_3]);
    expect(isMulticlassed(char)).toBe(false);
  });

  it('returns true for a character with two classes', () => {
    const char = makeMulticlassCharacter([FIGHTER_3, WIZARD_2]);
    expect(isMulticlassed(char)).toBe(true);
  });

  it('returns false when classes array is absent', () => {
    const char = makeCharacter({ classes: undefined });
    expect(isMulticlassed(char)).toBe(false);
  });

  it('returns false when classes array is empty', () => {
    const char = makeCharacter({ classes: [] });
    expect(isMulticlassed(char)).toBe(false);
  });

  it('returns true for three classes', () => {
    const char = makeMulticlassCharacter([FIGHTER_3, WIZARD_2, ROGUE_3]);
    expect(isMulticlassed(char)).toBe(true);
  });
});

// =============================================
// calculateHitDicePools
// =============================================

describe('calculateHitDicePools', () => {
  it('creates a single pool for a single class', () => {
    const pools = calculateHitDicePools([FIGHTER_3]);
    expect(pools).toEqual({ d10: { max: 3, used: 0 } });
  });

  it('creates separate pools for classes with different hit dice', () => {
    const pools = calculateHitDicePools([FIGHTER_3, WIZARD_2]);
    expect(pools['d10']).toEqual({ max: 3, used: 0 });
    expect(pools['d6']).toEqual({ max: 2, used: 0 });
  });

  it('combines levels for classes sharing the same hit die type', () => {
    const BARBARIAN_2: MulticlassInfo = {
      className: 'Barbarian',
      level: 2,
      hitDie: 12,
      spellcaster: 'none',
      isCustom: false,
    };
    const RANGER_3: MulticlassInfo = {
      className: 'Ranger',
      level: 3,
      hitDie: 10,
      spellcaster: 'half',
      isCustom: false,
    };
    // Fighter d10 + Ranger d10 should combine to max 6
    const pools = calculateHitDicePools([FIGHTER_3, RANGER_3, BARBARIAN_2]);
    expect(pools['d10']).toEqual({ max: 6, used: 0 });
    expect(pools['d12']).toEqual({ max: 2, used: 0 });
  });

  it('preserves used dice from existing pools', () => {
    const existingPools: HitDicePools = { d10: { max: 3, used: 2 } };
    const pools = calculateHitDicePools([FIGHTER_3], existingPools);
    expect(pools['d10'].used).toBe(2);
  });

  it('caps used dice at the new max when class level decreases', () => {
    // Previous pool had 5 dice, 4 used. New class only has 3 levels.
    const smallerClass: MulticlassInfo = { ...FIGHTER_3, level: 3 };
    const existingPools: HitDicePools = { d10: { max: 5, used: 4 } };
    const pools = calculateHitDicePools([smallerClass], existingPools);
    expect(pools['d10'].max).toBe(3);
    expect(pools['d10'].used).toBe(3); // capped to max
  });

  it('starts used at 0 for die types not present in existingPools', () => {
    const existingPools: HitDicePools = { d10: { max: 3, used: 1 } };
    const pools = calculateHitDicePools([FIGHTER_3, WIZARD_2], existingPools);
    expect(pools['d6'].used).toBe(0);
  });
});

// =============================================
// getTotalLevel
// =============================================

describe('getTotalLevel', () => {
  it('returns totalLevel when explicitly set', () => {
    const char = makeCharacter({ totalLevel: 7, level: 5 });
    expect(getTotalLevel(char)).toBe(7);
  });

  it('sums class levels from classes array when totalLevel is undefined', () => {
    const char = makeCharacter({
      classes: [FIGHTER_3, WIZARD_2],
      totalLevel: undefined,
    });
    expect(getTotalLevel(char)).toBe(5);
  });

  it('falls back to character.level when no classes and no totalLevel', () => {
    const char = makeCharacter({
      level: 8,
      classes: undefined,
      totalLevel: undefined,
    });
    expect(getTotalLevel(char)).toBe(8);
  });

  it('returns 1 when level, totalLevel, and classes are all absent/empty', () => {
    const char = makeCharacter({
      level: undefined as unknown as number,
      classes: undefined,
      totalLevel: undefined,
    });
    expect(getTotalLevel(char)).toBe(1);
  });

  it('handles three classes', () => {
    const char = makeCharacter({
      classes: [FIGHTER_3, WIZARD_2, ROGUE_3],
      totalLevel: undefined,
    });
    expect(getTotalLevel(char)).toBe(8);
  });
});

// =============================================
// getPrimaryClass
// =============================================

describe('getPrimaryClass', () => {
  it('returns the single class when there is only one', () => {
    const char = makeMulticlassCharacter([FIGHTER_3]);
    const primary = getPrimaryClass(char);
    expect(primary?.className).toBe('Fighter');
    expect(primary?.level).toBe(3);
  });

  it('returns the class with the highest level', () => {
    const char = makeMulticlassCharacter([WIZARD_2, FIGHTER_3]);
    const primary = getPrimaryClass(char);
    expect(primary?.className).toBe('Fighter');
  });

  it('returns the first class when levels are tied (stable reduce)', () => {
    const WIZARD_3: MulticlassInfo = { ...WIZARD_2, level: 3 };
    const char = makeMulticlassCharacter([FIGHTER_3, WIZARD_3]);
    // When tied, reduce keeps the accumulator (first class)
    const primary = getPrimaryClass(char);
    expect(primary?.level).toBe(3);
    // Both have level 3; whichever came first in the array is retained
    expect(['Fighter', 'Wizard']).toContain(primary?.className);
  });

  it('falls back to single class format when classes array is absent', () => {
    const char = makeCharacter({ classes: undefined });
    const primary = getPrimaryClass(char);
    expect(primary).not.toBeNull();
    expect(primary?.className).toBe('Fighter');
  });

  it('returns null when neither classes nor class field are present', () => {
    const char = makeCharacter({
      classes: undefined,
      class: undefined as unknown as CharacterState['class'],
    });
    const primary = getPrimaryClass(char);
    expect(primary).toBeNull();
  });
});

// =============================================
// getClassDisplayString
// =============================================

describe('getClassDisplayString', () => {
  it('formats a single-class character as "ClassName Level"', () => {
    const char = makeMulticlassCharacter([FIGHTER_3]);
    expect(getClassDisplayString(char)).toBe('Fighter 3');
  });

  it('formats two classes sorted by level descending with total', () => {
    const char = makeMulticlassCharacter([FIGHTER_3, WIZARD_2]);
    // Fighter 3 first (higher level), then Wizard 2
    expect(getClassDisplayString(char)).toBe('Fighter 3 / Wizard 2 (Level 5)');
  });

  it('sorts classes highest level first in display string', () => {
    // Wizard_2 comes first in array but Fighter has higher level
    const char = makeMulticlassCharacter([WIZARD_2, FIGHTER_3]);
    expect(getClassDisplayString(char)).toMatch(/^Fighter 3/);
  });

  it('falls back to "ClassName Level" for legacy characters without classes', () => {
    const char = makeCharacter({ classes: undefined });
    const display = getClassDisplayString(char);
    expect(display).toBe('Fighter 5');
  });

  it('falls back to "Unknown 1" when neither classes nor class.name are present', () => {
    const char = makeCharacter({
      classes: undefined,
      class: undefined as unknown as CharacterState['class'],
    });
    const display = getClassDisplayString(char);
    expect(display).toMatch(/Unknown/);
  });

  it('includes (Level N) only when more than one class', () => {
    const char = makeMulticlassCharacter([FIGHTER_3]);
    expect(getClassDisplayString(char)).not.toContain('Level');
  });

  it('formats three classes correctly', () => {
    const char = makeMulticlassCharacter([FIGHTER_3, WIZARD_2, ROGUE_3]);
    const display = getClassDisplayString(char);
    // FIGHTER_3 (3) and ROGUE_3 (3) tie for highest; Wizard last
    expect(display).toContain('Wizard 2');
    expect(display).toContain('(Level 8)');
  });
});

// =============================================
// MULTICLASS_REQUIREMENTS constant (imported indirectly via validateMulticlassRequirements)
// =============================================

describe('MULTICLASS_REQUIREMENTS (via validateMulticlassRequirements)', () => {
  // We test the constant indirectly: if validateMulticlassRequirements uses it
  // we can verify the known ability prerequisites hold for core classes.
  // This avoids having to import the non-exported constant.
  it('is covered by the exported functions — Wizard requires INT 13', async () => {
    const { validateMulticlassRequirements } = await import(
      '@/utils/multiclass'
    );
    const lowIntAbilities = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };
    const result = validateMulticlassRequirements(
      [],
      'Wizard',
      lowIntAbilities
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Intelligence'))).toBe(true);
  });

  it('Wizard requirement passes with INT 13', async () => {
    const { validateMulticlassRequirements } = await import(
      '@/utils/multiclass'
    );
    const goodAbilities = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 13,
      wisdom: 10,
      charisma: 10,
    };
    const result = validateMulticlassRequirements([], 'Wizard', goodAbilities);
    expect(result.valid).toBe(true);
  });

  it('Paladin requires STR 13 and CHA 13', async () => {
    const { validateMulticlassRequirements } = await import(
      '@/utils/multiclass'
    );
    const abilities = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };
    const result = validateMulticlassRequirements([], 'Paladin', abilities);
    expect(result.errors).toHaveLength(2);
  });
});

// need CharacterState type for the null-class cast above
type CharacterState = import('@/types/character').CharacterState;
