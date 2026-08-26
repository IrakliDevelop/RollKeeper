import { describe, it, expect } from 'vitest';
import {
  // Weapons
  isWeaponProficient,
  getWeaponAbilityModifier,
  calculateWeaponAttackBonus,
  calculateWeaponDamageBonus,
  getWeaponAttackString,
  getWeaponDamageString,
  // Spell Slots
  calculateSpellSlots,
  calculatePactMagic,
  updateSpellSlotsPreservingUsed,
  hasSpellSlots,
  // XP
  calculateLevelFromXP,
  getXPForLevel,
  getXPToNextLevel,
  getXPProgress,
  shouldLevelUp,
  // Spellcasting
  getClassSpellcastingAbility,
  calculateSpellAttackBonus,
  calculateSpellSaveDC,
  isSpellcaster,
  // Traits/Charges
  calculateTraitMaxUses,
  // Multiclass
  calculateMulticlassSpellSlots,
  calculateCharacterPactMagic,
  calculateCharacterHitDicePools,
  getCharacterTotalLevel,
  hasSpellcasting,
  hasWarlockLevels,
} from '@/utils/calculations';
import { makeCharacter, makeWizard, makeWarlock } from './test-utils';
import type { Weapon, MulticlassInfo, TrackableTrait } from '@/types/character';

// ===== Weapon factory =====

