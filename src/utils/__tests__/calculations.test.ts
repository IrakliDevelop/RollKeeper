import { describe, it, expect } from 'vitest';
import {
  calculateModifier,
  getProficiencyBonus,
  calculateSkillModifier,
  calculateSavingThrowModifier,
  calculateInitiativeModifier,
  calculateTotalArmorClass,
  parseArmorClass,
  calculateCharacterArmorClass,
  getBuffMaxHPBonus,
  getBuffSpeedBonus,
  getBuffSavingThrowBonus,
  calculatePassivePerception,
  calculatePassiveInsight,
  calculatePassiveInvestigation,
  calculateHitPointMaximum,
  calculateCarryingCapacity,
  formatModifier,
  getCalculatedFields,
} from '@/utils/calculations';
import { makeCharacter } from './test-utils';
import { TemporaryBuff } from '@/types/character';

// =============================================
// calculateModifier
// =============================================
describe('calculateModifier', () => {
  it('returns +3 for score 16 (STR of base Fighter)', () => {
    expect(calculateModifier(16)).toBe(3);
  });

  it('returns +2 for score 14 (DEX/CON of base Fighter)', () => {
    expect(calculateModifier(14)).toBe(2);
  });

  it('returns 0 for score 10', () => {
    expect(calculateModifier(10)).toBe(0);
  });

  it('returns -1 for score 8 (CHA of base Fighter)', () => {
    expect(calculateModifier(8)).toBe(-1);
  });

  it('returns +1 for score 12 (WIS of base Fighter)', () => {
    expect(calculateModifier(12)).toBe(1);
  });

  it('floors negative modifiers correctly — score 7 → -2', () => {
    expect(calculateModifier(7)).toBe(-2);
  });

  it('handles score 1 (minimum) → -5', () => {
    expect(calculateModifier(1)).toBe(-5);
  });

  it('handles score 20 → +5', () => {
    expect(calculateModifier(20)).toBe(5);
  });

  it('handles score 11 → 0 (not +0.5)', () => {
    expect(calculateModifier(11)).toBe(0);
  });
});

// =============================================
// getProficiencyBonus
// =============================================
describe('getProficiencyBonus', () => {
  it('returns +2 at level 1', () => {
    expect(getProficiencyBonus(1)).toBe(2);
  });

  it('returns +2 at level 4', () => {
    expect(getProficiencyBonus(4)).toBe(2);
  });

  it('returns +3 at level 5', () => {
    expect(getProficiencyBonus(5)).toBe(3);
  });

  it('returns +3 at level 8', () => {
    expect(getProficiencyBonus(8)).toBe(3);
  });

  it('returns +4 at level 9', () => {
    expect(getProficiencyBonus(9)).toBe(4);
  });

  it('returns +4 at level 12', () => {
    expect(getProficiencyBonus(12)).toBe(4);
  });

  it('returns +5 at level 13', () => {
    expect(getProficiencyBonus(13)).toBe(5);
  });

  it('returns +6 at level 17', () => {
    expect(getProficiencyBonus(17)).toBe(6);
  });

  it('returns +6 at level 20', () => {
    expect(getProficiencyBonus(20)).toBe(6);
  });

  it('clamps below 1 to level 1 bonus (+2)', () => {
    expect(getProficiencyBonus(0)).toBe(2);
  });

  it('clamps above 20 to level 20 bonus (+6)', () => {
    expect(getProficiencyBonus(21)).toBe(6);
  });
});

