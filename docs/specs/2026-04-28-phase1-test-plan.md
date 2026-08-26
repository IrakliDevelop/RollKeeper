# Phase 1: Pure Utility Function Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive unit tests for all pure utility functions to create a safety net for refactoring D&D math, data conversion, and parsing logic.

**Architecture:** Each test file lives in `__tests__/` adjacent to its source file. Tests import functions directly and verify input/output pairs. The existing mock helper `createMockCharacterState` doesn't match the actual `CharacterState` type shape used by calculations (abilities are plain numbers, skills use `SkillProficiency` objects with `proficient`/`expertise` booleans). Task 1 creates a proper test factory.

**Tech Stack:** Vitest, jsdom environment, `@/` path alias to `src/`

**Important:** The existing `createMockCharacterState` in `src/test/helpers.ts` uses a different data shape (abilities as nested objects, skills as `{ proficiency: string }`) than the actual `CharacterState` type (abilities as plain numbers, skills as `{ proficient: boolean, expertise: boolean }`). Task 1 creates a purpose-built factory for calculation tests.

---

### Task 1: Test helper — character factory for calculations

**Files:**
- Create: `src/utils/__tests__/test-utils.ts`

- [ ] **Step 1: Create the character factory**

```typescript
import { CharacterState, ClassInfo, SkillProficiency } from '@/types/character';

const defaultSkill: SkillProficiency = {
  proficient: false,
  expertise: false,
};

const proficientSkill: SkillProficiency = {
  proficient: true,
  expertise: false,
};

export function makeCharacter(
  overrides: Partial<CharacterState> = {}
): CharacterState {
  return {
    id: 'test-char-1',
    name: 'Test Hero',
    race: 'Human',
    class: {
      name: 'Fighter',
      isCustom: false,
      spellcaster: 'none',
      hitDie: 10,
    },
    level: 5,
    totalLevel: 5,
    experience: 6500,
    background: 'Soldier',
    alignment: 'Neutral Good',
    creatureType: 'Humanoid',
    playerName: 'Tester',
    abilities: {
      strength: 16,
      dexterity: 14,
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 8,
    },
    skills: {
      acrobatics: { ...defaultSkill },
      animalHandling: { ...defaultSkill },
      arcana: { ...defaultSkill },
      athletics: { ...proficientSkill },
      deception: { ...defaultSkill },
      history: { ...defaultSkill },
      insight: { ...defaultSkill },
      intimidation: { ...proficientSkill },
      investigation: { ...defaultSkill },
      medicine: { ...defaultSkill },
      nature: { ...defaultSkill },
      perception: { ...proficientSkill },
      performance: { ...defaultSkill },
      persuasion: { ...defaultSkill },
      religion: { ...defaultSkill },
      sleightOfHand: { ...defaultSkill },
      stealth: { ...defaultSkill },
      survival: { ...proficientSkill },
    },
    savingThrows: {
      strength: { proficient: true },
      dexterity: { proficient: false },
      constitution: { proficient: true },
      intelligence: { proficient: false },
      wisdom: { proficient: false },
      charisma: { proficient: false },
    },
    hitPoints: {
      current: 44,
      max: 44,
      temporary: 0,
      calculationMode: 'auto' as const,
    },
    armorClass: 16,
    tempArmorClass: 0,
    isTempACActive: false,
    isWearingShield: false,
    shieldBonus: 2,
    initiative: { value: 2, isOverridden: false },
    reaction: { hasUsedReaction: false },
    speed: 30,
    hitDice: '5d10',
    spellSlots: {
      1: { max: 0, used: 0 },
      2: { max: 0, used: 0 },
      3: { max: 0, used: 0 },
      4: { max: 0, used: 0 },
      5: { max: 0, used: 0 },
      6: { max: 0, used: 0 },
      7: { max: 0, used: 0 },
      8: { max: 0, used: 0 },
      9: { max: 0, used: 0 },
    },
    heroicInspiration: { count: 0, maxCount: 1 },
    trackableTraits: [],
    extendedFeatures: [],
    favoriteFeatureIds: [],
    features: [],
    traits: [],
    notes: [],
    characterBackground: {
      backstory: '',
      personalityTraits: '',
      ideals: '',
      bonds: '',
      flaws: '',
    },
    weapons: [],
    magicItems: [],
    armorItems: [],
    inventoryItems: [],
    currency: { gold: 0, silver: 0, copper: 0, electrum: 0, platinum: 0 },
    attunementSlots: { max: 3, used: 0 },
    weaponProficiencies: {
      simpleWeapons: true,
      martialWeapons: true,
      specificWeapons: [],
    },
    spells: [],
    spellcastingStats: {
      spellcastingAbility: 'intelligence',
      isAbilityOverridden: false,
    },
    concentration: { isConcentrating: false },
    deathSavingThrows: { successes: 0, failures: 0, isStabilized: false },
    spellbook: {
      knownSpellIds: [],
      preparedSpellIds: [],
      favoriteSpellIds: [],
      customSpells: [],
      spellbookSettings: { showPreparedOnly: false },
    },
    conditionsAndDiseases: {
      conditions: [],
      diseases: [],
      exhaustionVariant: '2014',
    },
    damageImmunities: [],
    damageResistances: [],
    conditionImmunities: [],
    senses: [],
    temporaryBuffs: [],
    summons: [],
    jackOfAllTrades: false,
    daysSpent: 0,
    shareHpWithParty: true,
    ...overrides,
  } as CharacterState;
}

export function makeWizard(
  overrides: Partial<CharacterState> = {}
): CharacterState {
  return makeCharacter({
    class: {
      name: 'Wizard',
      isCustom: false,
      spellcaster: 'full',
      hitDie: 6,
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 12,
      intelligence: 18,
      wisdom: 13,
      charisma: 10,
    },
    spellcastingStats: {
      spellcastingAbility: 'intelligence',
      isAbilityOverridden: false,
    },
    ...overrides,
  });
}

export function makeWarlock(
  overrides: Partial<CharacterState> = {}
): CharacterState {
  return makeCharacter({
    class: {
      name: 'Warlock',
      isCustom: false,
      spellcaster: 'warlock',
      hitDie: 8,
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 18,
    },
    spellcastingStats: {
      spellcastingAbility: 'charisma',
      isAbilityOverridden: false,
    },
    ...overrides,
  });
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/utils/__tests__/test-utils.ts 2>&1 | head -20`

If there are type errors from missing optional fields on `CharacterState`, add them with sensible defaults. The `as CharacterState` cast handles most of it, but fix any obvious mismatches.

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/test-utils.ts
git commit -m "test: add character factory for calculation tests"
```

---

### Task 2: Tests for calculations.ts — core math

**Files:**
- Create: `src/utils/__tests__/calculations.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateModifier,
  getProficiencyBonus,
  calculateSkillModifier,
  calculateSavingThrowModifier,
  calculateInitiativeModifier,
  calculateTotalArmorClass,
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

// ── calculateModifier ────────────────────────────────────────

describe('calculateModifier', () => {
  it('returns 0 for score 10', () => {
    expect(calculateModifier(10)).toBe(0);
  });

  it('returns 0 for score 11', () => {
    expect(calculateModifier(11)).toBe(0);
  });

  it('returns +1 for score 12', () => {
    expect(calculateModifier(12)).toBe(1);
  });

  it('returns +5 for score 20', () => {
    expect(calculateModifier(20)).toBe(5);
  });

  it('returns -1 for score 8', () => {
    expect(calculateModifier(8)).toBe(-1);
  });

  it('returns -5 for score 1', () => {
    expect(calculateModifier(1)).toBe(-5);
  });

  it('returns +10 for score 30', () => {
    expect(calculateModifier(30)).toBe(10);
  });
});

// ── getProficiencyBonus ──────────────────────────────────────

describe('getProficiencyBonus', () => {
  it('returns +2 for levels 1–4', () => {
    expect(getProficiencyBonus(1)).toBe(2);
    expect(getProficiencyBonus(4)).toBe(2);
  });

  it('returns +3 for levels 5–8', () => {
    expect(getProficiencyBonus(5)).toBe(3);
    expect(getProficiencyBonus(8)).toBe(3);
  });

  it('returns +4 for levels 9–12', () => {
    expect(getProficiencyBonus(9)).toBe(4);
    expect(getProficiencyBonus(12)).toBe(4);
  });

  it('returns +5 for levels 13–16', () => {
    expect(getProficiencyBonus(13)).toBe(5);
    expect(getProficiencyBonus(16)).toBe(5);
  });

  it('returns +6 for levels 17–20', () => {
    expect(getProficiencyBonus(17)).toBe(6);
    expect(getProficiencyBonus(20)).toBe(6);
  });

  it('clamps level 0 to +2', () => {
    expect(getProficiencyBonus(0)).toBe(2);
  });

  it('clamps level 25 to +6', () => {
    expect(getProficiencyBonus(25)).toBe(6);
  });
});

// ── calculateSkillModifier ───────────────────────────────────

describe('calculateSkillModifier', () => {
  it('returns ability mod for non-proficient skill', () => {
    const char = makeCharacter();
    // Arcana: INT 10 → mod 0, not proficient
    expect(calculateSkillModifier(char, 'arcana')).toBe(0);
  });

  it('adds proficiency bonus for proficient skill', () => {
    const char = makeCharacter();
    // Athletics: STR 16 → mod +3, proficient, level 5 → prof +3 = 6
    expect(calculateSkillModifier(char, 'athletics')).toBe(6);
  });

  it('adds half proficiency for Jack of All Trades on non-proficient skills', () => {
    const char = makeCharacter({ jackOfAllTrades: true });
    // Arcana: INT 10 → mod 0, not proficient, JoAT → floor(3/2)=1
    expect(calculateSkillModifier(char, 'arcana')).toBe(1);
  });

  it('does not apply Jack of All Trades to proficient skills', () => {
    const char = makeCharacter({ jackOfAllTrades: true });
    // Athletics: STR 16 → mod +3, proficient → +3 prof = 6 (not +1 JoAT)
    expect(calculateSkillModifier(char, 'athletics')).toBe(6);
  });

  it('doubles proficiency for expertise', () => {
    const char = makeCharacter({
      skills: {
        ...makeCharacter().skills,
        perception: { proficient: true, expertise: true },
      },
    });
    // Perception: WIS 12 → mod +1, proficient + expertise → +3 + +3 = 7
    expect(calculateSkillModifier(char, 'perception')).toBe(7);
  });

  it('does not grant expertise bonus without proficiency', () => {
    const char = makeCharacter({
      skills: {
        ...makeCharacter().skills,
        arcana: { proficient: false, expertise: true },
      },
    });
    // Arcana: INT 10 → mod 0, not proficient, expertise ignored
    expect(calculateSkillModifier(char, 'arcana')).toBe(0);
  });

  it('includes custom modifier', () => {
    const char = makeCharacter({
      skills: {
        ...makeCharacter().skills,
        stealth: { proficient: false, expertise: false, customModifier: 5 },
      },
    });
    // Stealth: DEX 14 → mod +2, custom +5 = 7
    expect(calculateSkillModifier(char, 'stealth')).toBe(7);
  });

  it('includes bonus abilities', () => {
    const char = makeCharacter({
      skills: {
        ...makeCharacter().skills,
        arcana: {
          proficient: false,
          expertise: false,
          bonusAbilities: ['wisdom'],
        },
      },
    });
    // Arcana: INT 10 → mod 0, bonus WIS 12 → mod +1 = 1
    expect(calculateSkillModifier(char, 'arcana')).toBe(1);
  });
});