function makeSword(overrides: Partial<Weapon> = {}): Weapon {
  return {
    id: 'sword-1',
    name: 'Longsword',
    category: 'martial',
    weaponType: ['melee'],
    damage: [{ dice: '1d8', type: 'slashing' }],
    enhancementBonus: 0,
    properties: [],
    isEquipped: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ===== isWeaponProficient =====

describe('isWeaponProficient', () => {
  it('returns true for martial weapon when character has martial proficiency', () => {
    const char = makeCharacter(); // Fighter — martial + simple
    const sword = makeSword({ category: 'martial' });
    expect(isWeaponProficient(char, sword)).toBe(true);
  });

  it('returns true for simple weapon when character has simple proficiency', () => {
    const char = makeCharacter();
    const dagger = makeSword({ category: 'simple', name: 'Dagger' });
    expect(isWeaponProficient(char, dagger)).toBe(true);
  });

  it('returns false for martial weapon when character lacks martial proficiency', () => {
    const char = makeCharacter({
      weaponProficiencies: {
        simpleWeapons: true,
        martialWeapons: false,
        specificWeapons: [],
      },
    });
    const sword = makeSword({ category: 'martial' });
    expect(isWeaponProficient(char, sword)).toBe(false);
  });

  it('returns true when weapon is in specificWeapons list', () => {
    const char = makeCharacter({
      weaponProficiencies: {
        simpleWeapons: false,
        martialWeapons: false,
        specificWeapons: ['longsword'],
      },
    });
    const sword = makeSword({ name: 'Longsword', category: 'martial' });
    expect(isWeaponProficient(char, sword)).toBe(true);
  });

  it('honours manualProficiency override — true overrides missing proficiency', () => {
    const char = makeCharacter({
      weaponProficiencies: {
        simpleWeapons: false,
        martialWeapons: false,
        specificWeapons: [],
      },
    });
    const sword = makeSword({ category: 'martial', manualProficiency: true });
    expect(isWeaponProficient(char, sword)).toBe(true);
  });

  it('honours manualProficiency override — false overrides existing proficiency', () => {
    const char = makeCharacter(); // has martial proficiency
    const sword = makeSword({ category: 'martial', manualProficiency: false });
    expect(isWeaponProficient(char, sword)).toBe(false);
  });
});

// ===== getWeaponAbilityModifier =====

describe('getWeaponAbilityModifier', () => {
  it('returns STR modifier for a melee weapon', () => {
    const char = makeCharacter(); // STR 16 → +3
    const sword = makeSword({ weaponType: ['melee'] });
    expect(getWeaponAbilityModifier(char, sword)).toBe(3);
  });

  it('returns DEX modifier for a ranged weapon', () => {
    const char = makeCharacter(); // DEX 14 → +2
    const bow = makeSword({ weaponType: ['ranged'] });
    expect(getWeaponAbilityModifier(char, bow)).toBe(2);
  });

  it('returns higher of STR/DEX for a finesse weapon', () => {
    // Fighter: STR 16 (+3) > DEX 14 (+2) → should return 3
    const char = makeCharacter();
    const rapier = makeSword({ weaponType: ['finesse'] });
    expect(getWeaponAbilityModifier(char, rapier)).toBe(3);
  });

  it('returns DEX for finesse when DEX is higher', () => {
    const char = makeCharacter({
      abilities: {
        strength: 10,
        dexterity: 18,
        constitution: 14,
        intelligence: 10,
        wisdom: 10,
        charisma: 8,
      },
    });
    const rapier = makeSword({ weaponType: ['finesse'] });
    expect(getWeaponAbilityModifier(char, rapier)).toBe(4);
  });

  it('uses abilityOverride when set', () => {
    const char = makeCharacter(); // CHA 8 → -1
    const pactBlade = makeSword({ abilityOverride: 'charisma' });
    expect(getWeaponAbilityModifier(char, pactBlade)).toBe(-1);
  });
});

// ===== calculateWeaponAttackBonus =====

describe('calculateWeaponAttackBonus', () => {
  it('calculates attack bonus: ability mod + proficiency + enhancement', () => {
    // Fighter level 5: STR +3, proficiency +3 (level 5), enhancement +0 → 6
    const char = makeCharacter(); // level 5, STR 16
    const sword = makeSword(); // martial melee, no enhancement
    expect(calculateWeaponAttackBonus(char, sword)).toBe(6);
  });

  it('excludes proficiency when not proficient', () => {
    const char = makeCharacter({
      weaponProficiencies: {
        simpleWeapons: false,
        martialWeapons: false,
        specificWeapons: [],
      },
    });
    const sword = makeSword(); // STR +3, no proficiency
    expect(calculateWeaponAttackBonus(char, sword)).toBe(3);
  });

  it('adds enhancement bonus', () => {
    const char = makeCharacter();
    const magicSword = makeSword({ enhancementBonus: 2 }); // STR +3, prof +3, enh +2 → 8
    expect(calculateWeaponAttackBonus(char, magicSword)).toBe(8);
  });

  it('adds custom attackBonus', () => {
    const char = makeCharacter();
    const sword = makeSword({ attackBonus: 1 }); // STR +3, prof +3, custom +1 → 7
    expect(calculateWeaponAttackBonus(char, sword)).toBe(7);
  });
});

// ===== calculateWeaponDamageBonus =====

describe('calculateWeaponDamageBonus', () => {
  it('calculates damage bonus: ability mod + enhancement', () => {
    const char = makeCharacter(); // STR +3
    const sword = makeSword(); // no enhancement
    expect(calculateWeaponDamageBonus(char, sword)).toBe(3);
  });

  it('adds enhancement bonus to damage', () => {
    const char = makeCharacter(); // STR +3
    const magicSword = makeSword({ enhancementBonus: 2 });
    expect(calculateWeaponDamageBonus(char, magicSword)).toBe(5);
  });

  it('adds custom damageBonus', () => {
    const char = makeCharacter(); // STR +3
    const sword = makeSword({ damageBonus: 1 });
    expect(calculateWeaponDamageBonus(char, sword)).toBe(4);
  });

  it('uses abilityOverride for damage', () => {
    // CHA 8 → -1, but with override uses CHA
    const char = makeCharacter();
    const pactBlade = makeSword({ abilityOverride: 'charisma' });
    expect(calculateWeaponDamageBonus(char, pactBlade)).toBe(-1);
  });
});

// ===== getWeaponAttackString =====

describe('getWeaponAttackString', () => {
  it('formats positive attack bonus correctly', () => {
    const char = makeCharacter(); // STR+3, prof+3 = +6
    const sword = makeSword();
    expect(getWeaponAttackString(char, sword)).toBe('+6 to hit');
  });

  it('formats negative attack bonus correctly', () => {
    const char = makeCharacter({
      abilities: {
        strength: 6, // -2
        dexterity: 14,
        constitution: 14,
        intelligence: 10,
        wisdom: 12,
        charisma: 8,
      },
      weaponProficiencies: {
        simpleWeapons: false,
        martialWeapons: false,
        specificWeapons: [],
      },
    });
    const sword = makeSword();
    expect(getWeaponAttackString(char, sword)).toBe('-2 to hit');
  });

  it('formats zero attack bonus correctly', () => {
    const char = makeCharacter({
      abilities: {
        strength: 10, // +0
        dexterity: 14,
        constitution: 14,
        intelligence: 10,
        wisdom: 12,
        charisma: 8,
      },
      weaponProficiencies: {
        simpleWeapons: false,
        martialWeapons: false,
        specificWeapons: [],
      },
    });
    const sword = makeSword();
    expect(getWeaponAttackString(char, sword)).toBe('+0 to hit');
  });
});

// ===== getWeaponDamageString =====

describe('getWeaponDamageString', () => {
  it('formats damage with positive bonus', () => {
    const char = makeCharacter(); // STR+3
    const sword = makeSword(); // 1d8 slashing, no enhancement
    expect(getWeaponDamageString(char, sword)).toBe('1d8+3 slashing');
  });

  it('formats damage with zero bonus (no modifier shown)', () => {
    const char = makeCharacter({
      abilities: {
        strength: 10,
        dexterity: 14,
        constitution: 14,
        intelligence: 10,
        wisdom: 12,
        charisma: 8,
      },
      weaponProficiencies: {
        simpleWeapons: false,
        martialWeapons: false,
        specificWeapons: [],
      },
    });
    const sword = makeSword();
    expect(getWeaponDamageString(char, sword)).toBe('1d8 slashing');
  });

  it('returns "No damage" when damage array is empty', () => {
    const char = makeCharacter();
    const sword = makeSword({ damage: [] });
    expect(getWeaponDamageString(char, sword)).toBe('No damage');
  });

  it('uses versatile dice when versatile=true', () => {
    const char = makeCharacter({
      abilities: {
        strength: 10,
        dexterity: 14,
        constitution: 14,
        intelligence: 10,
        wisdom: 12,
        charisma: 8,
      },
    });
    const versatileSword = makeSword({
      damage: [{ dice: '1d8', type: 'slashing', versatiledice: '1d10' }],
    });
    const result = getWeaponDamageString(char, versatileSword, true);
    expect(result).toBe('1d10 slashing');
  });

  it('includes extra damage entries without weapon bonus', () => {
    const char = makeCharacter(); // STR+3
    const flamingSword = makeSword({
      damage: [
        { dice: '1d8', type: 'slashing' },
        { dice: '1d6', type: 'fire' },
      ],
    });
    expect(getWeaponDamageString(char, flamingSword)).toBe(
      '1d8+3 slashing, 1d6 fire'
    );
  });
});

// ===== calculateSpellSlots =====

describe('calculateSpellSlots', () => {
  it('returns empty slots for non-caster', () => {
    const classInfo = {
      name: 'Fighter',
      isCustom: false,
      spellcaster: 'none' as const,
      hitDie: 10,
    };
    const slots = calculateSpellSlots(classInfo, 5);
    expect(slots[1].max).toBe(0);
    expect(slots[3].max).toBe(0);
  });

  it('returns empty slots for warlock (uses pact magic instead)', () => {
    const classInfo = {
      name: 'Warlock',
      isCustom: false,
      spellcaster: 'warlock' as const,
      hitDie: 8,
    };
    const slots = calculateSpellSlots(classInfo, 5);
    expect(slots[1].max).toBe(0);
  });

  it('returns correct slots for full caster at level 5', () => {
    const classInfo = {
      name: 'Wizard',
      isCustom: false,
      spellcaster: 'full' as const,
      hitDie: 6,
    };
    const slots = calculateSpellSlots(classInfo, 5);
    // Level 5 full caster: 4x1st, 3x2nd, 2x3rd
    expect(slots[1].max).toBe(4);
    expect(slots[2].max).toBe(3);
    expect(slots[3].max).toBe(2);
    expect(slots[4].max).toBe(0);
  });

  it('returns correct slots for half caster at level 5', () => {
    const classInfo = {
      name: 'Paladin',
      isCustom: false,
      spellcaster: 'half' as const,
      hitDie: 10,
    };
    const slots = calculateSpellSlots(classInfo, 5);
    // Level 5 half caster: 4x1st, 2x2nd
    expect(slots[1].max).toBe(4);
    expect(slots[2].max).toBe(2);
    expect(slots[3].max).toBe(0);
  });

  it('returns correct slots for third caster at level 7', () => {
    const classInfo = {
      name: 'Fighter',
      isCustom: false,
      spellcaster: 'third' as const,
      hitDie: 10,
    };
    const slots = calculateSpellSlots(classInfo, 7);
    // Level 7 third caster: 4x1st, 2x2nd
    expect(slots[1].max).toBe(4);
    expect(slots[2].max).toBe(2);
    expect(slots[3].max).toBe(0);
  });

  it('initialises all slots with used=0', () => {
    const classInfo = {
      name: 'Wizard',
      isCustom: false,
      spellcaster: 'full' as const,
      hitDie: 6,
    };
    const slots = calculateSpellSlots(classInfo, 10);
    for (let i = 1; i <= 9; i++) {
      expect(slots[i as keyof typeof slots].used).toBe(0);
    }
  });
});

// ===== calculatePactMagic =====

describe('calculatePactMagic', () => {
  it('returns pact magic for warlock level 1', () => {
    const pm = calculatePactMagic(1);
    expect(pm).toBeDefined();
    expect(pm!.slots.max).toBe(1);
    expect(pm!.level).toBe(1);
  });

  it('returns pact magic for warlock level 5 (2 slots, level 3)', () => {
    const pm = calculatePactMagic(5);
    expect(pm).toBeDefined();
    expect(pm!.slots.max).toBe(2);
    expect(pm!.level).toBe(3);
  });

  it('returns undefined for out-of-range level', () => {
    const pm = calculatePactMagic(0);
    expect(pm).toBeUndefined();
  });

  it('initialises pact slots with used=0', () => {
    const pm = calculatePactMagic(3);
    expect(pm!.slots.used).toBe(0);
  });
});

// ===== updateSpellSlotsPreservingUsed =====

describe('updateSpellSlotsPreservingUsed', () => {
  function makeSlots(
    config: Partial<Record<number, { max: number; used: number }>> = {}
  ) {
    const base = {
      1: { max: 0, used: 0 },
      2: { max: 0, used: 0 },
      3: { max: 0, used: 0 },
      4: { max: 0, used: 0 },
      5: { max: 0, used: 0 },
      6: { max: 0, used: 0 },
      7: { max: 0, used: 0 },
      8: { max: 0, used: 0 },
      9: { max: 0, used: 0 },
    };
    return { ...base, ...config } as import('@/types/character').SpellSlots;
  }

  it('preserves used count when within new max', () => {
    const current = makeSlots({ 1: { max: 4, used: 2 } });
    const newSlots = makeSlots({ 1: { max: 4, used: 0 } });
    const result = updateSpellSlotsPreservingUsed(newSlots, current);
    expect(result[1].used).toBe(2);
  });

  it('caps used to new max if used exceeds new max', () => {
    const current = makeSlots({ 1: { max: 4, used: 4 } });
    const newSlots = makeSlots({ 1: { max: 2, used: 0 } });
    const result = updateSpellSlotsPreservingUsed(newSlots, current);
    expect(result[1].used).toBe(2);
  });

  it('resets used to 0 when new max is 0', () => {
    const current = makeSlots({ 3: { max: 2, used: 2 } });
    const newSlots = makeSlots({ 3: { max: 0, used: 0 } });
    const result = updateSpellSlotsPreservingUsed(newSlots, current);
    expect(result[3].used).toBe(0);
  });
});

// ===== hasSpellSlots =====

describe('hasSpellSlots', () => {
  function makeSlots(level1Max: number) {
    return {
      1: { max: level1Max, used: 0 },
      2: { max: 0, used: 0 },
      3: { max: 0, used: 0 },
      4: { max: 0, used: 0 },
      5: { max: 0, used: 0 },
      6: { max: 0, used: 0 },
      7: { max: 0, used: 0 },
      8: { max: 0, used: 0 },
      9: { max: 0, used: 0 },
    } as import('@/types/character').SpellSlots;
  }

  it('returns true when regular spell slots exist', () => {
    expect(hasSpellSlots(makeSlots(4))).toBe(true);
  });

  it('returns false when all regular slots have max=0', () => {
    expect(hasSpellSlots(makeSlots(0))).toBe(false);
  });

  it('returns true when only pact magic slots exist', () => {
    const pact = { slots: { max: 2, used: 0 }, level: 2 };
    expect(hasSpellSlots(makeSlots(0), pact)).toBe(true);
  });

  it('returns false when slots is undefined', () => {
    expect(hasSpellSlots(undefined)).toBe(false);
  });
});

// ===== calculateLevelFromXP =====

describe('calculateLevelFromXP', () => {
  it('returns 1 at 0 XP', () => {
    expect(calculateLevelFromXP(0)).toBe(1);
  });

  it('returns 2 at exactly 300 XP', () => {
    expect(calculateLevelFromXP(300)).toBe(2);
  });

  it('returns 5 at exactly 6500 XP', () => {
    expect(calculateLevelFromXP(6500)).toBe(5);
  });

  it('returns 20 at 355000 XP', () => {
    expect(calculateLevelFromXP(355000)).toBe(20);
  });

  it('returns 4 at 2700 XP (threshold for level 4)', () => {
    expect(calculateLevelFromXP(2700)).toBe(4);
  });

  it('returns 4 at 6499 XP (just below level 5 threshold)', () => {
    expect(calculateLevelFromXP(6499)).toBe(4);
  });
});

// ===== getXPForLevel =====

describe('getXPForLevel', () => {
  it('returns 0 for level 1', () => {
    expect(getXPForLevel(1)).toBe(0);
  });

  it('returns 300 for level 2', () => {
    expect(getXPForLevel(2)).toBe(300);
  });

  it('returns 355000 for level 20', () => {
    expect(getXPForLevel(20)).toBe(355000);
  });

  it('clamps to level 1 for values below 1', () => {
    expect(getXPForLevel(0)).toBe(0);
  });

  it('clamps to level 20 for values above 20', () => {
    expect(getXPForLevel(25)).toBe(355000);
  });
});

// ===== getXPToNextLevel =====

describe('getXPToNextLevel', () => {
  it('returns correct XP needed when partway through a level', () => {
    // Level 1: need 300 XP total. At 100 XP → 200 more needed
    expect(getXPToNextLevel(100, 1)).toBe(200);
  });

  it('returns 0 at max level', () => {
    expect(getXPToNextLevel(355000, 20)).toBe(0);
  });

  it('returns 0 when already at or past next level threshold', () => {
    expect(getXPToNextLevel(300, 1)).toBe(0);
  });
});

// ===== getXPProgress =====

describe('getXPProgress', () => {
  it('returns 0 at the start of a level', () => {
    expect(getXPProgress(0, 1)).toBe(0);
  });

  it('returns 100 at max level', () => {
    expect(getXPProgress(355000, 20)).toBe(100);
  });

  it('returns ~50 when halfway through a level', () => {
    // Level 1→2: 0 to 300. Halfway = 150 XP
    const progress = getXPProgress(150, 1);
    expect(progress).toBeCloseTo(50, 0);
  });

  it('never exceeds 100', () => {
    // More XP than needed
    expect(getXPProgress(1000, 1)).toBe(100);
  });
});

// ===== shouldLevelUp =====

describe('shouldLevelUp', () => {
  it('returns true when XP exceeds next level threshold', () => {
    expect(shouldLevelUp(300, 1)).toBe(true);
  });

  it('returns false when XP is below next level threshold', () => {
    expect(shouldLevelUp(100, 1)).toBe(false);
  });

  it('returns false at max level', () => {
    expect(shouldLevelUp(355000, 20)).toBe(false);
  });

  it('returns false when current level matches XP', () => {
    expect(shouldLevelUp(6500, 5)).toBe(false);
  });
});

// ===== getClassSpellcastingAbility =====

describe('getClassSpellcastingAbility', () => {
  it('returns intelligence for Wizard', () => {
    expect(getClassSpellcastingAbility('Wizard')).toBe('intelligence');
  });

  it('returns intelligence for Artificer', () => {
    expect(getClassSpellcastingAbility('Artificer')).toBe('intelligence');
  });

  it('returns wisdom for Cleric', () => {
    expect(getClassSpellcastingAbility('Cleric')).toBe('wisdom');
  });

  it('returns wisdom for Druid', () => {
    expect(getClassSpellcastingAbility('Druid')).toBe('wisdom');
  });

  it('returns wisdom for Ranger', () => {
    expect(getClassSpellcastingAbility('Ranger')).toBe('wisdom');
  });

  it('returns charisma for Sorcerer', () => {
    expect(getClassSpellcastingAbility('Sorcerer')).toBe('charisma');
  });

  it('returns charisma for Warlock', () => {
    expect(getClassSpellcastingAbility('Warlock')).toBe('charisma');
  });

  it('returns charisma for Paladin', () => {
    expect(getClassSpellcastingAbility('Paladin')).toBe('charisma');
  });

  it('returns null for Fighter (non-spellcaster class)', () => {
    expect(getClassSpellcastingAbility('Fighter')).toBe(null);
  });

  it('returns null for unknown class', () => {
    expect(getClassSpellcastingAbility('Barbarian')).toBe(null);
  });

  it('is case-insensitive', () => {
    expect(getClassSpellcastingAbility('wizard')).toBe('intelligence');
    expect(getClassSpellcastingAbility('CLERIC')).toBe('wisdom');
  });
});

// ===== calculateSpellAttackBonus =====

describe('calculateSpellAttackBonus', () => {
  it('calculates spell attack bonus for Wizard: INT mod + proficiency', () => {
    // Wizard level 5: INT 18 (+4), proficiency +3 → 7
    const wizard = makeWizard();
    expect(calculateSpellAttackBonus(wizard)).toBe(7);
  });

  it('calculates spell attack bonus for Warlock: CHA mod + proficiency', () => {
    // Warlock level 5: CHA 18 (+4), proficiency +3 → 7
    const warlock = makeWarlock();
    expect(calculateSpellAttackBonus(warlock)).toBe(7);
  });

  it('returns null for non-spellcaster Fighter', () => {
    const fighter = makeCharacter({
      spellcastingStats: {
        spellcastingAbility: null,
        isAbilityOverridden: false,
      },
    });
    expect(calculateSpellAttackBonus(fighter)).toBe(null);
  });

  it('returns manual override when spellAttackBonus is set', () => {
    const wizard = makeWizard({
      spellcastingStats: {
        spellcastingAbility: 'intelligence',
        isAbilityOverridden: false,
        spellAttackBonus: 10,
      },
    });
    expect(calculateSpellAttackBonus(wizard)).toBe(10);
  });
});

// ===== calculateSpellSaveDC =====

describe('calculateSpellSaveDC', () => {
  it('calculates spell save DC for Wizard: 8 + INT mod + proficiency', () => {
    // Wizard level 5: 8 + 4 + 3 = 15
    const wizard = makeWizard();
    expect(calculateSpellSaveDC(wizard)).toBe(15);
  });

  it('calculates spell save DC for Warlock: 8 + CHA mod + proficiency', () => {
    // Warlock level 5: 8 + 4 + 3 = 15
    const warlock = makeWarlock();
    expect(calculateSpellSaveDC(warlock)).toBe(15);
  });

  it('returns null for non-spellcaster Fighter', () => {
    const fighter = makeCharacter({
      spellcastingStats: {
        spellcastingAbility: null,
        isAbilityOverridden: false,
      },
    });
    expect(calculateSpellSaveDC(fighter)).toBe(null);
  });

  it('returns manual override when spellSaveDC is set', () => {
    const wizard = makeWizard({
      spellcastingStats: {
        spellcastingAbility: 'intelligence',
        isAbilityOverridden: false,
        spellSaveDC: 20,
      },
    });
    expect(calculateSpellSaveDC(wizard)).toBe(20);
  });
});

// ===== isSpellcaster =====

describe('isSpellcaster', () => {
  it('returns true for Wizard', () => {
    const wizard = makeWizard();
    expect(isSpellcaster(wizard)).toBe(true);
  });

  it('returns true for Warlock', () => {
    const warlock = makeWarlock();
    expect(isSpellcaster(warlock)).toBe(true);
  });

  it('returns false for non-spellcaster Fighter with no spellcasting override', () => {
    const fighter = makeCharacter({
      spellcastingStats: {
        spellcastingAbility: null,
        isAbilityOverridden: false,
      },
    });
    expect(isSpellcaster(fighter)).toBe(false);
  });
});

// ===== calculateTraitMaxUses =====

describe('calculateTraitMaxUses', () => {
  function makeTrait(overrides: Partial<TrackableTrait> = {}): TrackableTrait {
    return {
      id: 'trait-1',
      name: 'Test Trait',
      maxUses: 3,
      usedUses: 0,
      restType: 'long',
      scaleWithProficiency: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('returns maxUses when not scaling with proficiency', () => {
    const trait = makeTrait({ maxUses: 3, scaleWithProficiency: false });
    expect(calculateTraitMaxUses(trait, 5)).toBe(3);
  });

  it('returns proficiency bonus when scaleWithProficiency=true with multiplier 1', () => {
    // Level 5 → proficiency +3
    const trait = makeTrait({
      scaleWithProficiency: true,
      proficiencyMultiplier: 1,
    });
    expect(calculateTraitMaxUses(trait, 5)).toBe(3);
  });

  it('applies proficiency multiplier when scaling', () => {
    // Level 5 → proficiency +3, multiplier 2 → 6
    const trait = makeTrait({
      scaleWithProficiency: true,
      proficiencyMultiplier: 2,
    });
    expect(calculateTraitMaxUses(trait, 5)).toBe(6);
  });

  it('returns at least 1 when scaling results in 0', () => {
    // Multiplier 0 → floor(3 * 0) = 0 → clamped to 1
    const trait = makeTrait({
      scaleWithProficiency: true,
      proficiencyMultiplier: 0,
    });
    expect(calculateTraitMaxUses(trait, 5)).toBeGreaterThanOrEqual(1);
  });
});

// ===== calculateMulticlassSpellSlots =====

describe('calculateMulticlassSpellSlots', () => {
  function makeClasses(
    entries: Array<{
      spellcaster: MulticlassInfo['spellcaster'];
      level: number;
    }>
  ): MulticlassInfo[] {
    return entries.map((e, i) => ({
      className: `Class${i}`,
      level: e.level,
      isCustom: false,
      spellcaster: e.spellcaster,
      hitDie: 8,
    }));
  }

  it('returns empty slots when no caster levels', () => {
    const classes = makeClasses([{ spellcaster: 'none', level: 5 }]);
    const slots = calculateMulticlassSpellSlots(classes);
    for (let i = 1; i <= 9; i++) {
      expect(slots[i as keyof typeof slots].max).toBe(0);
    }
  });

  it('combines full caster levels from two classes', () => {
    // 2 full casters at level 5 each → combined level 10
    const classes = makeClasses([
      { spellcaster: 'full', level: 5 },
      { spellcaster: 'full', level: 5 },
    ]);
    const slots = calculateMulticlassSpellSlots(classes);
    // Level 10 full caster: 4x1, 3x2, 3x3, 3x4, 2x5
    expect(slots[1].max).toBe(4);
    expect(slots[5].max).toBe(2);
  });

  it('uses floor(level/2) for half caster levels', () => {
    // Paladin 5 + Wizard 5 → half=2 + full=5 = caster level 7
    const classes = makeClasses([
      { spellcaster: 'half', level: 5 },
      { spellcaster: 'full', level: 5 },
    ]);
    const slots = calculateMulticlassSpellSlots(classes);
    // Level 7 full table: 4x1, 3x2, 3x3, 1x4
    expect(slots[4].max).toBe(1);
  });

  it('uses floor(level/3) for third caster levels', () => {
    // Eldritch Knight 6 → floor(6/3) = 2 caster levels
    const classes = makeClasses([{ spellcaster: 'third', level: 6 }]);
    const slots = calculateMulticlassSpellSlots(classes);
    // Level 2 full table: 3x1
    expect(slots[1].max).toBe(3);
  });

  it('excludes warlock levels from multiclass spell slot calculation', () => {
    // Warlock 5 + Fighter(none) 5 → 0 caster levels
    const classes = makeClasses([
      { spellcaster: 'warlock', level: 5 },
      { spellcaster: 'none', level: 5 },
    ]);
    const slots = calculateMulticlassSpellSlots(classes);
    expect(slots[1].max).toBe(0);
  });
});

// ===== calculateCharacterPactMagic =====

describe('calculateCharacterPactMagic', () => {
  it('returns pact magic for single-class warlock', () => {
    const warlock = makeWarlock(); // level 5
    const pm = calculateCharacterPactMagic(warlock);
    expect(pm).toBeDefined();
    expect(pm!.level).toBe(3); // Warlock 5 → pact slot level 3
    expect(pm!.slots.max).toBe(2);
  });

  it('returns undefined for non-warlock', () => {
    const wizard = makeWizard();
    expect(calculateCharacterPactMagic(wizard)).toBeUndefined();
  });

  it('returns pact magic from warlock class in multiclass setup', () => {
    const char = makeCharacter({
      classes: [
        {
          className: 'Warlock',
          level: 3,
          isCustom: false,
          spellcaster: 'warlock',
          hitDie: 8,
        },
        {
          className: 'Sorcerer',
          level: 2,
          isCustom: false,
          spellcaster: 'full',
          hitDie: 6,
        },
      ],
    });
    const pm = calculateCharacterPactMagic(char);
    expect(pm).toBeDefined();
    expect(pm!.slots.max).toBe(2); // Warlock 3 → 2 pact slots
  });

  it('returns undefined for multiclass without warlock', () => {
    const char = makeCharacter({
      classes: [
        {
          className: 'Wizard',
          level: 3,
          isCustom: false,
          spellcaster: 'full',
          hitDie: 6,
        },
        {
          className: 'Fighter',
          level: 2,
          isCustom: false,
          spellcaster: 'none',
          hitDie: 10,
        },
      ],
    });
    expect(calculateCharacterPactMagic(char)).toBeUndefined();
  });
});

// ===== calculateCharacterHitDicePools =====

describe('calculateCharacterHitDicePools', () => {
  it('returns single pool for single-class character (fallback)', () => {
    const fighter = makeCharacter(); // level 5, d10
    const pools = calculateCharacterHitDicePools(fighter);
    expect(pools['d10']).toBeDefined();
    expect(pools['d10'].max).toBe(5);
  });

  it('returns separate pools for multiclass with different hit dice', () => {
    const char = makeCharacter({
      classes: [
        {
          className: 'Fighter',
          level: 3,
          isCustom: false,
          spellcaster: 'none',
          hitDie: 10,
        },
        {
          className: 'Wizard',
          level: 2,
          isCustom: false,
          spellcaster: 'full',
          hitDie: 6,
        },
      ],
    });
    const pools = calculateCharacterHitDicePools(char);
    expect(pools['d10'].max).toBe(3);
    expect(pools['d6'].max).toBe(2);
  });

  it('merges levels for same-die-type classes', () => {
    const char = makeCharacter({
      classes: [
        {
          className: 'Warlock',
          level: 3,
          isCustom: false,
          spellcaster: 'warlock',
          hitDie: 8,
        },
        {
          className: 'Cleric',
          level: 2,
          isCustom: false,
          spellcaster: 'full',
          hitDie: 8,
        },
      ],
    });
    const pools = calculateCharacterHitDicePools(char);
    expect(pools['d8'].max).toBe(5);
    expect(Object.keys(pools)).toHaveLength(1);
  });
});

// ===== getCharacterTotalLevel =====

describe('getCharacterTotalLevel', () => {
  it('returns level for single-class character', () => {
    const fighter = makeCharacter({ level: 5 });
    expect(getCharacterTotalLevel(fighter)).toBe(5);
  });

  it('returns sum of class levels for multiclass character', () => {
    const char = makeCharacter({
      classes: [
        {
          className: 'Fighter',
          level: 4,
          isCustom: false,
          spellcaster: 'none',
          hitDie: 10,
        },
        {
          className: 'Wizard',
          level: 3,
          isCustom: false,
          spellcaster: 'full',
          hitDie: 6,
        },
      ],
      totalLevel: undefined,
    });
    expect(getCharacterTotalLevel(char)).toBe(7);
  });

  it('returns totalLevel when explicitly set', () => {
    const char = makeCharacter({ totalLevel: 12 });
    expect(getCharacterTotalLevel(char)).toBe(12);
  });
});

// ===== hasSpellcasting =====

describe('hasSpellcasting', () => {
  it('returns true for Wizard', () => {
    expect(hasSpellcasting(makeWizard())).toBe(true);
  });

  it('returns true for Warlock', () => {
    expect(hasSpellcasting(makeWarlock())).toBe(true);
  });

  it('returns false for non-spellcaster Fighter', () => {
    const fighter = makeCharacter(); // spellcaster: 'none'
    expect(hasSpellcasting(fighter)).toBe(false);
  });

  it('returns true for multiclass with at least one caster', () => {
    const char = makeCharacter({
      classes: [
        {
          className: 'Fighter',
          level: 3,
          isCustom: false,
          spellcaster: 'none',
          hitDie: 10,
        },
        {
          className: 'Wizard',
          level: 2,
          isCustom: false,
          spellcaster: 'full',
          hitDie: 6,
        },
      ],
    });
    expect(hasSpellcasting(char)).toBe(true);
  });

  it('returns false for multiclass with no casters', () => {
    const char = makeCharacter({
      classes: [
        {
          className: 'Fighter',
          level: 3,
          isCustom: false,
          spellcaster: 'none',
          hitDie: 10,
        },
        {
          className: 'Barbarian',
          level: 2,
          isCustom: false,
          spellcaster: 'none',
          hitDie: 12,
        },
      ],
    });
    expect(hasSpellcasting(char)).toBe(false);
  });
});

// ===== hasWarlockLevels =====

describe('hasWarlockLevels', () => {
  it('returns true for single-class Warlock', () => {
    expect(hasWarlockLevels(makeWarlock())).toBe(true);
  });

  it('returns false for non-warlock single class', () => {
    expect(hasWarlockLevels(makeWizard())).toBe(false);
  });

  it('returns true for multiclass with warlock', () => {
    const char = makeCharacter({
      classes: [
        {
          className: 'Fighter',
          level: 3,
          isCustom: false,
          spellcaster: 'none',
          hitDie: 10,
        },
        {
          className: 'Warlock',
          level: 2,
          isCustom: false,
          spellcaster: 'warlock',
          hitDie: 8,
        },
      ],
    });
    expect(hasWarlockLevels(char)).toBe(true);
  });

  it('returns false for multiclass without warlock', () => {
    const char = makeCharacter({
      classes: [
        {
          className: 'Fighter',
          level: 3,
          isCustom: false,
          spellcaster: 'none',
          hitDie: 10,
        },
        {
          className: 'Wizard',
          level: 2,
          isCustom: false,
          spellcaster: 'full',
          hitDie: 6,
        },
      ],
    });
    expect(hasWarlockLevels(char)).toBe(false);
  });
});