// =============================================
// calculateSkillModifier
// =============================================
describe('calculateSkillModifier', () => {
  // Base Fighter: level 5, profBonus +3
  // STR 16 (+3), DEX 14 (+2), CON 14 (+2), INT 10 (0), WIS 12 (+1), CHA 8 (-1)
  // Proficient: athletics, intimidation, perception, survival

  it('proficient skill: athletics = STR mod + profBonus = 3 + 3 = 6', () => {
    const char = makeCharacter();
    expect(calculateSkillModifier(char, 'athletics')).toBe(6);
  });

  it('proficient skill: intimidation = CHA mod + profBonus = -1 + 3 = 2', () => {
    const char = makeCharacter();
    expect(calculateSkillModifier(char, 'intimidation')).toBe(2);
  });

  it('proficient skill: perception = WIS mod + profBonus = 1 + 3 = 4', () => {
    const char = makeCharacter();
    expect(calculateSkillModifier(char, 'perception')).toBe(4);
  });

  it('proficient skill: survival = WIS mod + profBonus = 1 + 3 = 4', () => {
    const char = makeCharacter();
    expect(calculateSkillModifier(char, 'survival')).toBe(4);
  });

  it('non-proficient skill: acrobatics = DEX mod = 2', () => {
    const char = makeCharacter();
    expect(calculateSkillModifier(char, 'acrobatics')).toBe(2);
  });

  it('non-proficient skill: stealth = DEX mod = 2', () => {
    const char = makeCharacter();
    expect(calculateSkillModifier(char, 'stealth')).toBe(2);
  });

  it('non-proficient skill: arcana = INT mod = 0', () => {
    const char = makeCharacter();
    expect(calculateSkillModifier(char, 'arcana')).toBe(0);
  });

  it('expertise: perception with expertise = WIS mod + 2×profBonus = 1 + 6 = 7', () => {
    const char = makeCharacter({
      skills: {
        ...makeCharacter().skills,
        perception: { proficient: true, expertise: true },
      },
    });
    expect(calculateSkillModifier(char, 'perception')).toBe(7);
  });

  it('expertise requires proficiency — expertise without proficiency has no effect', () => {
    const char = makeCharacter({
      skills: {
        ...makeCharacter().skills,
        acrobatics: { proficient: false, expertise: true },
      },
    });
    // expertise flag without proficient should not double — just base mod
    expect(calculateSkillModifier(char, 'acrobatics')).toBe(2);
  });

  it('Jack of All Trades: non-proficient skill gets floor(profBonus/2) = floor(3/2) = 1 added', () => {
    const char = makeCharacter({ jackOfAllTrades: true });
    // acrobatics: DEX mod 2 + JoAT 1 = 3
    expect(calculateSkillModifier(char, 'acrobatics')).toBe(3);
  });

  it('Jack of All Trades does NOT apply to proficient skills', () => {
    const char = makeCharacter({ jackOfAllTrades: true });
    // athletics is proficient → stays at 3 + 3 = 6, no extra JoAT
    expect(calculateSkillModifier(char, 'athletics')).toBe(6);
  });

  it('customModifier is added to the result', () => {
    const char = makeCharacter({
      skills: {
        ...makeCharacter().skills,
        arcana: { proficient: false, expertise: false, customModifier: 5 },
      },
    });
    // INT mod 0 + customModifier 5 = 5
    expect(calculateSkillModifier(char, 'arcana')).toBe(5);
  });

  it('bonusAbilities: adds modifier of bonus ability to skill', () => {
    const char = makeCharacter({
      skills: {
        ...makeCharacter().skills,
        // Add WIS (+1) as bonus ability to arcana (INT-based)
        arcana: {
          proficient: false,
          expertise: false,
          bonusAbilities: ['wisdom'],
        },
      },
    });
    // INT mod 0 + WIS mod 1 = 1
    expect(calculateSkillModifier(char, 'arcana')).toBe(1);
  });

  it('bonusAbilities does NOT add the skill own ability again (deduplication)', () => {
    const char = makeCharacter({
      skills: {
        ...makeCharacter().skills,
        // Attempt to add STR as bonus to athletics (already STR-based)
        athletics: {
          proficient: true,
          expertise: false,
          bonusAbilities: ['strength'],
        },
      },
    });
    // Should still be STR mod + profBonus, not doubled
    expect(calculateSkillModifier(char, 'athletics')).toBe(6);
  });
});