// ── calculateSavingThrowModifier ─────────────────────────────

describe('calculateSavingThrowModifier', () => {
  it('returns ability mod without proficiency', () => {
    const char = makeCharacter();
    // DEX 14 → mod +2, not proficient
    expect(calculateSavingThrowModifier(char, 'dexterity')).toBe(2);
  });

  it('adds proficiency bonus when proficient', () => {
    const char = makeCharacter();
    // STR 16 → mod +3, proficient, level 5 prof +3 = 6
    expect(calculateSavingThrowModifier(char, 'strength')).toBe(6);
  });

  it('includes custom modifier', () => {
    const char = makeCharacter({
      savingThrows: {
        ...makeCharacter().savingThrows,
        wisdom: { proficient: false, customModifier: 3 },
      },
    });
    // WIS 12 → mod +1, custom +3 = 4
    expect(calculateSavingThrowModifier(char, 'wisdom')).toBe(4);
  });
});

// ── calculateInitiativeModifier ──────────────────────────────

describe('calculateInitiativeModifier', () => {
  it('returns dexterity modifier', () => {
    const char = makeCharacter(); // DEX 14 → +2
    expect(calculateInitiativeModifier(char)).toBe(2);
  });

  it('returns negative for low dexterity', () => {
    const char = makeCharacter({
      abilities: { ...makeCharacter().abilities, dexterity: 8 },
    });
    expect(calculateInitiativeModifier(char)).toBe(-1);
  });
});

// ── calculateTotalArmorClass ─────────────────────────────────

describe('calculateTotalArmorClass', () => {
  it('returns base AC with no bonuses', () => {
    expect(calculateTotalArmorClass(14, 0, false)).toBe(14);
  });

  it('adds temp AC', () => {
    expect(calculateTotalArmorClass(14, 2, false)).toBe(16);
  });

  it('adds default shield bonus of 2', () => {
    expect(calculateTotalArmorClass(14, 0, true)).toBe(16);
  });

  it('adds custom shield bonus', () => {
    expect(calculateTotalArmorClass(14, 0, true, 3)).toBe(17);
  });

  it('combines all bonuses', () => {
    expect(calculateTotalArmorClass(14, 2, true, 3)).toBe(19);
  });
});

// ── calculateCharacterArmorClass ─────────────────────────────