// =============================================
// calculateSavingThrowModifier
// =============================================
describe('calculateSavingThrowModifier', () => {
  it('proficient STR save = STR mod + profBonus = 3 + 3 = 6', () => {
    const char = makeCharacter();
    expect(calculateSavingThrowModifier(char, 'strength')).toBe(6);
  });

  it('proficient CON save = CON mod + profBonus = 2 + 3 = 5', () => {
    const char = makeCharacter();
    expect(calculateSavingThrowModifier(char, 'constitution')).toBe(5);
  });

  it('non-proficient DEX save = DEX mod = 2', () => {
    const char = makeCharacter();
    expect(calculateSavingThrowModifier(char, 'dexterity')).toBe(2);
  });

  it('non-proficient CHA save = CHA mod = -1', () => {
    const char = makeCharacter();
    expect(calculateSavingThrowModifier(char, 'charisma')).toBe(-1);
  });

  it('customModifier is added to saving throw', () => {
    const char = makeCharacter({
      savingThrows: {
        ...makeCharacter().savingThrows,
        dexterity: { proficient: false, customModifier: 3 },
      },
    });
    // DEX mod 2 + customModifier 3 = 5
    expect(calculateSavingThrowModifier(char, 'dexterity')).toBe(5);
  });

  it('proficient save with customModifier stacks both', () => {
    const char = makeCharacter({
      savingThrows: {
        ...makeCharacter().savingThrows,
        strength: { proficient: true, customModifier: 2 },
      },
    });
    // STR mod 3 + profBonus 3 + customModifier 2 = 8
    expect(calculateSavingThrowModifier(char, 'strength')).toBe(8);
  });
});

// =============================================
// calculateInitiativeModifier
// =============================================
describe('calculateInitiativeModifier', () => {
  it('returns DEX modifier — DEX 14 → +2', () => {
    const char = makeCharacter();
    expect(calculateInitiativeModifier(char)).toBe(2);
  });

  it('reflects DEX override', () => {
    const char = makeCharacter({
      abilities: { ...makeCharacter().abilities, dexterity: 20 },
    });
    expect(calculateInitiativeModifier(char)).toBe(5);
  });
});

// =============================================
// calculateTotalArmorClass
// =============================================
describe('parseArmorClass', () => {
  it('extracts the leading number from free text', () => {
    expect(parseArmorClass('16 (natural armor)')).toBe(16);
    expect(parseArmorClass('21 (shield spell)')).toBe(21);
  });

  it('handles a bare number string', () => {
    expect(parseArmorClass('18')).toBe(18);
  });

  it('accepts a plain number (legacy data) unchanged', () => {
    expect(parseArmorClass(15)).toBe(15);
  });

  it('falls back to 10 when no number is present', () => {
    expect(parseArmorClass('natural armor')).toBe(10);
    expect(parseArmorClass('')).toBe(10);
  });

  it('parses a number embedded after leading words', () => {
    expect(parseArmorClass('AC 13 leather')).toBe(13);
  });
});

describe('calculateTotalArmorClass', () => {
  it('base AC with no temp and no shield', () => {
    expect(calculateTotalArmorClass(16, 0, false)).toBe(16);
  });

  it('adds tempAC when provided', () => {
    expect(calculateTotalArmorClass(16, 2, false)).toBe(18);
  });

  it('adds default shield bonus (+2) when wearing shield', () => {
    expect(calculateTotalArmorClass(16, 0, true)).toBe(18);
  });

  it('uses custom shield bonus when provided', () => {
    expect(calculateTotalArmorClass(16, 0, true, 3)).toBe(19);
  });

  it('stacks tempAC and shield', () => {
    expect(calculateTotalArmorClass(16, 2, true)).toBe(20);
  });

  it('shield not applied when not wearing it', () => {
    expect(calculateTotalArmorClass(16, 0, false, 5)).toBe(16);
  });
});

// =============================================
// calculateCharacterArmorClass
// =============================================
describe('calculateCharacterArmorClass', () => {
  it('base case: no buffs, no temp AC, no shield → armorClass 16', () => {
    const char = makeCharacter();
    expect(calculateCharacterArmorClass(char)).toBe(16);
  });

  it('applies tempAC when isTempACActive is true', () => {
    const char = makeCharacter({ tempArmorClass: 3, isTempACActive: true });
    expect(calculateCharacterArmorClass(char)).toBe(19);
  });

  it('does NOT apply tempAC when isTempACActive is false', () => {
    const char = makeCharacter({ tempArmorClass: 3, isTempACActive: false });
    expect(calculateCharacterArmorClass(char)).toBe(16);
  });

  it('applies shield bonus when isWearingShield is true', () => {
    const char = makeCharacter({ isWearingShield: true, shieldBonus: 2 });
    expect(calculateCharacterArmorClass(char)).toBe(18);
  });

  const makeActiveBuff = (
    overrides: Partial<TemporaryBuff> = {}
  ): TemporaryBuff => ({
    id: 'buff-1',
    name: 'Test Buff',
    effects: [],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  });

  it('add mode: stacks additively on top of base AC', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        makeActiveBuff({
          effects: [{ id: 'e1', targetStat: 'ac', mode: 'add', value: 2 }],
        }),
      ],
    });
    expect(calculateCharacterArmorClass(char)).toBe(18);
  });

  it('set mode: replaces base AC with the override value', () => {
    const char = makeCharacter({
      armorClass: 10,
      temporaryBuffs: [
        makeActiveBuff({
          effects: [{ id: 'e1', targetStat: 'ac', mode: 'set', value: 13 }],
        }),
      ],
    });
    // override 13, no shield, no additive
    expect(calculateCharacterArmorClass(char)).toBe(13);
  });

  it('set mode: when two set buffs, the higher value wins', () => {
    const char = makeCharacter({
      armorClass: 10,
      temporaryBuffs: [
        makeActiveBuff({
          id: 'buff-1',
          effects: [{ id: 'e1', targetStat: 'ac', mode: 'set', value: 13 }],
        }),
        makeActiveBuff({
          id: 'buff-2',
          effects: [{ id: 'e2', targetStat: 'ac', mode: 'set', value: 17 }],
        }),
      ],
    });
    expect(calculateCharacterArmorClass(char)).toBe(17);
  });

  it('set mode: additive buffs stack on top of the override', () => {
    const char = makeCharacter({
      armorClass: 10,
      temporaryBuffs: [
        makeActiveBuff({
          id: 'buff-1',
          effects: [{ id: 'e1', targetStat: 'ac', mode: 'set', value: 13 }],
        }),
        makeActiveBuff({
          id: 'buff-2',
          effects: [{ id: 'e2', targetStat: 'ac', mode: 'add', value: 2 }],
        }),
      ],
    });
    // set → 13, then +2 add = 15
    expect(calculateCharacterArmorClass(char)).toBe(15);
  });

  it('floor mode: acts as minimum (Barkskin-style)', () => {
    const char = makeCharacter({
      armorClass: 10, // would be 10 without buffs
      temporaryBuffs: [
        makeActiveBuff({
          effects: [{ id: 'e1', targetStat: 'ac', mode: 'floor', value: 16 }],
        }),
      ],
    });
    expect(calculateCharacterArmorClass(char)).toBe(16);
  });

  it('floor mode: does NOT reduce AC when AC is already above floor', () => {
    const char = makeCharacter({
      armorClass: 20,
      temporaryBuffs: [
        makeActiveBuff({
          effects: [{ id: 'e1', targetStat: 'ac', mode: 'floor', value: 16 }],
        }),
      ],
    });
    expect(calculateCharacterArmorClass(char)).toBe(20);
  });

  it('inactive buffs are ignored', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: 'buff-1',
          name: 'Inactive Buff',
          effects: [{ id: 'e1', targetStat: 'ac', mode: 'add', value: 99 }],
          isActive: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(calculateCharacterArmorClass(char)).toBe(16);
  });

  it('set mode: shield still stacks on top of override', () => {
    const char = makeCharacter({
      armorClass: 10,
      isWearingShield: true,
      shieldBonus: 2,
      temporaryBuffs: [
        makeActiveBuff({
          effects: [{ id: 'e1', targetStat: 'ac', mode: 'set', value: 13 }],
        }),
      ],
    });
    // override 13 + shield 2 = 15
    expect(calculateCharacterArmorClass(char)).toBe(15);
  });
});