describe('calculateCharacterArmorClass', () => {
  it('returns base AC for character with no buffs', () => {
    const char = makeCharacter({ armorClass: 16 });
    expect(calculateCharacterArmorClass(char)).toBe(16);
  });

  it('includes shield when worn', () => {
    const char = makeCharacter({
      armorClass: 16,
      isWearingShield: true,
      shieldBonus: 2,
    });
    expect(calculateCharacterArmorClass(char)).toBe(18);
  });

  it('includes temp AC when active', () => {
    const char = makeCharacter({
      armorClass: 16,
      tempArmorClass: 2,
      isTempACActive: true,
    });
    expect(calculateCharacterArmorClass(char)).toBe(18);
  });

  it('ignores temp AC when not active', () => {
    const char = makeCharacter({
      armorClass: 16,
      tempArmorClass: 2,
      isTempACActive: false,
    });
    expect(calculateCharacterArmorClass(char)).toBe(16);
  });

  it('applies additive buff effects', () => {
    const char = makeCharacter({
      armorClass: 14,
      temporaryBuffs: [
        {
          id: 'buff-1',
          name: 'Shield of Faith',
          isActive: true,
          effects: [{ targetStat: 'ac', mode: 'add', value: 2 }],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    expect(calculateCharacterArmorClass(char)).toBe(16);
  });

  it('applies set override (highest wins)', () => {
    const char = makeCharacter({
      armorClass: 10,
      temporaryBuffs: [
        {
          id: 'buff-1',
          name: 'Mage Armor',
          isActive: true,
          effects: [{ targetStat: 'ac', mode: 'set', value: 13 }],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    // Set replaces base; no shield
    expect(calculateCharacterArmorClass(char)).toBe(13);
  });

  it('applies floor effect (Barkskin-style)', () => {
    const char = makeCharacter({
      armorClass: 10,
      temporaryBuffs: [
        {
          id: 'buff-1',
          name: 'Barkskin',
          isActive: true,
          effects: [{ targetStat: 'ac', mode: 'floor', value: 16 }],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    expect(calculateCharacterArmorClass(char)).toBe(16);
  });

  it('ignores inactive buffs', () => {
    const char = makeCharacter({
      armorClass: 14,
      temporaryBuffs: [
        {
          id: 'buff-1',
          name: 'Expired',
          isActive: false,
          effects: [{ targetStat: 'ac', mode: 'add', value: 5 }],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    expect(calculateCharacterArmorClass(char)).toBe(14);
  });
});

// ── Buff bonus functions ─────────────────────────────────────

describe('getBuffMaxHPBonus', () => {
  it('returns 0 with no buffs', () => {
    expect(getBuffMaxHPBonus(makeCharacter())).toBe(0);
  });

  it('sums active maxHp add buffs', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: '1',
          name: 'Aid',
          isActive: true,
          effects: [{ targetStat: 'maxHp', mode: 'add', value: 5 }],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    expect(getBuffMaxHPBonus(char)).toBe(5);
  });
});

describe('getBuffSpeedBonus', () => {
  it('sums active speed add buffs', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: '1',
          name: 'Longstrider',
          isActive: true,
          effects: [{ targetStat: 'speed', mode: 'add', value: 10 }],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    expect(getBuffSpeedBonus(char)).toBe(10);
  });
});

describe('getBuffSavingThrowBonus', () => {
  it('returns bonus for matching ability', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: '1',
          name: 'Bless',
          isActive: true,
          effects: [
            {
              targetStat: 'savingThrow',
              mode: 'add',
              value: 2,
              targetAbility: 'wisdom',
            },
          ],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    expect(getBuffSavingThrowBonus(char, 'wisdom')).toBe(2);
    expect(getBuffSavingThrowBonus(char, 'strength')).toBe(0);
  });

  it('returns bonus for any ability when targetAbility is undefined', () => {
    const char = makeCharacter({
      temporaryBuffs: [
        {
          id: '1',
          name: 'Bless',
          isActive: true,
          effects: [{ targetStat: 'savingThrow', mode: 'add', value: 2 }],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    expect(getBuffSavingThrowBonus(char, 'strength')).toBe(2);
  });
});

// ── Passive scores ───────────────────────────────────────────

describe('calculatePassivePerception', () => {
  it('returns 10 + perception modifier', () => {
    const char = makeCharacter();
    // Perception proficient, WIS 12 → +1 + prof +3 = +4 → passive 14
    expect(calculatePassivePerception(char)).toBe(14);
  });
});

describe('calculatePassiveInsight', () => {
  it('returns 10 + insight modifier', () => {
    const char = makeCharacter();
    // Insight not proficient, WIS 12 → +1 → passive 11
    expect(calculatePassiveInsight(char)).toBe(11);
  });
});

describe('calculatePassiveInvestigation', () => {
  it('returns 10 + investigation modifier', () => {
    const char = makeCharacter();
    // Investigation not proficient, INT 10 → +0 → passive 10
    expect(calculatePassiveInvestigation(char)).toBe(10);
  });
});

// ── calculateHitPointMaximum ─────────────────────────────────

describe('calculateHitPointMaximum', () => {
  it('calculates level 1 HP as max die + CON mod', () => {
    // d8 fighter, CON 14 → mod +2 → 8 + 2 = 10
    const char = makeCharacter({ level: 1 });
    expect(calculateHitPointMaximum(char, 8)).toBe(10);
  });

  it('uses average hit die roll for subsequent levels', () => {
    // d10, level 5, CON 14 → mod +2
    // Level 1: 10 + 2 = 12
    // Levels 2–5: 4 × (6 + 2) = 32
    // Total: 44
    const char = makeCharacter({ level: 5 });
    expect(calculateHitPointMaximum(char, 10)).toBe(44);
  });

  it('returns at least 1 HP', () => {
    // d6, level 1, CON 1 → mod -5 → 6 + (-5) = 1, min 1
    const char = makeCharacter({
      level: 1,
      abilities: { ...makeCharacter().abilities, constitution: 1 },
    });
    expect(calculateHitPointMaximum(char, 6)).toBeGreaterThanOrEqual(1);
  });
});

// ── calculateCarryingCapacity ────────────────────────────────

describe('calculateCarryingCapacity', () => {
  it('returns strength × 15', () => {
    const char = makeCharacter(); // STR 16 → 240
    expect(calculateCarryingCapacity(char)).toBe(240);
  });
});

// ── formatModifier ───────────────────────────────────────────

describe('formatModifier', () => {
  it('formats positive as +N', () => {
    expect(formatModifier(3)).toBe('+3');
  });

  it('formats zero as +0', () => {
    expect(formatModifier(0)).toBe('+0');
  });

  it('formats negative as -N', () => {
    expect(formatModifier(-2)).toBe('-2');
  });
});

// ── getCalculatedFields ──────────────────────────────────────

describe('getCalculatedFields', () => {
  it('returns all derived stats for a character', () => {
    const char = makeCharacter();
    const fields = getCalculatedFields(char);

    expect(fields.proficiencyBonus).toBe(3);
    expect(fields.abilityModifiers.strength).toBe(3);
    expect(fields.abilityModifiers.dexterity).toBe(2);
    expect(fields.abilityModifiers.constitution).toBe(2);
    expect(fields.abilityModifiers.intelligence).toBe(0);
    expect(fields.abilityModifiers.wisdom).toBe(1);
    expect(fields.abilityModifiers.charisma).toBe(-1);
    expect(fields.initiativeModifier).toBe(2);
    expect(fields.passivePerception).toBe(14);
    expect(fields.carryingCapacity).toBe(240);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/utils/__tests__/calculations.test.ts`

Expected: All tests pass. If any type errors occur, adjust the `makeCharacter` factory in `test-utils.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/calculations.test.ts
git commit -m "test: add core math tests for calculations.ts"
```

---

### Task 3: Tests for calculations.ts — weapons, spells, XP

**Files:**
- Create: `src/utils/__tests__/calculations-weapons-spells.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import {
  isWeaponProficient,
  getWeaponAbilityModifier,
  calculateWeaponAttackBonus,
  calculateWeaponDamageBonus,
  getWeaponAttackString,
  getWeaponDamageString,
  calculateSpellSlots,
  calculatePactMagic,
  updateSpellSlotsPreservingUsed,
  hasSpellSlots,
  calculateLevelFromXP,
  getXPForLevel,
  getXPToNextLevel,
  getXPProgress,
  shouldLevelUp,
  getClassSpellcastingAbility,
  getCharacterSpellcastingAbility,
  calculateSpellAttackBonus,
  calculateSpellSaveDC,
  isSpellcaster,
  getSpellcastingAbilityModifier,
  getSpellAttackString,
  getSpellSaveDCString,
  calculateTraitMaxUses,
  calculateWeaponChargeMax,
  calculateMagicItemChargeMax,
  calculateCharacterSpellSlots,
  calculateMulticlassSpellSlots,
  calculateCharacterPactMagic,
  calculateCharacterHitDicePools,
  getCharacterTotalLevel,
  hasSpellcasting,
  hasWarlockLevels,
} from '@/utils/calculations';
import { Weapon } from '@/types/character';
import { makeCharacter, makeWizard, makeWarlock } from './test-utils';

// ── Weapon calculations ──────────────────────────────────────

const makeSword = (overrides: Partial<Weapon> = {}): Weapon =>
  ({
    id: 'w1',
    name: 'Longsword',
    category: 'martial',
    weaponType: ['melee'],
    damage: [{ dice: '1d8', type: 'slashing', label: 'Slashing' }],
    enhancementBonus: 0,
    isEquipped: true,
    properties: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }) as Weapon;

describe('isWeaponProficient', () => {
  it('returns true for martial weapon with martial proficiency', () => {
    const char = makeCharacter();
    expect(isWeaponProficient(char, makeSword())).toBe(true);
  });

  it('returns false when not proficient', () => {
    const char = makeCharacter({
      weaponProficiencies: {
        simpleWeapons: true,
        martialWeapons: false,
        specificWeapons: [],
      },
    });
    expect(isWeaponProficient(char, makeSword())).toBe(false);
  });

  it('returns true for specific weapon proficiency', () => {
    const char = makeCharacter({
      weaponProficiencies: {
        simpleWeapons: false,
        martialWeapons: false,
        specificWeapons: ['longsword'],
      },
    });
    expect(isWeaponProficient(char, makeSword())).toBe(true);
  });

  it('respects manual proficiency override', () => {
    const char = makeCharacter();
    expect(
      isWeaponProficient(char, makeSword({ manualProficiency: false }))
    ).toBe(false);
  });
});

describe('getWeaponAbilityModifier', () => {
  it('uses STR for melee weapons', () => {
    const char = makeCharacter(); // STR 16 → +3
    expect(getWeaponAbilityModifier(char, makeSword())).toBe(3);
  });

  it('uses DEX for ranged weapons', () => {
    const char = makeCharacter(); // DEX 14 → +2
    const bow = makeSword({ weaponType: ['ranged'] });
    expect(getWeaponAbilityModifier(char, bow)).toBe(2);
  });

  it('uses higher of STR/DEX for finesse weapons', () => {
    const char = makeCharacter(); // STR 16 (+3) > DEX 14 (+2)
    const rapier = makeSword({ weaponType: ['finesse'] });
    expect(getWeaponAbilityModifier(char, rapier)).toBe(3);
  });

  it('uses ability override when set', () => {
    const char = makeCharacter(); // CHA 8 → -1
    const pactBlade = makeSword({ abilityOverride: 'charisma' });
    expect(getWeaponAbilityModifier(char, pactBlade)).toBe(-1);
  });
});

describe('calculateWeaponAttackBonus', () => {
  it('combines ability mod + proficiency + enhancement', () => {
    const char = makeCharacter(); // STR +3, prof +3
    const sword = makeSword({ enhancementBonus: 1 });
    // 3 + 3 + 1 = 7
    expect(calculateWeaponAttackBonus(char, sword)).toBe(7);
  });

  it('excludes proficiency when not proficient', () => {
    const char = makeCharacter({
      weaponProficiencies: {
        simpleWeapons: false,
        martialWeapons: false,
        specificWeapons: [],
      },
    });
    // STR +3, no prof, no enhancement = 3
    expect(calculateWeaponAttackBonus(char, makeSword())).toBe(3);
  });
});

describe('calculateWeaponDamageBonus', () => {
  it('returns ability mod + enhancement', () => {
    const char = makeCharacter(); // STR +3
    expect(calculateWeaponDamageBonus(char, makeSword({ enhancementBonus: 2 }))).toBe(5);
  });
});

describe('getWeaponAttackString', () => {
  it('formats as "+N to hit"', () => {
    const char = makeCharacter();
    expect(getWeaponAttackString(char, makeSword())).toBe('+6 to hit');
  });
});

describe('getWeaponDamageString', () => {
  it('formats damage with bonus', () => {
    const char = makeCharacter();
    // STR +3, enhancement 0 → "1d8+3 slashing"
    expect(getWeaponDamageString(char, makeSword())).toBe('1d8+3 slashing');
  });

  it('returns "No damage" for empty damage array', () => {
    const char = makeCharacter();
    expect(getWeaponDamageString(char, makeSword({ damage: [] }))).toBe(
      'No damage'
    );
  });
});

// ── Spell slot calculations ──────────────────────────────────

describe('calculateSpellSlots', () => {
  it('returns empty slots for non-casters', () => {
    const classInfo = { name: 'Fighter', isCustom: false, spellcaster: 'none' as const, hitDie: 10 };
    const slots = calculateSpellSlots(classInfo, 5);
    expect(slots[1].max).toBe(0);
  });

  it('returns full caster slots', () => {
    const classInfo = { name: 'Wizard', isCustom: false, spellcaster: 'full' as const, hitDie: 6 };
    const slots = calculateSpellSlots(classInfo, 5);
    // Level 5 wizard: 4/3/2/0/0/0/0/0/0
    expect(slots[1].max).toBe(4);
    expect(slots[2].max).toBe(3);
    expect(slots[3].max).toBe(2);
    expect(slots[4].max).toBe(0);
  });

  it('returns empty slots for warlocks (pact magic is separate)', () => {
    const classInfo = { name: 'Warlock', isCustom: false, spellcaster: 'warlock' as const, hitDie: 8 };
    const slots = calculateSpellSlots(classInfo, 5);
    expect(slots[1].max).toBe(0);
  });
});

describe('calculatePactMagic', () => {
  it('returns pact magic for warlock levels', () => {
    const pm = calculatePactMagic(5);
    expect(pm).toBeDefined();
    expect(pm!.slots.max).toBe(2);
    expect(pm!.level).toBe(3);
  });

  it('returns undefined for level 0', () => {
    expect(calculatePactMagic(0)).toBeUndefined();
  });
});

describe('updateSpellSlotsPreservingUsed', () => {
  it('preserves used slots up to new max', () => {
    const current = {
      1: { max: 4, used: 3 },
      2: { max: 3, used: 2 },
      3: { max: 2, used: 0 },
      4: { max: 0, used: 0 },
      5: { max: 0, used: 0 },
      6: { max: 0, used: 0 },
      7: { max: 0, used: 0 },
      8: { max: 0, used: 0 },
      9: { max: 0, used: 0 },
    };
    const newSlots = {
      1: { max: 4, used: 0 },
      2: { max: 3, used: 0 },
      3: { max: 3, used: 0 },
      4: { max: 1, used: 0 },
      5: { max: 0, used: 0 },
      6: { max: 0, used: 0 },
      7: { max: 0, used: 0 },
      8: { max: 0, used: 0 },
      9: { max: 0, used: 0 },
    };
    const result = updateSpellSlotsPreservingUsed(newSlots, current);
    expect(result[1].used).toBe(3);
    expect(result[2].used).toBe(2);
    expect(result[3].used).toBe(0);
    expect(result[4].used).toBe(0);
  });

  it('caps used at new max', () => {
    const current = {
      1: { max: 4, used: 4 },
      2: { max: 3, used: 3 },
      3: { max: 2, used: 2 },
      4: { max: 0, used: 0 },
      5: { max: 0, used: 0 },
      6: { max: 0, used: 0 },
      7: { max: 0, used: 0 },
      8: { max: 0, used: 0 },
      9: { max: 0, used: 0 },
    };
    const newSlots = {
      1: { max: 2, used: 0 },
      2: { max: 0, used: 0 },
      3: { max: 0, used: 0 },
      4: { max: 0, used: 0 },
      5: { max: 0, used: 0 },
      6: { max: 0, used: 0 },
      7: { max: 0, used: 0 },
      8: { max: 0, used: 0 },
      9: { max: 0, used: 0 },
    };
    const result = updateSpellSlotsPreservingUsed(newSlots, current);
    expect(result[1].used).toBe(2);
    expect(result[2].used).toBe(0);
  });
});

describe('hasSpellSlots', () => {
  it('returns false for all-zero slots', () => {
    const slots = {
      1: { max: 0, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    };
    expect(hasSpellSlots(slots)).toBe(false);
  });

  it('returns true when any slot has max > 0', () => {
    const slots = {
      1: { max: 2, used: 0 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 },
      4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 },
      7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 },
    };
    expect(hasSpellSlots(slots)).toBe(true);
  });

  it('returns true when pact magic has slots', () => {
    expect(hasSpellSlots(undefined, { slots: { max: 2, used: 0 }, level: 3 })).toBe(true);
  });
});

// ── XP calculations ──────────────────────────────────────────

describe('calculateLevelFromXP', () => {
  it('returns 1 for 0 XP', () => {
    expect(calculateLevelFromXP(0)).toBe(1);
  });

  it('returns 2 for 300 XP', () => {
    expect(calculateLevelFromXP(300)).toBe(2);
  });

  it('returns 5 for 6500 XP', () => {
    expect(calculateLevelFromXP(6500)).toBe(5);
  });

  it('returns 20 for 355000 XP', () => {
    expect(calculateLevelFromXP(355000)).toBe(20);
  });
});

describe('shouldLevelUp', () => {
  it('returns true when XP exceeds next level threshold', () => {
    expect(shouldLevelUp(6500, 4)).toBe(true);
  });

  it('returns false when XP matches current level', () => {
    expect(shouldLevelUp(6500, 5)).toBe(false);
  });
});

describe('getXPToNextLevel', () => {
  it('returns 0 at level 20', () => {
    expect(getXPToNextLevel(999999, 20)).toBe(0);
  });

  it('returns remaining XP needed', () => {
    // Level 5 needs 6500 XP, level 6 needs 14000 → 14000 - 6500 = 7500
    expect(getXPToNextLevel(6500, 5)).toBe(7500);
  });
});

describe('getXPProgress', () => {
  it('returns 100 at level 20', () => {
    expect(getXPProgress(400000, 20)).toBe(100);
  });

  it('returns 0 at start of level', () => {
    expect(getXPProgress(6500, 5)).toBe(0);
  });
});

// ── Spellcasting calculations ────────────────────────────────

describe('getClassSpellcastingAbility', () => {
  it('returns intelligence for Wizard', () => {
    expect(getClassSpellcastingAbility('Wizard')).toBe('intelligence');
  });

  it('returns wisdom for Cleric', () => {
    expect(getClassSpellcastingAbility('Cleric')).toBe('wisdom');
  });

  it('returns charisma for Sorcerer', () => {
    expect(getClassSpellcastingAbility('Sorcerer')).toBe('charisma');
  });

  it('returns charisma for Warlock', () => {
    expect(getClassSpellcastingAbility('Warlock')).toBe('charisma');
  });

  it('returns null for Fighter', () => {
    expect(getClassSpellcastingAbility('Fighter')).toBe(null);
  });
});

describe('calculateSpellAttackBonus', () => {
  it('returns ability mod + proficiency for a caster', () => {
    const wiz = makeWizard(); // INT 18 → +4, level 5 prof +3 = 7
    expect(calculateSpellAttackBonus(wiz)).toBe(7);
  });

  it('returns null for non-caster', () => {
    const fighter = makeCharacter();
    expect(calculateSpellAttackBonus(fighter)).toBe(null);
  });

  it('uses manual override when set', () => {
    const wiz = makeWizard({
      spellcastingStats: {
        spellcastingAbility: 'intelligence',
        isAbilityOverridden: false,
        spellAttackBonus: 10,
      },
    });
    expect(calculateSpellAttackBonus(wiz)).toBe(10);
  });
});

describe('calculateSpellSaveDC', () => {
  it('returns 8 + ability mod + proficiency', () => {
    const wiz = makeWizard(); // 8 + 4 + 3 = 15
    expect(calculateSpellSaveDC(wiz)).toBe(15);
  });

  it('returns null for non-caster', () => {
    expect(calculateSpellSaveDC(makeCharacter())).toBe(null);
  });
});

describe('isSpellcaster', () => {
  it('returns true for wizard', () => {
    expect(isSpellcaster(makeWizard())).toBe(true);
  });

  it('returns false for fighter', () => {
    expect(isSpellcaster(makeCharacter())).toBe(false);
  });
});

// ── Trait / charge scaling ───────────────────────────────────

describe('calculateTraitMaxUses', () => {
  it('returns base maxUses when not scaling', () => {
    const trait = { maxUses: 3, scaleWithProficiency: false } as any;
    expect(calculateTraitMaxUses(trait, 5)).toBe(3);
  });

  it('returns proficiency × multiplier when scaling', () => {
    const trait = { maxUses: 3, scaleWithProficiency: true, proficiencyMultiplier: 2 } as any;
    // Level 5 prof +3 → 3 * 2 = 6
    expect(calculateTraitMaxUses(trait, 5)).toBe(6);
  });
});

// ── Multiclass calculations ──────────────────────────────────

describe('calculateMulticlassSpellSlots', () => {
  it('combines caster levels using full caster table', () => {
    const classes = [
      { className: 'Wizard', level: 3, spellcaster: 'full' as const, hitDie: 6, isCustom: false },
      { className: 'Cleric', level: 2, spellcaster: 'full' as const, hitDie: 8, isCustom: false },
    ];
    // Combined caster level 5 → 4/3/2/0/0/0/0/0/0
    const slots = calculateMulticlassSpellSlots(classes);
    expect(slots[1].max).toBe(4);
    expect(slots[2].max).toBe(3);
    expect(slots[3].max).toBe(2);
  });

  it('halves half-caster contribution', () => {
    const classes = [
      { className: 'Wizard', level: 5, spellcaster: 'full' as const, hitDie: 6, isCustom: false },
      { className: 'Paladin', level: 4, spellcaster: 'half' as const, hitDie: 10, isCustom: false },
    ];
    // Caster level: 5 + floor(4/2)=2 = 7
    const slots = calculateMulticlassSpellSlots(classes);
    expect(slots[1].max).toBe(4);
    expect(slots[4].max).toBe(1);
  });

  it('ignores warlock levels', () => {
    const classes = [
      { className: 'Wizard', level: 3, spellcaster: 'full' as const, hitDie: 6, isCustom: false },
      { className: 'Warlock', level: 5, spellcaster: 'warlock' as const, hitDie: 8, isCustom: false },
    ];
    // Only wizard level 3 counts
    const slots = calculateMulticlassSpellSlots(classes);
    expect(slots[1].max).toBe(4);
    expect(slots[2].max).toBe(2);
  });
});

describe('calculateCharacterPactMagic', () => {
  it('returns pact magic from warlock class', () => {
    const wl = makeWarlock({ level: 5, classes: [
      { className: 'Warlock', level: 5, spellcaster: 'warlock', hitDie: 8, isCustom: false },
    ]});
    const pm = calculateCharacterPactMagic(wl);
    expect(pm).toBeDefined();
    expect(pm!.slots.max).toBe(2);
  });

  it('returns undefined for non-warlock', () => {
    expect(calculateCharacterPactMagic(makeCharacter())).toBeUndefined();
  });
});

describe('calculateCharacterHitDicePools', () => {
  it('creates pool from single class', () => {
    const char = makeCharacter({ level: 5 });
    const pools = calculateCharacterHitDicePools(char);
    expect(pools['d10']).toEqual({ max: 5, used: 0 });
  });

  it('creates separate pools for multiclass', () => {
    const char = makeCharacter({
      classes: [
        { className: 'Fighter', level: 3, hitDie: 10, spellcaster: 'none', isCustom: false },
        { className: 'Wizard', level: 2, hitDie: 6, spellcaster: 'full', isCustom: false },
      ],
    });
    const pools = calculateCharacterHitDicePools(char);
    expect(pools['d10']).toEqual({ max: 3, used: 0 });
    expect(pools['d6']).toEqual({ max: 2, used: 0 });
  });
});

describe('getCharacterTotalLevel', () => {
  it('uses totalLevel when set', () => {
    const char = makeCharacter({ totalLevel: 7 });
    expect(getCharacterTotalLevel(char)).toBe(7);
  });

  it('sums class levels for multiclass', () => {
    const char = makeCharacter({
      totalLevel: undefined,
      classes: [
        { className: 'Fighter', level: 3, hitDie: 10, spellcaster: 'none', isCustom: false },
        { className: 'Rogue', level: 4, hitDie: 8, spellcaster: 'none', isCustom: false },
      ],
    });
    expect(getCharacterTotalLevel(char)).toBe(7);
  });

  it('falls back to level field', () => {
    const char = makeCharacter({ totalLevel: undefined, classes: undefined as any, level: 3 });
    expect(getCharacterTotalLevel(char)).toBe(3);
  });
});

describe('hasSpellcasting', () => {
  it('returns true when any class has spellcasting', () => {
    const char = makeCharacter({
      classes: [
        { className: 'Fighter', level: 5, hitDie: 10, spellcaster: 'none', isCustom: false },
        { className: 'Wizard', level: 3, hitDie: 6, spellcaster: 'full', isCustom: false },
      ],
    });
    expect(hasSpellcasting(char)).toBe(true);
  });

  it('returns false for pure martial', () => {
    expect(hasSpellcasting(makeCharacter())).toBe(false);
  });
});

describe('hasWarlockLevels', () => {
  it('detects warlock in multiclass', () => {
    const char = makeCharacter({
      classes: [
        { className: 'Fighter', level: 5, hitDie: 10, spellcaster: 'none', isCustom: false },
        { className: 'Warlock', level: 2, hitDie: 8, spellcaster: 'warlock', isCustom: false },
      ],
    });
    expect(hasWarlockLevels(char)).toBe(true);
  });

  it('returns false without warlock', () => {
    expect(hasWarlockLevels(makeCharacter())).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/utils/__tests__/calculations-weapons-spells.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/calculations-weapons-spells.test.ts
git commit -m "test: add weapon, spell, XP, and multiclass calculation tests"
```

---

### Task 4: Tests for hpCalculations.ts

**Files:**
- Create: `src/utils/__tests__/hpCalculations.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateMaxHP,
  getClassHitDie,
  applyDamage,
  applyHealing,
  addTemporaryHP,
  makeDeathSave,
  resetDeathSaves,
  isDying,
  isDead,
  isStabilized,
} from '@/utils/hpCalculations';
import { HitPoints, ClassInfo } from '@/types/character';

const makeHP = (overrides: Partial<HitPoints> = {}): HitPoints => ({
  current: 30,
  max: 44,
  temporary: 0,
  calculationMode: 'auto',
  ...overrides,
});

const classInfo: ClassInfo = {
  name: 'Fighter',
  isCustom: false,
  spellcaster: 'none',
  hitDie: 10,
};

// ── calculateMaxHP ───────────────────────────────────────────

describe('calculateMaxHP', () => {
  it('returns manual override when provided', () => {
    expect(calculateMaxHP(classInfo, 5, 14, 100)).toBe(100);
  });

  it('calculates level 1: full hit die + CON mod', () => {
    // d10, CON 14 (mod +2) → 10 + 2 = 12
    expect(calculateMaxHP(classInfo, 1, 14)).toBe(12);
  });

  it('calculates level 5: full + 4 × (avg + CON mod)', () => {
    // d10, CON 14 → level 1: 12, levels 2-5: 4 × (6 + 2) = 32 → total 44
    expect(calculateMaxHP(classInfo, 5, 14)).toBe(44);
  });

  it('enforces minimum of level HP', () => {
    // d6, CON 1 (mod -5) → 6 + (-5) = 1 at level 1
    const wizClass: ClassInfo = { name: 'Wizard', isCustom: false, spellcaster: 'full', hitDie: 6 };
    expect(calculateMaxHP(wizClass, 1, 1)).toBeGreaterThanOrEqual(1);
  });
});

// ── getClassHitDie ───────────────────────────────────────────

describe('getClassHitDie', () => {
  it('returns custom hit die when provided', () => {
    expect(getClassHitDie('Custom', 12)).toBe(12);
  });

  it('defaults to 8 for unknown classes', () => {
    expect(getClassHitDie('UnknownClass')).toBe(8);
  });
});

// ── applyDamage ──────────────────────────────────────────────

describe('applyDamage', () => {
  it('does nothing for 0 or negative damage', () => {
    const hp = makeHP();
    expect(applyDamage(hp, 0)).toEqual(hp);
    expect(applyDamage(hp, -5)).toEqual(hp);
  });

  it('reduces current HP', () => {
    const hp = makeHP({ current: 30 });
    const result = applyDamage(hp, 10);
    expect(result.current).toBe(20);
  });

  it('absorbs damage in temp HP first', () => {
    const hp = makeHP({ current: 30, temporary: 10 });
    const result = applyDamage(hp, 15);
    expect(result.temporary).toBe(0);
    expect(result.current).toBe(25);
  });

  it('triggers death saves at 0 HP', () => {
    const hp = makeHP({ current: 10 });
    const result = applyDamage(hp, 10);
    expect(result.current).toBe(0);
    expect(result.deathSaves).toBeDefined();
    expect(result.deathSaves!.failures).toBe(0);
  });

  it('triggers instant death from massive damage', () => {
    // Massive damage: excess >= max HP
    const hp = makeHP({ current: 10, max: 44 });
    // 10 to reach 0 + 44 excess = 54 total damage
    const result = applyDamage(hp, 54);
    expect(result.current).toBe(0);
    expect(result.deathSaves!.failures).toBe(3);
  });

  it('does not trigger instant death for borderline case', () => {
    const hp = makeHP({ current: 10, max: 44 });
    // 10 to reach 0 + 43 excess (less than max) = 53 total
    const result = applyDamage(hp, 53);
    expect(result.current).toBe(0);
    expect(result.deathSaves!.failures).toBe(0);
  });
});

// ── applyHealing ─────────────────────────────────────────────

describe('applyHealing', () => {
  it('does nothing for 0 or negative healing', () => {
    const hp = makeHP({ current: 20 });
    expect(applyHealing(hp, 0)).toEqual(hp);
    expect(applyHealing(hp, -5)).toEqual(hp);
  });

  it('increases current HP', () => {
    const result = applyHealing(makeHP({ current: 20, max: 44 }), 10);
    expect(result.current).toBe(30);
  });

  it('caps at max HP', () => {
    const result = applyHealing(makeHP({ current: 40, max: 44 }), 20);
    expect(result.current).toBe(44);
  });

  it('clears death saves when healing from 0 HP', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 1, failures: 2, isStabilized: false },
    });
    const result = applyHealing(hp, 5);
    expect(result.current).toBe(5);
    expect(result.deathSaves).toBeUndefined();
  });
});

// ── addTemporaryHP ───────────────────────────────────────────

describe('addTemporaryHP', () => {
  it('does nothing for 0 or negative temp HP', () => {
    const hp = makeHP();
    expect(addTemporaryHP(hp, 0)).toEqual(hp);
  });

  it('sets temp HP', () => {
    const result = addTemporaryHP(makeHP(), 10);
    expect(result.temporary).toBe(10);
  });

  it('does not stack — takes higher value', () => {
    const hp = makeHP({ temporary: 15 });
    const result = addTemporaryHP(hp, 10);
    expect(result.temporary).toBe(15); // Keep existing higher
  });

  it('replaces with higher value', () => {
    const hp = makeHP({ temporary: 5 });
    const result = addTemporaryHP(hp, 10);
    expect(result.temporary).toBe(10);
  });
});

// ── makeDeathSave ────────────────────────────────────────────

describe('makeDeathSave', () => {
  it('does nothing without active death saves', () => {
    const hp = makeHP({ current: 10 });
    expect(makeDeathSave(hp, true)).toEqual(hp);
  });

  it('adds a success', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 0, isStabilized: false },
    });
    const result = makeDeathSave(hp, true);
    expect(result.deathSaves!.successes).toBe(1);
  });

  it('stabilizes at 3 successes', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 2, failures: 1, isStabilized: false },
    });
    const result = makeDeathSave(hp, true);
    expect(result.deathSaves!.successes).toBe(3);
    expect(result.deathSaves!.isStabilized).toBe(true);
  });

  it('adds a failure', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 0, isStabilized: false },
    });
    const result = makeDeathSave(hp, false);
    expect(result.deathSaves!.failures).toBe(1);
  });

  it('critical success: regain 1 HP, clear death saves', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 2, isStabilized: false },
    });
    const result = makeDeathSave(hp, true, true);
    expect(result.current).toBe(1);
    expect(result.deathSaves).toBeUndefined();
  });
});

// ── Status checks ────────────────────────────────────────────

describe('isDying', () => {
  it('returns true at 0 HP with active death saves', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 0, isStabilized: false },
    });
    expect(isDying(hp)).toBe(true);
  });

  it('returns false when stabilized', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 3, failures: 0, isStabilized: true },
    });
    expect(isDying(hp)).toBe(false);
  });

  it('returns false with HP > 0', () => {
    expect(isDying(makeHP({ current: 1 }))).toBe(false);
  });
});