// =============================================
// getBuffMaxHPBonus
// =============================================
describe('getBuffMaxHPBonus', () => {
  it('returns 0 when no buffs', () => {
    const char = makeCharacter();
    expect(getBuffMaxHPBonus(char)).toBe(0);
  });

  it('sums all active maxHp add buffs', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: 'b1',
          name: 'Aid',
          effects: [{ id: 'e1', targetStat: 'maxHp', mode: 'add', value: 5 }],
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'b2',
          name: 'Aid2',
          effects: [{ id: 'e2', targetStat: 'maxHp', mode: 'add', value: 10 }],
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(getBuffMaxHPBonus(char)).toBe(15);
  });

  it('ignores inactive maxHp buffs', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: 'b1',
          name: 'Inactive Aid',
          effects: [{ id: 'e1', targetStat: 'maxHp', mode: 'add', value: 5 }],
          isActive: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(getBuffMaxHPBonus(char)).toBe(0);
  });

  it('ignores non-maxHp buff effects', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: 'b1',
          name: 'Haste',
          effects: [{ id: 'e1', targetStat: 'ac', mode: 'add', value: 2 }],
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(getBuffMaxHPBonus(char)).toBe(0);
  });
});

// =============================================
// getBuffSpeedBonus
// =============================================
describe('getBuffSpeedBonus', () => {
  it('returns 0 when no buffs', () => {
    const char = makeCharacter();
    expect(getBuffSpeedBonus(char)).toBe(0);
  });

  it('sums all active speed add buffs', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: 'b1',
          name: 'Longstrider',
          effects: [{ id: 'e1', targetStat: 'speed', mode: 'add', value: 10 }],
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'b2',
          name: 'Haste',
          effects: [{ id: 'e2', targetStat: 'speed', mode: 'add', value: 30 }],
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(getBuffSpeedBonus(char)).toBe(40);
  });

  it('ignores inactive speed buffs', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: 'b1',
          name: 'Longstrider',
          effects: [{ id: 'e1', targetStat: 'speed', mode: 'add', value: 10 }],
          isActive: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(getBuffSpeedBonus(char)).toBe(0);
  });
});

// =============================================
// getBuffSavingThrowBonus
// =============================================
describe('getBuffSavingThrowBonus', () => {
  it('returns 0 when no buffs', () => {
    const char = makeCharacter();
    expect(getBuffSavingThrowBonus(char, 'strength')).toBe(0);
  });

  it('returns bonus for all-ability saving throw buff (no targetAbility)', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: 'b1',
          name: 'Bless',
          effects: [
            { id: 'e1', targetStat: 'savingThrow', mode: 'add', value: 4 },
          ],
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(getBuffSavingThrowBonus(char, 'strength')).toBe(4);
    expect(getBuffSavingThrowBonus(char, 'dexterity')).toBe(4);
  });

  it('returns bonus only for the targeted ability', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: 'b1',
          name: 'DEX Save Buff',
          effects: [
            {
              id: 'e1',
              targetStat: 'savingThrow',
              mode: 'add',
              value: 3,
              targetAbility: 'dexterity',
            },
          ],
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(getBuffSavingThrowBonus(char, 'dexterity')).toBe(3);
    expect(getBuffSavingThrowBonus(char, 'strength')).toBe(0);
  });

  it('ignores inactive saving throw buffs', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: 'b1',
          name: 'Bless',
          effects: [
            { id: 'e1', targetStat: 'savingThrow', mode: 'add', value: 4 },
          ],
          isActive: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(getBuffSavingThrowBonus(char, 'strength')).toBe(0);
  });
});

// =============================================
// calculatePassivePerception
// =============================================
describe('calculatePassivePerception', () => {
  it('10 + perception skill modifier', () => {
    const char = makeCharacter();
    // perception is proficient: WIS mod 1 + profBonus 3 = 4 → passive = 14
    expect(calculatePassivePerception(char)).toBe(14);
  });

  it('reflects expertise on perception', () => {
    const char = makeCharacter({
      skills: {
        ...makeCharacter().skills,
        perception: { proficient: true, expertise: true },
      },
    });
    // perception mod = 1 + 6 = 7 → passive = 17
    expect(calculatePassivePerception(char)).toBe(17);
  });
});

// =============================================
// calculatePassiveInsight
// =============================================
describe('calculatePassiveInsight', () => {
  it('10 + insight skill modifier', () => {
    const char = makeCharacter();
    // insight non-proficient: WIS mod 1 → passive = 11
    expect(calculatePassiveInsight(char)).toBe(11);
  });
});

// =============================================
// calculatePassiveInvestigation
// =============================================
describe('calculatePassiveInvestigation', () => {
  it('10 + investigation skill modifier', () => {
    const char = makeCharacter();
    // investigation non-proficient: INT mod 0 → passive = 10
    expect(calculatePassiveInvestigation(char)).toBe(10);
  });
});

// =============================================
// calculateHitPointMaximum
// =============================================
describe('calculateHitPointMaximum', () => {
  // Formula: level 1: hitDieType + CON mod
  //          subsequent: (level-1) * (floor(hitDieType/2) + 1 + CON mod)
  // Fighter (d10), CON 14 → mod +2, level 5:
  //   level 1: 10 + 2 = 12
  //   levels 2-5: 4 * (5 + 1 + 2) = 4 * 8 = 32
  //   total: 12 + 32 = 44

  it('Fighter d10 level 5 CON 14 = 44', () => {
    const char = makeCharacter();
    expect(calculateHitPointMaximum(char, 10)).toBe(44);
  });

  it('uses default d8 when no hitDieType provided', () => {
    const char = makeCharacter();
    // level 1: 8 + 2 = 10; levels 2-5: 4 * (4+1+2) = 4*7 = 28; total 38
    expect(calculateHitPointMaximum(char)).toBe(38);
  });

  it('level 1 character gets max hit die + CON', () => {
    const char = makeCharacter({ level: 1 });
    // d10: 10 + 2 = 12
    expect(calculateHitPointMaximum(char, 10)).toBe(12);
  });

  it('minimum HP is 1 even with very low CON at level 1', () => {
    const char = makeCharacter({
      level: 1,
      abilities: { ...makeCharacter().abilities, constitution: 1 },
    });
    // d4: 4 + (-5) = -1 → clamped to 1
    expect(calculateHitPointMaximum(char, 4)).toBe(1);
  });
});

// =============================================
// calculateCarryingCapacity
// =============================================
describe('calculateCarryingCapacity', () => {
  it('STR 16 × 15 = 240', () => {
    const char = makeCharacter();
    expect(calculateCarryingCapacity(char)).toBe(240);
  });

  it('STR 10 × 15 = 150', () => {
    const char = makeCharacter({
      abilities: { ...makeCharacter().abilities, strength: 10 },
    });
    expect(calculateCarryingCapacity(char)).toBe(150);
  });

  it('STR 20 × 15 = 300', () => {
    const char = makeCharacter({
      abilities: { ...makeCharacter().abilities, strength: 20 },
    });
    expect(calculateCarryingCapacity(char)).toBe(300);
  });
});