describe('isDead', () => {
  it('returns true with 3 failures', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 3, isStabilized: false },
    });
    expect(isDead(hp)).toBe(true);
  });

  it('returns false with fewer than 3 failures', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 0, failures: 2, isStabilized: false },
    });
    expect(isDead(hp)).toBe(false);
  });
});

describe('isStabilized', () => {
  it('returns true at 0 HP when stabilized', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 3, failures: 0, isStabilized: true },
    });
    expect(isStabilized(hp)).toBe(true);
  });
});

describe('resetDeathSaves', () => {
  it('clears death save state', () => {
    const hp = makeHP({
      current: 0,
      deathSaves: { successes: 2, failures: 1, isStabilized: false },
    });
    expect(resetDeathSaves(hp).deathSaves).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/utils/__tests__/hpCalculations.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/hpCalculations.test.ts
git commit -m "test: add HP calculation tests (damage, healing, death saves)"
```

---

### Task 5: Tests for multiclass.ts

**Files:**
- Create: `src/utils/__tests__/multiclass.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import {
  migrateToMulticlass,
  isMulticlassed,
  calculateHitDicePools,
  getTotalLevel,
  getPrimaryClass,
  getClassDisplayString,
  MULTICLASS_REQUIREMENTS,
} from '@/utils/multiclass';
import { makeCharacter } from './test-utils';

// ── migrateToMulticlass ──────────────────────────────────────

describe('migrateToMulticlass', () => {
  it('adds classes array from single class character', () => {
    const char = makeCharacter({ classes: undefined as any });
    const migrated = migrateToMulticlass(char);
    expect(migrated.classes).toBeDefined();
    expect(migrated.classes!.length).toBeGreaterThanOrEqual(1);
    expect(migrated.classes![0].className).toBe('Fighter');
  });

  it('preserves existing multiclass data', () => {
    const char = makeCharacter({
      classes: [
        { className: 'Fighter', level: 3, hitDie: 10, spellcaster: 'none', isCustom: false },
        { className: 'Wizard', level: 2, hitDie: 6, spellcaster: 'full', isCustom: false },
      ],
    });
    const migrated = migrateToMulticlass(char);
    expect(migrated.classes!.length).toBe(2);
  });
});

// ── isMulticlassed ───────────────────────────────────────────

describe('isMulticlassed', () => {
  it('returns false for single class', () => {
    const char = makeCharacter({
      classes: [
        { className: 'Fighter', level: 5, hitDie: 10, spellcaster: 'none', isCustom: false },
      ],
    });
    expect(isMulticlassed(char)).toBe(false);
  });

  it('returns true for multiple classes', () => {
    const char = makeCharacter({
      classes: [
        { className: 'Fighter', level: 3, hitDie: 10, spellcaster: 'none', isCustom: false },
        { className: 'Wizard', level: 2, hitDie: 6, spellcaster: 'full', isCustom: false },
      ],
    });
    expect(isMulticlassed(char)).toBe(true);
  });
});

// ── calculateHitDicePools ────────────────────────────────────

describe('calculateHitDicePools', () => {
  it('creates pools by die type', () => {
    const classes = [
      { className: 'Fighter', level: 3, hitDie: 10, spellcaster: 'none' as const, isCustom: false },
      { className: 'Wizard', level: 2, hitDie: 6, spellcaster: 'full' as const, isCustom: false },
    ];
    const pools = calculateHitDicePools(classes);
    expect(pools['d10'].max).toBe(3);
    expect(pools['d6'].max).toBe(2);
  });

  it('combines same die types', () => {
    const classes = [
      { className: 'Rogue', level: 3, hitDie: 8, spellcaster: 'none' as const, isCustom: false },
      { className: 'Warlock', level: 2, hitDie: 8, spellcaster: 'warlock' as const, isCustom: false },
    ];
    const pools = calculateHitDicePools(classes);
    expect(pools['d8'].max).toBe(5);
  });

  it('preserves existing used dice', () => {
    const classes = [
      { className: 'Fighter', level: 5, hitDie: 10, spellcaster: 'none' as const, isCustom: false },
    ];
    const existing = { d10: { max: 4, used: 2 } };
    const pools = calculateHitDicePools(classes, existing);
    expect(pools['d10'].max).toBe(5);
    expect(pools['d10'].used).toBe(2);
  });
});

// ── getTotalLevel ────────────────────────────────────────────

describe('getTotalLevel', () => {
  it('sums all class levels', () => {
    const char = makeCharacter({
      classes: [
        { className: 'Fighter', level: 3, hitDie: 10, spellcaster: 'none', isCustom: false },
        { className: 'Wizard', level: 2, hitDie: 6, spellcaster: 'full', isCustom: false },
      ],
    });
    expect(getTotalLevel(char)).toBe(5);
  });

  it('falls back to character.level for single class', () => {
    const char = makeCharacter({ level: 7, classes: undefined as any });
    expect(getTotalLevel(char)).toBe(7);
  });
});

// ── getPrimaryClass ──────────────────────────────────────────

describe('getPrimaryClass', () => {
  it('returns highest-level class', () => {
    const char = makeCharacter({
      classes: [
        { className: 'Fighter', level: 3, hitDie: 10, spellcaster: 'none', isCustom: false },
        { className: 'Wizard', level: 5, hitDie: 6, spellcaster: 'full', isCustom: false },
      ],
    });
    const primary = getPrimaryClass(char);
    expect(primary).toBeDefined();
    expect(primary!.className).toBe('Wizard');
  });
});

// ── getClassDisplayString ────────────────────────────────────

describe('getClassDisplayString', () => {
  it('formats single class', () => {
    const char = makeCharacter({
      classes: [
        { className: 'Fighter', level: 5, hitDie: 10, spellcaster: 'none', isCustom: false },
      ],
    });
    expect(getClassDisplayString(char)).toContain('Fighter');
    expect(getClassDisplayString(char)).toContain('5');
  });

  it('formats multiclass with total level', () => {
    const char = makeCharacter({
      classes: [
        { className: 'Fighter', level: 3, hitDie: 10, spellcaster: 'none', isCustom: false },
        { className: 'Wizard', level: 2, hitDie: 6, spellcaster: 'full', isCustom: false },
      ],
    });
    const display = getClassDisplayString(char);
    expect(display).toContain('Fighter');
    expect(display).toContain('Wizard');
  });
});

// ── MULTICLASS_REQUIREMENTS ──────────────────────────────────

describe('MULTICLASS_REQUIREMENTS', () => {
  it('has requirements for core classes', () => {
    expect(MULTICLASS_REQUIREMENTS['Fighter']).toBeDefined();
    expect(MULTICLASS_REQUIREMENTS['Wizard']).toBeDefined();
    expect(MULTICLASS_REQUIREMENTS['Paladin']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/utils/__tests__/multiclass.test.ts`

Expected: All tests pass. Adjust any function signatures or import paths if they don't match.

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/multiclass.test.ts
git commit -m "test: add multiclass utility tests"
```

---

### Task 6: Tests for small utilities (currency, encumbrance, diceUtils, cn, textFormatting, sourceUtils)

**Files:**
- Create: `src/utils/__tests__/currency.test.ts`
- Create: `src/utils/__tests__/encumbrance.test.ts`
- Create: `src/utils/__tests__/diceUtils.test.ts`
- Create: `src/utils/__tests__/cn.test.ts`
- Create: `src/utils/__tests__/textFormatting.test.ts`
- Create: `src/utils/__tests__/sourceUtils.test.ts`

- [ ] **Step 1: Write currency.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import {
  formatCurrencyFromCopper,
  formatCurrencyFromCopperShort,
} from '@/utils/currency';

describe('formatCurrencyFromCopper', () => {
  it('returns "0 cp" for 0', () => {
    expect(formatCurrencyFromCopper(0)).toBe('0 cp');
  });

  it('formats copper only', () => {
    expect(formatCurrencyFromCopper(5)).toBe('5 cp');
  });

  it('formats silver and copper', () => {
    expect(formatCurrencyFromCopper(35)).toBe('3 sp, 5 cp');
  });

  it('formats gold, silver, copper', () => {
    expect(formatCurrencyFromCopper(1234)).toBe('12 gp, 3 sp, 4 cp');
  });

  it('omits zero denominations', () => {
    expect(formatCurrencyFromCopper(100)).toBe('1 gp');
    expect(formatCurrencyFromCopper(10)).toBe('1 sp');
  });
});

describe('formatCurrencyFromCopperShort', () => {
  it('returns "0cp" for 0', () => {
    expect(formatCurrencyFromCopperShort(0)).toBe('0cp');
  });

  it('formats compact', () => {
    expect(formatCurrencyFromCopperShort(1234)).toBe('12g 3s 4c');
  });
});
```

- [ ] **Step 2: Write encumbrance.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateTotalWeight,
  calculateTotalValue,
  calculateEncumbrance,
} from '@/utils/encumbrance';
import { makeCharacter } from './test-utils';

describe('calculateTotalWeight', () => {
  it('returns 0 for empty inventory', () => {
    expect(calculateTotalWeight(makeCharacter())).toBe(0);
  });

  it('sums weapon weights', () => {
    const char = makeCharacter({
      weapons: [{ id: '1', name: 'Sword', weight: 3 } as any],
    });
    expect(calculateTotalWeight(char)).toBe(3);
  });

  it('accounts for item quantity', () => {
    const char = makeCharacter({
      inventoryItems: [
        { id: '1', name: 'Ration', weight: 2, quantity: 5 } as any,
      ],
    });
    expect(calculateTotalWeight(char)).toBe(10);
  });

  it('includes coin weight (50 coins = 1 lb)', () => {
    const char = makeCharacter({
      currency: { gold: 100, silver: 0, copper: 0, electrum: 0, platinum: 0 },
    });
    expect(calculateTotalWeight(char)).toBe(2);
  });
});

describe('calculateEncumbrance', () => {
  it('returns normal for empty inventory', () => {
    const info = calculateEncumbrance(makeCharacter());
    expect(info.status).toBe('normal');
    expect(info.carryCapacity).toBe(240); // STR 16 × 15
    expect(info.encumberedAt).toBe(80); // STR 16 × 5
    expect(info.heavilyEncumberedAt).toBe(160); // STR 16 × 10
  });
});
```

- [ ] **Step 3: Write diceUtils.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseDiceNotation,
  formatDiceResults,
  hasCriticalSuccess,
  hasCriticalFailure,
} from '@/utils/diceUtils';

describe('parseDiceNotation', () => {
  it('parses "1d20"', () => {
    const result = parseDiceNotation('1d20');
    expect(result.count).toBe(1);
    expect(result.sides).toBe(20);
    expect(result.modifier).toBe(0);
  });

  it('parses "3d6+5"', () => {
    const result = parseDiceNotation('3d6+5');
    expect(result.count).toBe(3);
    expect(result.sides).toBe(6);
    expect(result.modifier).toBe(5);
  });

  it('parses "1d20-2"', () => {
    const result = parseDiceNotation('1d20-2');
    expect(result.modifier).toBe(-2);
  });

  it('defaults count to 1', () => {
    const result = parseDiceNotation('d8');
    expect(result.count).toBe(1);
    expect(result.sides).toBe(8);
  });

  it('throws for invalid notation', () => {
    expect(() => parseDiceNotation('invalid')).toThrow();
  });
});

describe('hasCriticalSuccess', () => {
  it('returns true for natural 20 on d20', () => {
    expect(hasCriticalSuccess([{ value: 20, sides: 20 }])).toBe(true);
  });

  it('returns false for 20 on non-d20', () => {
    expect(hasCriticalSuccess([{ value: 20, sides: 100 }])).toBe(false);
  });

  it('returns false for non-max on d20', () => {
    expect(hasCriticalSuccess([{ value: 19, sides: 20 }])).toBe(false);
  });
});

describe('hasCriticalFailure', () => {
  it('returns true for natural 1 on d20', () => {
    expect(hasCriticalFailure([{ value: 1, sides: 20 }])).toBe(true);
  });

  it('returns false for 1 on non-d20', () => {
    expect(hasCriticalFailure([{ value: 1, sides: 6 }])).toBe(false);
  });
});
```

- [ ] **Step 4: Write cn.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { cn } from '@/utils/cn';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('merges tailwind conflicts', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });
});
```

- [ ] **Step 5: Write textFormatting.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import {
  processDndText,
  markdownToHtml,
  processAndFormatDndText,
  createSafeHtml,
} from '@/utils/textFormatting';

describe('processDndText', () => {
  it('returns empty string for falsy input', () => {
    expect(processDndText('')).toBe('');
  });

  it('converts {@dc N} to "DC N"', () => {
    expect(processDndText('{@dc 15}')).toBe('DC 15');
  });

  it('strips {@damage} tags', () => {
    expect(processDndText('{@damage 2d6}')).toBe('2d6');
  });

  it('strips {@dice} tags', () => {
    expect(processDndText('{@dice 1d20}')).toBe('1d20');
  });

  it('extracts name from {@tag Name|Source}', () => {
    expect(processDndText('{@spell Fireball|PHB}')).toBe('Fireball');
  });
});

describe('markdownToHtml', () => {
  it('converts **bold** to <strong>', () => {
    expect(markdownToHtml('**hello**')).toBe('<strong>hello</strong>');
  });

  it('returns empty for falsy input', () => {
    expect(markdownToHtml('')).toBe('');
  });
});

describe('processAndFormatDndText', () => {
  it('processes both D&D tags and markdown', () => {
    expect(processAndFormatDndText('{@dc 15} **save**')).toBe(
      'DC 15 <strong>save</strong>'
    );
  });
});

describe('createSafeHtml', () => {
  it('returns __html property', () => {
    const result = createSafeHtml('**test**');
    expect(result.__html).toBe('<strong>test</strong>');
  });
});
```

- [ ] **Step 6: Write sourceUtils.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import {
  formatSourceForDisplay,
  shouldReplaceSource,
  deduplicateBySourcePriority,
  getSourceEdition,
  is2024Source,
  is2014Source,
  compareSourcePriority,
} from '@/utils/sourceUtils';

describe('formatSourceForDisplay', () => {
  it('converts XPHB to PHB2024', () => {
    expect(formatSourceForDisplay('XPHB')).toBe('PHB2024');
  });

  it('passes through other sources', () => {
    expect(formatSourceForDisplay('PHB')).toBe('PHB');
  });
});

describe('shouldReplaceSource', () => {
  it('always prefers PHB2024', () => {
    expect(shouldReplaceSource('PHB', 'PHB2024')).toBe(true);
  });

  it('does not replace PHB2024 with anything', () => {
    expect(shouldReplaceSource('PHB2024', 'PHB')).toBe(false);
  });

  it('prefers SRD over non-SRD', () => {
    expect(shouldReplaceSource('DMG', 'SRD', false, true)).toBe(true);
  });
});

describe('deduplicateBySourcePriority', () => {
  it('keeps highest-priority version', () => {
    const items = [
      { name: 'Fireball', source: 'PHB', isSrd: false },
      { name: 'Fireball', source: 'PHB2024', isSrd: false },
    ];
    const result = deduplicateBySourcePriority(items);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('PHB2024');
  });
});

describe('getSourceEdition', () => {
  it('returns 2024 for XPHB and PHB2024', () => {
    expect(getSourceEdition('XPHB')).toBe('2024');
    expect(getSourceEdition('PHB2024')).toBe('2024');
  });

  it('returns 2014 for PHB', () => {
    expect(getSourceEdition('PHB')).toBe('2014');
  });
});

describe('is2024Source', () => {
  it('identifies 2024 sources', () => {
    expect(is2024Source('XPHB')).toBe(true);
    expect(is2024Source('PHB2024')).toBe(true);
    expect(is2024Source('PHB')).toBe(false);
  });
});

describe('is2014Source', () => {
  it('identifies 2014 sources', () => {
    expect(is2014Source('PHB')).toBe(true);
    expect(is2014Source('PHB2024')).toBe(false);
  });
});

describe('compareSourcePriority', () => {
  it('sorts PHB2024 first', () => {
    expect(compareSourcePriority('PHB2024', 'PHB')).toBeLessThan(0);
  });

  it('sorts SRD before PHB', () => {
    expect(compareSourcePriority('SRD', 'PHB')).toBeLessThan(0);
  });

  it('sorts alphabetically for equal priority', () => {
    expect(compareSourcePriority('DMG', 'MM')).toBeLessThan(0);
  });
});
```

- [ ] **Step 7: Run all small utility tests**

Run: `npm run test -- --reporter=verbose src/utils/__tests__/currency.test.ts src/utils/__tests__/encumbrance.test.ts src/utils/__tests__/diceUtils.test.ts src/utils/__tests__/cn.test.ts src/utils/__tests__/textFormatting.test.ts src/utils/__tests__/sourceUtils.test.ts`

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/utils/__tests__/currency.test.ts src/utils/__tests__/encumbrance.test.ts src/utils/__tests__/diceUtils.test.ts src/utils/__tests__/cn.test.ts src/utils/__tests__/textFormatting.test.ts src/utils/__tests__/sourceUtils.test.ts
git commit -m "test: add tests for currency, encumbrance, dice, cn, text formatting, source utils"
```

---

### Task 7: Tests for data converters (spellConversion, weaponConversion, armorConversion, itemConversion, magicItemConversion, featureConversion)

**Files:**
- Create: `src/utils/__tests__/spellConversion.test.ts`
- Create: `src/utils/__tests__/weaponConversion.test.ts`
- Create: `src/utils/__tests__/armorConversion.test.ts`
- Create: `src/utils/__tests__/itemConversion.test.ts`
- Create: `src/utils/__tests__/magicItemConversion.test.ts`
- Create: `src/utils/__tests__/featureConversion.test.ts`

These converters transform raw 5etools data into internal app types. Tests should verify:
1. Basic happy-path conversion
2. Missing/undefined fields handled gracefully
3. Edge cases (empty arrays, special formats)

- [ ] **Step 1: Write all converter test files**

For each converter, read the source file to understand:
- What the input type looks like (ProcessedSpell, ProcessedWeapon, etc.)
- What the output type looks like (SpellFormData, WeaponAutoFillData, etc.)
- Default/fallback values

Create a test for each exported function. The pattern for each file:

```typescript
import { describe, it, expect } from 'vitest';
import { convertProcessedSpellToFormData, createInitialSpellFormData, searchSpells } from '@/utils/spellConversion';

describe('convertProcessedSpellToFormData', () => {
  it('converts a basic spell', () => {
    const spell = {
      id: 'fireball',
      name: 'Fireball',
      level: 3,
      school: 'Evocation',
      castingTime: '1 action',
      range: '150 feet',
      components: { v: true, s: true, m: 'A tiny ball of bat guano and sulfur' },
      duration: 'Instantaneous',
      description: 'A bright streak flashes from your pointing finger...',
      higherLevel: 'When you cast this spell using a slot of 4th level or higher...',
      ritual: false,
      concentration: false,
      classes: ['Sorcerer', 'Wizard'],
      source: 'PHB',
    };
    const result = convertProcessedSpellToFormData(spell as any);
    expect(result.name).toBe('Fireball');
    expect(result.level).toBe(3);
    expect(result.school).toBe('Evocation');
    expect(result.ritual).toBe(false);
    expect(result.concentration).toBe(false);
  });
});

describe('createInitialSpellFormData', () => {
  it('returns default form data', () => {
    const data = createInitialSpellFormData();
    expect(data.name).toBe('');
    expect(data.level).toBe(0);
  });
});

describe('searchSpells', () => {
  it('filters spells by name query', () => {
    const spells = [
      { id: '1', name: 'Fireball', level: 3 },
      { id: '2', name: 'Fire Bolt', level: 0 },
      { id: '3', name: 'Shield', level: 1 },
    ] as any[];
    const results = searchSpells(spells, 'fire');
    expect(results).toHaveLength(2);
  });
});
```

Follow this same pattern for `weaponConversion`, `armorConversion`, `itemConversion`, `magicItemConversion`, and `featureConversion`. For each:
1. Read the source file to understand the exported function signature and the conversion logic
2. Create a minimal mock of the input type matching the required fields
3. Assert the output has the expected field values
4. Test with missing optional fields to verify fallbacks

- [ ] **Step 2: Run the converter tests**

Run: `npm run test -- --reporter=verbose src/utils/__tests__/spellConversion.test.ts src/utils/__tests__/weaponConversion.test.ts src/utils/__tests__/armorConversion.test.ts src/utils/__tests__/itemConversion.test.ts src/utils/__tests__/magicItemConversion.test.ts src/utils/__tests__/featureConversion.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/spellConversion.test.ts src/utils/__tests__/weaponConversion.test.ts src/utils/__tests__/armorConversion.test.ts src/utils/__tests__/itemConversion.test.ts src/utils/__tests__/magicItemConversion.test.ts src/utils/__tests__/featureConversion.test.ts
git commit -m "test: add data converter tests (spell, weapon, armor, item, magic item, feature)"
```

---

### Task 8: Tests for summonConverter.ts

**Files:**
- Create: `src/utils/__tests__/summonConverter.test.ts`

`summonConverter.ts` (600 lines) has several sync functions and one async function (`createSpiritSummon`) that fetches a monster via an API call. Test sync functions directly; mock `fetch` for the async one.

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isSummoningSpell,
  getSummonType,
  isSpiritSummonSpell,
  getSpiritScaling,
  createFamiliarFromMonster,
  createSummonFromMonster,
  SUMMON_SPELL_SCALING,
} from '@/utils/summonConverter';
import { createMockProcessedMonster } from '@/test/helpers';

describe('isSummoningSpell', () => {
  it('returns true for "Summon Beast"', () => {
    expect(isSummoningSpell({ name: 'Summon Beast' } as any)).toBe(true);
  });

  it('returns true for "Find Familiar"', () => {
    expect(isSummoningSpell({ name: 'Find Familiar' } as any)).toBe(true);
  });

  it('returns false for non-summon spells', () => {
    expect(isSummoningSpell({ name: 'Fireball' } as any)).toBe(false);
  });
});

describe('getSummonType', () => {
  it('returns familiar for Find Familiar', () => {
    expect(getSummonType({ name: 'Find Familiar' } as any)).toBe('familiar');
  });

  it('returns summon for Summon spells', () => {
    expect(getSummonType({ name: 'Summon Beast' } as any)).toBe('summon');
  });
});

describe('isSpiritSummonSpell', () => {
  it('returns true for spirit summon spells', () => {
    expect(isSpiritSummonSpell('Summon Beast')).toBe(true);
  });

  it('returns false for non-spirit spells', () => {
    expect(isSpiritSummonSpell('Fireball')).toBe(false);
  });
});

describe('getSpiritScaling', () => {
  it('returns scaling data for known spells', () => {
    const scaling = getSpiritScaling('Summon Beast');
    if (scaling) {
      expect(scaling.baseLevel).toBeGreaterThan(0);
      expect(scaling.hpPerLevel).toBeGreaterThan(0);
    }
  });

  it('returns null for unknown spells', () => {
    expect(getSpiritScaling('Fireball')).toBe(null);
  });
});

describe('createFamiliarFromMonster', () => {
  it('creates a summon entity with familiar type', () => {
    const monster = createMockProcessedMonster({ name: 'Owl' });
    const familiar = createFamiliarFromMonster(monster);
    expect(familiar.type).toBe('familiar');
    expect(familiar.name).toBe('Owl');
    expect(familiar.entity).toBeDefined();
  });
});

describe('createSummonFromMonster', () => {
  it('creates a summon entity', () => {
    const monster = createMockProcessedMonster({ name: 'Giant Spider' });
    const summon = createSummonFromMonster(monster, 'Conjure Animals');
    expect(summon.type).toBe('summon');
    expect(summon.spellName).toBe('Conjure Animals');
    expect(summon.entity).toBeDefined();
  });

  it('sets concentration requirement', () => {
    const monster = createMockProcessedMonster();
    const summon = createSummonFromMonster(
      monster, 'Conjure Animals', undefined, 3, true, '1 hour'
    );
    expect(summon.requiresConcentration).toBe(true);
    expect(summon.duration).toBe('1 hour');
  });
});

describe('SUMMON_SPELL_SCALING', () => {
  it('has scaling data for common summon spells', () => {
    expect(SUMMON_SPELL_SCALING['Summon Beast']).toBeDefined();
    expect(SUMMON_SPELL_SCALING['Summon Fey']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/utils/__tests__/summonConverter.test.ts`

Expected: All tests pass. If `createMockProcessedMonster` doesn't have the right fields for summon conversion, extend the mock or create inline test data.

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/summonConverter.test.ts
git commit -m "test: add summon converter tests"
```

---

### Task 9: Tests for parsing utilities

**Files:**
- Create: `src/utils/__tests__/referenceParser.test.ts`
- Create: `src/utils/__tests__/parseEntriesToHtml.test.ts`
- Create: `src/utils/__tests__/additionalSpellsParser.test.ts`
- Create: `src/utils/__tests__/attachedSpellsParser.test.ts`
- Create: `src/utils/__tests__/additionalSpellsResolver.test.ts`

- [ ] **Step 1: Write referenceParser.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseReferences,
  getPlainText,
  extractReferences,
  hasReferences,
  getFormattedHtml,
} from '@/utils/referenceParser';

describe('parseReferences', () => {
  it('parses {@spell Fireball} reference', () => {
    const result = parseReferences('{@spell Fireball}');
    expect(result.references).toHaveLength(1);
    expect(result.references[0].name).toBe('Fireball');
    expect(result.references[0].type).toBe('spell');
  });

  it('handles text with no references', () => {
    const result = parseReferences('Just plain text');
    expect(result.references).toHaveLength(0);
    expect(result.text).toBe('Just plain text');
  });

  it('parses mixed text and references', () => {
    const result = parseReferences('Cast {@spell Fireball} for {@damage 8d6} damage');
    expect(result.references.length).toBeGreaterThan(0);
  });
});

describe('getPlainText', () => {
  it('strips all reference tags', () => {
    const result = getPlainText('{@spell Fireball|PHB}');
    expect(result).toContain('Fireball');
    expect(result).not.toContain('{@');
  });
});

describe('hasReferences', () => {
  it('returns true for text with references', () => {
    expect(hasReferences('{@spell Shield}')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(hasReferences('No references here')).toBe(false);
  });
});

describe('getFormattedHtml', () => {
  it('returns HTML string', () => {
    const html = getFormattedHtml('{@spell Fireball}');
    expect(typeof html).toBe('string');
    expect(html).toContain('Fireball');
  });
});
```

- [ ] **Step 2: Write parseEntriesToHtml.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { stripTags, parseEntriesToHtml } from '@/utils/parseEntriesToHtml';

describe('stripTags', () => {
  it('removes 5etools format tags', () => {
    expect(stripTags('{@spell Fireball|PHB}')).toContain('Fireball');
    expect(stripTags('{@spell Fireball|PHB}')).not.toContain('{@');
  });

  it('handles plain text', () => {
    expect(stripTags('No tags here')).toBe('No tags here');
  });
});

describe('parseEntriesToHtml', () => {
  it('converts string entries to HTML', () => {
    const html = parseEntriesToHtml(['A flash of light.', 'Everything burns.']);
    expect(html).toContain('A flash of light.');
    expect(html).toContain('Everything burns.');
  });

  it('handles empty array', () => {
    expect(parseEntriesToHtml([])).toBe('');
  });

  it('handles list entries', () => {
    const html = parseEntriesToHtml([
      { type: 'list', items: ['Item 1', 'Item 2'] },
    ]);
    expect(html).toContain('Item 1');
    expect(html).toContain('Item 2');
  });
});
```

- [ ] **Step 3: Write additionalSpellsParser.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import {
  cleanSpellName,
  parseChooseFilter,
  grantTypeLabel,
} from '@/utils/additionalSpellsParser';

describe('cleanSpellName', () => {
  it('strips source suffix', () => {
    const result = cleanSpellName('fireball|phb');
    expect(result.name).toBe('fireball');
  });

  it('extracts level when present', () => {
    const result = cleanSpellName('magic missile#2');
    expect(result.name).toBe('magic missile');
  });

  it('handles plain name', () => {
    const result = cleanSpellName('shield');
    expect(result.name).toBe('shield');
  });
});

describe('grantTypeLabel', () => {
  it('returns readable label for prepared', () => {
    expect(grantTypeLabel('prepared')).toContain('repared');
  });

  it('returns readable label for at_will with count', () => {
    const label = grantTypeLabel('innate_daily', 3);
    expect(typeof label).toBe('string');
  });
});
```

- [ ] **Step 4: Write attachedSpellsParser.test.ts and additionalSpellsResolver.test.ts**

Follow the same pattern: import exported functions, test with representative inputs. For `additionalSpellsResolver`, you need mock `ProcessedSpell` data — create inline minimal objects.

- [ ] **Step 5: Run all parser tests**

Run: `npm run test -- --reporter=verbose src/utils/__tests__/referenceParser.test.ts src/utils/__tests__/parseEntriesToHtml.test.ts src/utils/__tests__/additionalSpellsParser.test.ts src/utils/__tests__/attachedSpellsParser.test.ts src/utils/__tests__/additionalSpellsResolver.test.ts`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/__tests__/referenceParser.test.ts src/utils/__tests__/parseEntriesToHtml.test.ts src/utils/__tests__/additionalSpellsParser.test.ts src/utils/__tests__/attachedSpellsParser.test.ts src/utils/__tests__/additionalSpellsResolver.test.ts
git commit -m "test: add parser utility tests (references, entries, spells)"
```

---

### Task 10: Tests for data loaders

**Files:**
- Create: `src/utils/__tests__/dataLoaders.test.ts`

Data loaders read from JSON files in the `json/` directory. Since these files are part of the repo, we can test them as integration tests — call the loader and verify the output structure and count.

Some loaders use `fs.readFileSync` (Node-side), some use static imports. The loaders that use `fetch` (conditionsDiseasesLoader, lazyDataLoader) need fetch mocking.

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Data Loaders', () => {
  describe('sensesDataLoader', () => {
    it('loads and returns processed senses', async () => {
      const { loadAllSenses, clearSensesCache } = await import(
        '@/utils/sensesDataLoader'
      );
      clearSensesCache();
      const senses = await loadAllSenses();
      expect(senses.length).toBeGreaterThan(0);
      expect(senses[0]).toHaveProperty('id');
      expect(senses[0]).toHaveProperty('name');
      expect(senses[0]).toHaveProperty('description');
    });
  });

  describe('backgroundDataLoader', () => {
    it('loads and returns processed backgrounds', async () => {
      const { loadAllBackgrounds, clearBackgroundCache } = await import(
        '@/utils/backgroundDataLoader'
      );
      clearBackgroundCache();
      const backgrounds = await loadAllBackgrounds();
      expect(backgrounds.length).toBeGreaterThan(0);
      expect(backgrounds[0]).toHaveProperty('id');
      expect(backgrounds[0]).toHaveProperty('name');
      expect(backgrounds[0]).toHaveProperty('features');
    });

    it('loads background features as flat list', async () => {
      const { loadAllBackgroundFeatures, clearBackgroundCache } = await import(
        '@/utils/backgroundDataLoader'
      );
      clearBackgroundCache();
      const features = await loadAllBackgroundFeatures();
      expect(features.length).toBeGreaterThan(0);
      expect(features[0]).toHaveProperty('backgroundName');
    });
  });

  describe('featDataLoader', () => {
    it('loads and returns processed feats', async () => {
      const { loadAllFeats, clearFeatCache } = await import(
        '@/utils/featDataLoader'
      );
      clearFeatCache();
      const feats = await loadAllFeats();
      expect(feats.length).toBeGreaterThan(0);
      expect(feats[0]).toHaveProperty('id');
      expect(feats[0]).toHaveProperty('name');
      expect(feats[0]).toHaveProperty('description');
    });

    it('searches feats by name', async () => {
      const { searchFeats, clearFeatCache } = await import(
        '@/utils/featDataLoader'
      );
      clearFeatCache();
      const results = await searchFeats('Great Weapon');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('raceDataLoader', () => {
    it('loads and returns processed races', async () => {
      const { loadAllRaces } = await import('@/utils/raceDataLoader');
      const races = await loadAllRaces();
      expect(races.length).toBeGreaterThan(0);
      expect(races[0]).toHaveProperty('name');
      expect(races[0]).toHaveProperty('source');
    });
  });
});
```

Note: The larger data loaders (`spellDataLoader`, `classDataLoader`, `bestiaryDataLoader`, `weaponDataLoader`, etc.) load from files in the `json/` directory using `fs` or dynamic imports that may not work in jsdom. If any loader fails due to file system access in test environment, mock the JSON data or skip with a clear note. The key loaders to test are the ones that use static imports (feats, backgrounds, senses, races), which should work in jsdom.

For loaders that require runtime file system access:

```typescript
  describe('conditionsDiseasesLoader (with fetch mock)', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('loads conditions when fetch is mocked', async () => {
      // This loader fetches from /data/conditionsdiseases.json at runtime
      // In test environment, mock fetch with sample data
      const sampleData = {
        condition: [
          { name: 'Blinded', source: 'PHB', entries: ['A blinded creature can\'t see.'] },
        ],
        disease: [],
        status: [],
      };
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(sampleData),
        })
      ) as any;

      const { loadAllConditions } = await import('@/utils/conditionsDiseasesLoader');
      const conditions = await loadAllConditions();
      expect(conditions.length).toBeGreaterThan(0);
    });
  });
```

- [ ] **Step 2: Run the data loader tests**

Run: `npm run test -- --reporter=verbose src/utils/__tests__/dataLoaders.test.ts`

Expected: Tests for static-import loaders pass. Tests for file-system loaders may need adjustments based on how the loaders resolve paths in jsdom. Fix any path resolution issues.

- [ ] **Step 3: Commit**

```bash
git add src/utils/__tests__/dataLoaders.test.ts
git commit -m "test: add data loader integration tests"
```

---

### Task 11: Extend existing calendarCalculations tests

**Files:**
- Modify: `src/utils/__tests__/calendarCalculations.test.ts`

- [ ] **Step 1: Review existing tests and identify gaps**

Read the existing test file and the source `calendarCalculations.ts`. Identify any exported functions not currently covered.

- [ ] **Step 2: Add tests for uncovered functions**

Add new `describe` blocks for any exported functions missing tests, following the existing style in the file.

- [ ] **Step 3: Run the extended tests**

Run: `npm run test -- --reporter=verbose src/utils/__tests__/calendarCalculations.test.ts`

Expected: All tests pass (existing + new).

- [ ] **Step 4: Commit**

```bash
git add src/utils/__tests__/calendarCalculations.test.ts
git commit -m "test: extend calendar calculation test coverage"
```

---

### Task 12: Run full test suite and verify

- [ ] **Step 1: Run all unit tests**

Run: `npm run test -- --reporter=verbose`

Expected: All tests pass, including the new ones and the pre-existing ones.

- [ ] **Step 2: Run type checking**

Run: `npm run type-check`

Expected: No new type errors introduced.

- [ ] **Step 3: Final commit with any fixes**

If any test needed fixing in step 1 or 2:

```bash
git add -u
git commit -m "test: fix any issues found during full test suite run"
```

- [ ] **Step 4: Verify test count**

Run: `npm run test -- --reporter=verbose 2>&1 | tail -5`

Expected: Significantly more tests than before (~14 pre-existing unit tests → ~80+ total).