// =============================================
// formatModifier
// =============================================
describe('formatModifier', () => {
  it('positive modifier gets + prefix', () => {
    expect(formatModifier(3)).toBe('+3');
  });

  it('zero gets + prefix (+0)', () => {
    expect(formatModifier(0)).toBe('+0');
  });

  it('negative modifier has no extra prefix (just the minus)', () => {
    expect(formatModifier(-1)).toBe('-1');
  });

  it('large positive', () => {
    expect(formatModifier(10)).toBe('+10');
  });

  it('large negative', () => {
    expect(formatModifier(-5)).toBe('-5');
  });
});

// =============================================
// getCalculatedFields
// =============================================
describe('getCalculatedFields', () => {
  it('returns proficiencyBonus = 3 for level 5', () => {
    const char = makeCharacter();
    const fields = getCalculatedFields(char);
    expect(fields.proficiencyBonus).toBe(3);
  });

  it('returns all ability modifiers correctly', () => {
    const char = makeCharacter();
    const { abilityModifiers } = getCalculatedFields(char);
    expect(abilityModifiers.strength).toBe(3);
    expect(abilityModifiers.dexterity).toBe(2);
    expect(abilityModifiers.constitution).toBe(2);
    expect(abilityModifiers.intelligence).toBe(0);
    expect(abilityModifiers.wisdom).toBe(1);
    expect(abilityModifiers.charisma).toBe(-1);
  });

  it('returns skill modifiers for proficient skills', () => {
    const char = makeCharacter();
    const { skillModifiers } = getCalculatedFields(char);
    expect(skillModifiers.athletics).toBe(6);
    expect(skillModifiers.intimidation).toBe(2);
    expect(skillModifiers.perception).toBe(4);
    expect(skillModifiers.survival).toBe(4);
  });

  it('returns skill modifiers for non-proficient skills', () => {
    const char = makeCharacter();
    const { skillModifiers } = getCalculatedFields(char);
    expect(skillModifiers.acrobatics).toBe(2);
    expect(skillModifiers.arcana).toBe(0);
  });

  it('returns saving throw modifiers', () => {
    const char = makeCharacter();
    const { savingThrowModifiers } = getCalculatedFields(char);
    expect(savingThrowModifiers.strength).toBe(6); // proficient
    expect(savingThrowModifiers.constitution).toBe(5); // proficient
    expect(savingThrowModifiers.dexterity).toBe(2); // not proficient
    expect(savingThrowModifiers.charisma).toBe(-1); // not proficient
  });

  it('returns initiativeModifier = DEX mod = 2', () => {
    const char = makeCharacter();
    const fields = getCalculatedFields(char);
    expect(fields.initiativeModifier).toBe(2);
  });

  it('returns passivePerception = 14', () => {
    const char = makeCharacter();
    const fields = getCalculatedFields(char);
    expect(fields.passivePerception).toBe(14);
  });

  it('returns carryingCapacity = 240 (STR 16 × 15)', () => {
    const char = makeCharacter();
    const fields = getCalculatedFields(char);
    expect(fields.carryingCapacity).toBe(240);
  });

  it('all skill modifier keys are present', () => {
    const char = makeCharacter();
    const { skillModifiers } = getCalculatedFields(char);
    const expectedSkills = [
      'acrobatics',
      'animalHandling',
      'arcana',
      'athletics',
      'deception',
      'history',
      'insight',
      'intimidation',
      'investigation',
      'medicine',
      'nature',
      'perception',
      'performance',
      'persuasion',
      'religion',
      'sleightOfHand',
      'stealth',
      'survival',
    ];
    for (const skill of expectedSkills) {
      expect(skill in skillModifiers).toBe(true);
    }
  });
});
