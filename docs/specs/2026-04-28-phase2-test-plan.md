# Phase 2: Zustand Store Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive unit tests for all Zustand stores to verify state management logic and enable safe refactoring of the characterStore into smaller domain stores.

**Architecture:** Each test file calls store actions via `useXStore.getState().action()` and asserts resulting state via `useXStore.getState()`. State is reset in `beforeEach` using `useXStore.setState(initialState)`. No React rendering needed — Zustand stores are plain functions. The massive characterStore (5,157 lines, 93+ actions) is split into domain-specific test files.

**Tech Stack:** Vitest, jsdom, Zustand 5, `@/` path alias to `src/`

**Important context:**
- The existing `createMockCharacterState` in `src/test/helpers.ts` has a WRONG data shape (abilities as nested objects, skills as `{ proficiency: string }`). Use `makeCharacter` from `src/utils/__tests__/test-utils.ts` instead for characterStore tests (it matches the actual `CharacterState` type).
- The characterStore reads from `usePlayerStore` in some actions (e.g., `applyDamageToCharacter` checks `settings.enableDeathAnimation`). Make sure playerStore is initialized in characterStore tests.
- All stores use `persist` middleware with localStorage. In vitest/jsdom, localStorage is available.
- Existing tests exist for: `dmStore` (8 tests), `encounterStore` (~50 tests), `npcStore` (~12 tests). These need extending, not rewriting.

---

## File Structure

**characterStore domain test files (new):**
- `src/store/__tests__/characterStore-abilities.test.ts` — ability scores, skills, saving throws, Jack of All Trades
- `src/store/__tests__/characterStore-hp.test.ts` — HP management, death saves, calculation modes
- `src/store/__tests__/characterStore-class.test.ts` — class, level, multiclass, hit dice, XP
- `src/store/__tests__/characterStore-spells.test.ts` — spell slots, pact magic, concentration, spellbook
- `src/store/__tests__/characterStore-inventory.test.ts` — weapons, armor, magic items, inventory, currency
- `src/store/__tests__/characterStore-features.test.ts` — extended features, trackable traits, notes
- `src/store/__tests__/characterStore-conditions.test.ts` — conditions, diseases, buffs, defenses, senses
- `src/store/__tests__/characterStore-rest.test.ts` — short rest, long rest (integration)
- `src/store/__tests__/characterStore-summons.test.ts` — summons, saved creatures
- `src/store/__tests__/characterStore-persistence.test.ts` — save, load, reset, export, import, migration

**Other store test files (new or extend):**
- `src/store/__tests__/playerStore.test.ts` — new
- `src/store/__tests__/calendarStore.test.ts` — new
- `src/store/__tests__/battleMapStore.test.ts` — new
- `src/store/__tests__/combatLogStore.test.ts` — new
- `src/store/__tests__/locationStore.test.ts` — new
- `src/store/__tests__/encounterStore.test.ts` — extend
- `src/store/__tests__/npcStore.test.ts` — extend
- `src/store/__tests__/dmStore.test.ts` — extend

---

### Task 1: characterStore — ability scores, skills, saving throws

**Files:**
- Create: `src/store/__tests__/characterStore-abilities.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter, makeWizard } from '@/utils/__tests__/test-utils';

function resetStore(overrides = {}) {
  useCharacterStore.setState({
    character: makeCharacter(overrides),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    lastSaved: null,
    showDeathAnimation: false,
    showLevelUpAnimation: false,
    levelUpAnimationLevel: 1,
  });
}

describe('characterStore — abilities', () => {
  beforeEach(() => resetStore());

  describe('updateAbilityScore', () => {
    it('sets ability score', () => {
      useCharacterStore.getState().updateAbilityScore('strength', 20);
      expect(useCharacterStore.getState().character.abilities.strength).toBe(20);
    });

    it('clamps to minimum 1', () => {
      useCharacterStore.getState().updateAbilityScore('strength', -5);
      expect(useCharacterStore.getState().character.abilities.strength).toBe(1);
    });

    it('clamps to maximum 30', () => {
      useCharacterStore.getState().updateAbilityScore('strength', 50);
      expect(useCharacterStore.getState().character.abilities.strength).toBe(30);
    });

    it('auto-updates initiative when dexterity changes and not overridden', () => {
      useCharacterStore.getState().updateAbilityScore('dexterity', 20);
      expect(useCharacterStore.getState().character.initiative.value).toBe(5);
    });

    it('does not update initiative when dexterity changes but is overridden', () => {
      resetStore({ initiative: { value: 10, isOverridden: true } });
      useCharacterStore.getState().updateAbilityScore('dexterity', 20);
      expect(useCharacterStore.getState().character.initiative.value).toBe(10);
    });

    it('does not update initiative when other ability changes', () => {
      useCharacterStore.getState().updateAbilityScore('strength', 20);
      expect(useCharacterStore.getState().character.initiative.value).toBe(2);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().updateAbilityScore('strength', 20);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('updateSkillProficiency', () => {
    it('sets proficiency on a skill', () => {
      useCharacterStore.getState().updateSkillProficiency('arcana', true);
      expect(useCharacterStore.getState().character.skills.arcana.proficient).toBe(true);
    });

    it('removes proficiency from a skill', () => {
      useCharacterStore.getState().updateSkillProficiency('athletics', false);
      expect(useCharacterStore.getState().character.skills.athletics.proficient).toBe(false);
    });
  });

  describe('updateSkillExpertise', () => {
    it('sets expertise on a skill', () => {
      useCharacterStore.getState().updateSkillExpertise('perception', true);
      expect(useCharacterStore.getState().character.skills.perception.expertise).toBe(true);
    });

    it('removes expertise from a skill', () => {
      useCharacterStore.getState().updateSkillExpertise('perception', false);
      expect(useCharacterStore.getState().character.skills.perception.expertise).toBe(false);
    });
  });

  describe('toggleSkillBonusAbility', () => {
    it('adds a bonus ability', () => {
      useCharacterStore.getState().toggleSkillBonusAbility('arcana', 'wisdom');
      expect(useCharacterStore.getState().character.skills.arcana.bonusAbilities).toContain('wisdom');
    });

    it('removes an existing bonus ability', () => {
      resetStore({
        skills: {
          ...makeCharacter().skills,
          arcana: { proficient: false, expertise: false, bonusAbilities: ['wisdom'] },
        },
      });
      useCharacterStore.getState().toggleSkillBonusAbility('arcana', 'wisdom');
      expect(useCharacterStore.getState().character.skills.arcana.bonusAbilities).toBeUndefined();
    });
  });

  describe('updateSavingThrowProficiency', () => {
    it('sets saving throw proficiency', () => {
      useCharacterStore.getState().updateSavingThrowProficiency('wisdom', true);
      expect(useCharacterStore.getState().character.savingThrows.wisdom.proficient).toBe(true);
    });
  });

  describe('toggleJackOfAllTrades', () => {
    it('toggles on', () => {
      useCharacterStore.getState().toggleJackOfAllTrades();
      expect(useCharacterStore.getState().character.jackOfAllTrades).toBe(true);
    });

    it('toggles off', () => {
      resetStore({ jackOfAllTrades: true });
      useCharacterStore.getState().toggleJackOfAllTrades();
      expect(useCharacterStore.getState().character.jackOfAllTrades).toBe(false);
    });
  });

  describe('updateInitiative', () => {
    it('sets initiative value', () => {
      useCharacterStore.getState().updateInitiative(5);
      expect(useCharacterStore.getState().character.initiative.value).toBe(5);
    });
  });

  describe('resetInitiativeToDefault', () => {
    it('resets initiative to DEX modifier and clears override', () => {
      resetStore({ initiative: { value: 10, isOverridden: true } });
      useCharacterStore.getState().resetInitiativeToDefault();
      const init = useCharacterStore.getState().character.initiative;
      expect(init.value).toBe(2); // DEX 14 → +2
      expect(init.isOverridden).toBe(false);
    });
  });

  describe('toggleReaction', () => {
    it('toggles reaction used state', () => {
      useCharacterStore.getState().toggleReaction();
      expect(useCharacterStore.getState().character.reaction.hasUsedReaction).toBe(true);
      useCharacterStore.getState().toggleReaction();
      expect(useCharacterStore.getState().character.reaction.hasUsedReaction).toBe(false);
    });
  });

  describe('heroicInspiration', () => {
    it('updateHeroicInspiration sets count', () => {
      useCharacterStore.getState().updateHeroicInspiration({ count: 1 });
      expect(useCharacterStore.getState().character.heroicInspiration.count).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/characterStore-abilities.test.ts`

Expected: All tests pass. If any function name doesn't match, read the source at `src/store/characterStore.ts` and adjust.

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/characterStore-abilities.test.ts
git commit -m "test: add characterStore ability/skill/saving throw tests"
```

---

### Task 2: characterStore — HP management

**Files:**
- Create: `src/store/__tests__/characterStore-hp.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

function resetStore(overrides = {}) {
  useCharacterStore.setState({
    character: makeCharacter(overrides),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    lastSaved: null,
    showDeathAnimation: false,
    showLevelUpAnimation: false,
    levelUpAnimationLevel: 1,
  });
  // Ensure playerStore has default settings (characterStore reads this)
  usePlayerStore.setState({
    characters: [],
    activeCharacterId: null,
    settings: { enableDeathAnimation: false, enableLevelUpAnimation: false },
    lastSelectedCharacterId: null,
  });
}

describe('characterStore — HP management', () => {
  beforeEach(() => resetStore());

  describe('applyDamageToCharacter', () => {
    it('reduces current HP', () => {
      useCharacterStore.getState().applyDamageToCharacter(10);
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(34);
    });

    it('absorbs damage in temp HP first', () => {
      resetStore({ hitPoints: { current: 44, max: 44, temporary: 10, calculationMode: 'auto' as const } });
      useCharacterStore.getState().applyDamageToCharacter(15);
      const hp = useCharacterStore.getState().character.hitPoints;
      expect(hp.temporary).toBe(0);
      expect(hp.current).toBe(39);
    });

    it('triggers death saves at 0 HP', () => {
      useCharacterStore.getState().applyDamageToCharacter(44);
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(0);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().applyDamageToCharacter(10);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('applyHealingToCharacter', () => {
    it('increases current HP', () => {
      resetStore({ hitPoints: { current: 20, max: 44, temporary: 0, calculationMode: 'auto' as const } });
      useCharacterStore.getState().applyHealingToCharacter(10);
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(30);
    });

    it('caps at max HP', () => {
      resetStore({ hitPoints: { current: 40, max: 44, temporary: 0, calculationMode: 'auto' as const } });
      useCharacterStore.getState().applyHealingToCharacter(20);
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(44);
    });
  });

  describe('addTemporaryHPToCharacter', () => {
    it('sets temporary HP', () => {
      useCharacterStore.getState().addTemporaryHPToCharacter(10);
      expect(useCharacterStore.getState().character.hitPoints.temporary).toBe(10);
    });

    it('takes higher value (no stacking)', () => {
      resetStore({ hitPoints: { current: 44, max: 44, temporary: 15, calculationMode: 'auto' as const } });
      useCharacterStore.getState().addTemporaryHPToCharacter(10);
      expect(useCharacterStore.getState().character.hitPoints.temporary).toBe(15);
    });
  });

  describe('makeDeathSavingThrow', () => {
    beforeEach(() => {
      resetStore({
        hitPoints: {
          current: 0,
          max: 44,
          temporary: 0,
          calculationMode: 'auto' as const,
          deathSaves: { successes: 0, failures: 0, isStabilized: false },
        },
      });
    });

    it('adds a success', () => {
      useCharacterStore.getState().makeDeathSavingThrow(true);
      expect(useCharacterStore.getState().character.hitPoints.deathSaves?.successes).toBe(1);
    });

    it('adds a failure', () => {
      useCharacterStore.getState().makeDeathSavingThrow(false);
      expect(useCharacterStore.getState().character.hitPoints.deathSaves?.failures).toBe(1);
    });

    it('critical success restores 1 HP', () => {
      useCharacterStore.getState().makeDeathSavingThrow(true, true);
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(1);
    });
  });

  describe('resetDeathSavingThrows', () => {
    it('clears death saves', () => {
      resetStore({
        hitPoints: {
          current: 0,
          max: 44,
          temporary: 0,
          calculationMode: 'auto' as const,
          deathSaves: { successes: 2, failures: 1, isStabilized: false },
        },
      });
      useCharacterStore.getState().resetDeathSavingThrows();
      expect(useCharacterStore.getState().character.hitPoints.deathSaves).toBeUndefined();
    });
  });

  describe('toggleHPCalculationMode', () => {
    it('switches from auto to manual', () => {
      useCharacterStore.getState().toggleHPCalculationMode();
      expect(useCharacterStore.getState().character.hitPoints.calculationMode).toBe('manual');
    });

    it('switches from manual to auto', () => {
      resetStore({ hitPoints: { current: 44, max: 44, temporary: 0, calculationMode: 'manual' as const } });
      useCharacterStore.getState().toggleHPCalculationMode();
      expect(useCharacterStore.getState().character.hitPoints.calculationMode).toBe('auto');
    });
  });

  describe('updateHitPoints', () => {
    it('updates HP fields', () => {
      useCharacterStore.getState().updateHitPoints({ current: 30 });
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(30);
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/characterStore-hp.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/characterStore-hp.test.ts
git commit -m "test: add characterStore HP management tests"
```

---

### Task 3: characterStore — class, level, multiclass, hit dice, XP

**Files:**
- Create: `src/store/__tests__/characterStore-class.test.ts`

- [ ] **Step 1: Write the test file**

Test the following actions (read `src/store/characterStore.ts` to verify signatures):
- `updateClass` — sets class info, recalculates spell slots
- `updateLevel` — sets level, recalculates spell slots and pact magic
- `addClassLevel` — adds a new class to multiclass
- `removeClassLevel` — removes a class from multiclass
- `updateClassLevel` — changes level of existing class
- `useHitDie` / `restoreHitDice` / `resetAllHitDice` — hit dice tracking
- `addExperience` / `setExperience` — XP management with level-up detection

Use `resetStore` pattern from Task 1. For multiclass tests, initialize with `classes` array:
```typescript
resetStore({
  classes: [
    { className: 'Fighter', level: 3, hitDie: 10, spellcaster: 'none', isCustom: false },
    { className: 'Wizard', level: 2, hitDie: 6, spellcaster: 'full', isCustom: false },
  ],
  hitDicePools: { d10: { max: 3, used: 0 }, d6: { max: 2, used: 0 } },
});
```

Key assertions:
- `updateClass` → `character.class` is updated, spell slots recalculated
- `addClassLevel` → `character.classes` has new entry
- `useHitDie('d10')` → `character.hitDicePools.d10.used` increments
- `addExperience` → `character.experience` increases

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/characterStore-class.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/characterStore-class.test.ts
git commit -m "test: add characterStore class/level/multiclass/XP tests"
```

---

### Task 4: characterStore — spell slots, pact magic, concentration, spellbook

**Files:**
- Create: `src/store/__tests__/characterStore-spells.test.ts`

- [ ] **Step 1: Write the test file**

Test these actions:
- `updateSpellSlot` — sets used count for a spell slot level
- `updatePactMagicSlot` — sets used count for pact magic
- `resetSpellSlots` — resets all spell slot used counts to 0
- `resetPactMagicSlots` — resets pact magic used to 0
- `startConcentration` — sets concentration spell (name, spellId, optional castLevel)
- `stopConcentration` — clears concentration
- `addSpellToSpellbook` — adds spell ID to known list
- `removeSpellFromSpellbook` — removes spell ID
- `toggleSpellFavorite` — toggles favorite status for a spell ID
- `prepareSpell` / `unprepareSpell` — toggles prepared status
- `addCustomSpell` — adds a custom spell object
- `reorderSpells` — reorders prepared spells
- `updateSpellbookSettings` — updates spellbook display settings

For testing, use `makeWizard` to get a full caster with spell slots:
```typescript
resetStore({
  ...makeWizard(),
  spellSlots: {
    1: { max: 4, used: 2 },
    2: { max: 3, used: 0 },
    3: { max: 2, used: 0 },
    ...emptySlots,
  },
});
```

Key assertions:
- `updateSpellSlot(1, 3)` → `spellSlots[1].used === 3`
- `startConcentration('Shield', 'spell-1')` → `concentration.isConcentrating === true`
- `addSpellToSpellbook('fireball')` → `spellbook.knownSpellIds` includes `'fireball'`

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/characterStore-spells.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/characterStore-spells.test.ts
git commit -m "test: add characterStore spell/concentration/spellbook tests"
```

---

### Task 5: characterStore — weapons, armor, magic items, inventory, currency

**Files:**
- Create: `src/store/__tests__/characterStore-inventory.test.ts`

- [ ] **Step 1: Write the test file**

Test these actions (read source to verify exact signatures):

**Weapons:** `addWeapon`, `updateWeapon`, `deleteWeapon`, `equipWeapon`, `reorderWeapons`, `expendWeaponCharge`, `restoreWeaponCharge`

**Armor:** `addArmorItem`, `updateArmorItem`, `deleteArmorItem`, `equipArmorItem`

**Magic Items:** `addMagicItem`, `updateMagicItem`, `deleteMagicItem`, `attuneMagicItem`, `expendMagicItemCharge`, `restoreMagicItemCharge`

**Inventory:** `addInventoryItem`, `updateInventoryItem`, `deleteInventoryItem`, `updateItemQuantity`

**Currency:** `updateCurrency`, `addCurrency`, `subtractCurrency`

For weapon tests, create a minimal weapon:
```typescript
const sword = {
  name: 'Longsword',
  category: 'martial' as const,
  weaponType: ['melee'] as string[],
  damage: [{ dice: '1d8', type: 'slashing' as const, label: 'Slashing' }],
  enhancementBonus: 0,
  isEquipped: true,
  properties: [],
};
```

Key assertions:
- `addWeapon(sword)` → `character.weapons` has 1 entry with generated ID
- `deleteWeapon(id)` → `character.weapons` is empty
- `addCurrency({ gold: 10 })` → `character.currency.gold` increases by 10
- `subtractCurrency({ gold: 5 })` → `character.currency.gold` decreases by 5

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/characterStore-inventory.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/characterStore-inventory.test.ts
git commit -m "test: add characterStore inventory/weapons/armor/currency tests"
```

---

### Task 6: characterStore — features, traits, notes

**Files:**
- Create: `src/store/__tests__/characterStore-features.test.ts`

- [ ] **Step 1: Write the test file**

Test these actions:

**Extended features:** `addExtendedFeature`, `updateExtendedFeature`, `deleteExtendedFeature`, `useExtendedFeature`, `resetExtendedFeatures`, `reorderExtendedFeatures`, `toggleFavoriteFeature`

**Trackable traits:** `addTrackableTrait`, `updateTrackableTrait`, `deleteTrackableTrait`, `useTrackableTrait`, `resetTrackableTraits`

**Features/traits:** `addFeature`, `updateFeature`, `deleteFeature`, `addTrait`, `updateTrait`, `deleteTrait`

**Notes:** `addNote`, `updateNote`, `deleteNote`, `reorderNotes`

**Background:** `updateCharacterBackground`

For extended features, create a minimal feature:
```typescript
const feature = {
  name: 'Action Surge',
  description: 'Extra action',
  sourceType: 'class' as const,
  maxUses: 1,
  usedUses: 0,
  restType: 'short' as const,
  isPassive: false,
};
```

Key assertions:
- `addExtendedFeature(feature)` → `character.extendedFeatures` has 1 entry
- `useExtendedFeature(id)` → `usedUses` increments
- `resetExtendedFeatures('short')` → short rest features have `usedUses: 0`

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/characterStore-features.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/characterStore-features.test.ts
git commit -m "test: add characterStore features/traits/notes tests"
```

---

### Task 7: characterStore — conditions, diseases, buffs, defenses, senses

**Files:**
- Create: `src/store/__tests__/characterStore-conditions.test.ts`

- [ ] **Step 1: Write the test file**

Test these actions:

**Conditions:** `addCondition`, `updateCondition`, `removeCondition`, `clearAllConditions`

**Diseases:** `addDisease`, `updateDisease`, `removeDisease`, `clearAllDiseases`

**Exhaustion:** `setExhaustionVariant`

**Buffs:** `addBuff`, `updateBuff`, `deleteBuff`, `toggleBuff`, `clearAllBuffs`

**Defenses:** `addDamageImmunity`, `removeDamageImmunity`, `addDamageResistance`, `removeDamageResistance`, `addConditionImmunity`, `removeConditionImmunity`

**Senses:** `addSense`, `updateSense`, `removeSense`

**Languages:** `addLanguage`, `deleteLanguage`

**Tool proficiencies:** `addToolProficiency`, `updateToolProficiency`, `deleteToolProficiency`

**AC management:** `updateTempArmorClass`, `toggleTempAC`, `toggleShield`, `updateShieldBonus`

For conditions, use:
```typescript
const condition = {
  name: 'Poisoned',
  source: 'combat' as const,
};
```

For buffs, use:
```typescript
const buff = {
  name: 'Shield of Faith',
  isActive: true,
  effects: [{ targetStat: 'ac' as const, mode: 'add' as const, value: 2 }],
};
```

Key assertions:
- `addCondition(condition)` → `character.conditionsAndDiseases.activeConditions` grows
- `toggleBuff(id)` → buff's `isActive` toggles
- `addDamageImmunity('fire')` → `character.damageImmunities` includes `'fire'`
- `toggleShield()` → `character.isWearingShield` toggles

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/characterStore-conditions.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/characterStore-conditions.test.ts
git commit -m "test: add characterStore conditions/buffs/defenses/senses tests"
```

---

### Task 8: characterStore — short rest and long rest

**Files:**
- Create: `src/store/__tests__/characterStore-rest.test.ts`

- [ ] **Step 1: Write the test file**

These are integration tests that verify rest mechanics reset the correct state. The character needs various used resources to verify resets.

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

function resetStoreWithUsedResources() {
  useCharacterStore.setState({
    character: makeCharacter({
      // Short rest resources
      trackableTraits: [
        { id: 't1', name: 'Action Surge', maxUses: 1, usedUses: 1, restType: 'short', scaleWithProficiency: false },
        { id: 't2', name: 'Second Wind', maxUses: 1, usedUses: 1, restType: 'long', scaleWithProficiency: false },
      ],
      extendedFeatures: [
        { id: 'ef1', name: 'Channel Divinity', description: '', sourceType: 'class', maxUses: 1, usedUses: 1, restType: 'short', isPassive: false },
        { id: 'ef2', name: 'Wild Shape', description: '', sourceType: 'class', maxUses: 2, usedUses: 2, restType: 'long', isPassive: false },
      ],
      weapons: [
        {
          id: 'w1', name: 'Rod', category: 'simple', weaponType: ['melee'],
          damage: [], enhancementBonus: 0, isEquipped: true, properties: [],
          createdAt: '', updatedAt: '',
          charges: [
            { id: 'c1', name: 'Charge', maxCharges: 3, usedCharges: 2, restType: 'short' },
          ],
        } as any,
      ],
      pactMagic: { slots: { max: 2, used: 2 }, level: 3 },
      reaction: { hasUsedReaction: true },
      spellSlots: {
        1: { max: 4, used: 3 },
        2: { max: 3, used: 2 },
        3: { max: 2, used: 1 },
        4: { max: 0, used: 0 },
        5: { max: 0, used: 0 },
        6: { max: 0, used: 0 },
        7: { max: 0, used: 0 },
        8: { max: 0, used: 0 },
        9: { max: 0, used: 0 },
      },
      hitPoints: { current: 20, max: 44, temporary: 5, calculationMode: 'auto' as const },
      hitDicePools: { d10: { max: 5, used: 3 } },
    }),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    lastSaved: null,
    showDeathAnimation: false,
    showLevelUpAnimation: false,
    levelUpAnimationLevel: 1,
  });
  usePlayerStore.setState({
    characters: [],
    activeCharacterId: null,
    settings: { enableDeathAnimation: false, enableLevelUpAnimation: false },
    lastSelectedCharacterId: null,
  });
}

describe('characterStore — rests', () => {
  beforeEach(resetStoreWithUsedResources);

  describe('takeShortRest', () => {
    it('resets short rest trackable traits only', () => {
      useCharacterStore.getState().takeShortRest();
      const { character } = useCharacterStore.getState();
      expect(character.trackableTraits[0].usedUses).toBe(0); // short rest → reset
      expect(character.trackableTraits[1].usedUses).toBe(1); // long rest → untouched
    });

    it('resets short rest extended features only', () => {
      useCharacterStore.getState().takeShortRest();
      const { character } = useCharacterStore.getState();
      expect(character.extendedFeatures[0].usedUses).toBe(0); // short rest → reset
      expect(character.extendedFeatures[1].usedUses).toBe(2); // long rest → untouched
    });

    it('resets pact magic slots', () => {
      useCharacterStore.getState().takeShortRest();
      expect(useCharacterStore.getState().character.pactMagic?.slots.used).toBe(0);
    });

    it('resets reaction', () => {
      useCharacterStore.getState().takeShortRest();
      expect(useCharacterStore.getState().character.reaction.hasUsedReaction).toBe(false);
    });

    it('resets short rest weapon charges only', () => {
      useCharacterStore.getState().takeShortRest();
      expect(useCharacterStore.getState().character.weapons[0].charges![0].usedCharges).toBe(0);
    });

    it('does NOT reset spell slots', () => {
      useCharacterStore.getState().takeShortRest();
      expect(useCharacterStore.getState().character.spellSlots[1].used).toBe(3);
    });

    it('does NOT reset hit points', () => {
      useCharacterStore.getState().takeShortRest();
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(20);
    });
  });

  describe('takeLongRest', () => {
    it('resets ALL trackable traits', () => {
      useCharacterStore.getState().takeLongRest();
      const { character } = useCharacterStore.getState();
      expect(character.trackableTraits[0].usedUses).toBe(0);
      expect(character.trackableTraits[1].usedUses).toBe(0);
    });

    it('resets ALL extended features', () => {
      useCharacterStore.getState().takeLongRest();
      const { character } = useCharacterStore.getState();
      expect(character.extendedFeatures[0].usedUses).toBe(0);
      expect(character.extendedFeatures[1].usedUses).toBe(0);
    });

    it('resets ALL spell slots', () => {
      useCharacterStore.getState().takeLongRest();
      const { character } = useCharacterStore.getState();
      expect(character.spellSlots[1].used).toBe(0);
      expect(character.spellSlots[2].used).toBe(0);
      expect(character.spellSlots[3].used).toBe(0);
    });

    it('resets pact magic', () => {
      useCharacterStore.getState().takeLongRest();
      expect(useCharacterStore.getState().character.pactMagic?.slots.used).toBe(0);
    });

    it('resets hit dice', () => {
      useCharacterStore.getState().takeLongRest();
      expect(useCharacterStore.getState().character.hitDicePools?.d10?.used).toBe(0);
    });

    it('heals to max HP', () => {
      useCharacterStore.getState().takeLongRest();
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(44);
    });

    it('clears temporary HP', () => {
      useCharacterStore.getState().takeLongRest();
      expect(useCharacterStore.getState().character.hitPoints.temporary).toBe(0);
    });

    it('resets reaction', () => {
      useCharacterStore.getState().takeLongRest();
      expect(useCharacterStore.getState().character.reaction.hasUsedReaction).toBe(false);
    });

    it('clears death saves', () => {
      useCharacterStore.getState().takeLongRest();
      expect(useCharacterStore.getState().character.hitPoints.deathSaves).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/characterStore-rest.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/characterStore-rest.test.ts
git commit -m "test: add characterStore short/long rest integration tests"
```

---

### Task 9: characterStore — summons and saved creatures

**Files:**
- Create: `src/store/__tests__/characterStore-summons.test.ts`

- [ ] **Step 1: Write the test file**

Test these actions (read `src/store/characterStore.ts` to verify signatures):
- `addSummon` — adds a summon to the summons array
- `removeSummon` — removes by ID
- `updateSummonEntity` — updates entity fields
- `damageSummon` — reduces HP, absorbs temp HP
- `healSummon` — increases HP capped at max
- `addSummonTempHp` — sets temp HP (takes higher)
- `addSummonCondition` / `removeSummonCondition` — condition management
- `removeConcentrationSummons` — removes all summons that require concentration
- `dismissFamiliar` — removes familiar-type summons
- `addSavedCreature` / `updateSavedCreature` / `removeSavedCreature` — saved creature templates

Create a minimal summon entity matching the `Summon` type from `@/types/summon`. Read that type file first.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/characterStore-summons.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/characterStore-summons.test.ts
git commit -m "test: add characterStore summons and saved creatures tests"
```

---

### Task 10: characterStore — persistence, migration, export/import

**Files:**
- Create: `src/store/__tests__/characterStore-persistence.test.ts`

- [ ] **Step 1: Write the test file**

Test these actions:
- `saveCharacter` — sets `saveStatus: 'saved'`, `hasUnsavedChanges: false`, updates `lastSaved`
- `loadCharacter` — loads a full character, resets save state
- `resetCharacter` — resets to `DEFAULT_CHARACTER_STATE` with new ID
- `exportCharacter` — returns `CharacterExport` object with version and character
- `importCharacter` — accepts `CharacterExport` or raw `CharacterState`, runs migration
- `loadCharacterState` — loads + migrates + multiclass migration
- `markSaved` / `markUnsaved` — manual save status updates
- `migrateWeaponDamage` (function, not action) — converts old weapon damage format
- `migrateCharacterData` (function, not action) — handles old character data shapes

For migration tests, create old-format data:
```typescript
const oldCharacter = {
  ...makeCharacter(),
  weapons: [{
    id: 'w1', name: 'Sword',
    damage: { dice: '1d8', type: 'slashing' }, // OLD format (object, not array)
    category: 'martial', weaponType: ['melee'],
    enhancementBonus: 0, isEquipped: true, properties: [],
    createdAt: '', updatedAt: '',
  }],
};
```

Key assertions:
- `exportCharacter()` returns object with `version` and `character`
- `loadCharacterState(oldCharacter)` migrates weapon damage to array format
- `resetCharacter()` creates new ID different from previous

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/characterStore-persistence.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/characterStore-persistence.test.ts
git commit -m "test: add characterStore persistence/migration/export tests"
```

---

### Task 11: playerStore tests

**Files:**
- Create: `src/store/__tests__/playerStore.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStore } from '@/store/playerStore';

function resetStore() {
  usePlayerStore.setState({
    characters: [],
    activeCharacterId: null,
    settings: { enableDeathAnimation: false, enableLevelUpAnimation: false },
    lastSelectedCharacterId: null,
  });
}

describe('playerStore', () => {
  beforeEach(resetStore);

  describe('createCharacter', () => {
    it('creates a character and returns its ID', () => {
      const id = usePlayerStore.getState().createCharacter('Test Hero');
      expect(id).toBeTruthy();
      expect(usePlayerStore.getState().characters).toHaveLength(1);
      expect(usePlayerStore.getState().characters[0].name).toBe('Test Hero');
    });

    it('sets timestamps on creation', () => {
      usePlayerStore.getState().createCharacter('New Hero');
      const char = usePlayerStore.getState().characters[0];
      expect(char.createdAt).toBeTruthy();
      expect(char.updatedAt).toBeTruthy();
    });

    it('creates character with custom data', () => {
      usePlayerStore.getState().createCharacter('Wizard', {
        class: { name: 'Wizard', isCustom: false, spellcaster: 'full', hitDie: 6 },
      });
      const char = usePlayerStore.getState().characters[0];
      expect(char.characterData.class.name).toBe('Wizard');
    });
  });

  describe('deleteCharacter', () => {
    it('removes the character', () => {
      const id = usePlayerStore.getState().createCharacter('ToDelete');
      usePlayerStore.getState().deleteCharacter(id);
      expect(usePlayerStore.getState().characters).toHaveLength(0);
    });

    it('clears activeCharacterId if deleted', () => {
      const id = usePlayerStore.getState().createCharacter('Active');
      usePlayerStore.getState().setActiveCharacter(id);
      usePlayerStore.getState().deleteCharacter(id);
      expect(usePlayerStore.getState().activeCharacterId).toBeNull();
    });
  });

  describe('archiveCharacter / restoreCharacter', () => {
    it('archives a character', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().archiveCharacter(id);
      expect(usePlayerStore.getState().getArchivedCharacters()).toHaveLength(1);
      expect(usePlayerStore.getState().getActiveCharacters()).toHaveLength(0);
    });

    it('restores an archived character', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().archiveCharacter(id);
      usePlayerStore.getState().restoreCharacter(id);
      expect(usePlayerStore.getState().getArchivedCharacters()).toHaveLength(0);
      expect(usePlayerStore.getState().getActiveCharacters()).toHaveLength(1);
    });
  });

  describe('duplicateCharacter', () => {
    it('creates a copy with a new name and ID', () => {
      const id = usePlayerStore.getState().createCharacter('Original');
      const newId = usePlayerStore.getState().duplicateCharacter(id, 'Clone');
      expect(newId).not.toBe(id);
      expect(usePlayerStore.getState().characters).toHaveLength(2);
      expect(usePlayerStore.getState().getCharacterById(newId)?.name).toBe('Clone');
    });
  });

  describe('setActiveCharacter', () => {
    it('sets the active character ID', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().setActiveCharacter(id);
      expect(usePlayerStore.getState().activeCharacterId).toBe(id);
    });

    it('can clear active character', () => {
      usePlayerStore.getState().setActiveCharacter(null);
      expect(usePlayerStore.getState().activeCharacterId).toBeNull();
    });
  });

  describe('getActiveCharacter', () => {
    it('returns null when no active character', () => {
      expect(usePlayerStore.getState().getActiveCharacter()).toBeNull();
    });

    it('returns the active character', () => {
      const id = usePlayerStore.getState().createCharacter('Hero');
      usePlayerStore.getState().setActiveCharacter(id);
      expect(usePlayerStore.getState().getActiveCharacter()?.id).toBe(id);
    });
  });

  describe('updateSettings', () => {
    it('merges settings', () => {
      usePlayerStore.getState().updateSettings({ enableDeathAnimation: true });
      expect(usePlayerStore.getState().settings.enableDeathAnimation).toBe(true);
      expect(usePlayerStore.getState().settings.enableLevelUpAnimation).toBe(false);
    });
  });

  describe('resetSettings', () => {
    it('resets to defaults', () => {
      usePlayerStore.getState().updateSettings({ enableDeathAnimation: true });
      usePlayerStore.getState().resetSettings();
      expect(usePlayerStore.getState().settings.enableDeathAnimation).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/playerStore.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/playerStore.test.ts
git commit -m "test: add playerStore tests"
```

---

### Task 12: calendarStore tests

**Files:**
- Create: `src/store/__tests__/calendarStore.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useCalendarStore } from '@/store/calendarStore';
import type { CalendarConfig } from '@/types/calendar';

const CAMPAIGN = 'test-campaign';

const mockConfig: CalendarConfig = {
  weekdays: ['Moonday', 'Starday'],
  months: [{ name: 'Deepwinter', days: 30 }, { name: 'Alturiak', days: 30 }],
  seasons: [],
  moons: [],
  hoursPerDay: 24,
  minutesPerHour: 60,
  secondsPerMinute: 60,
  secondsPerRound: 6,
  minutesPerShortRest: 60,
  hoursPerLongRest: 8,
};

function resetStore() {
  useCalendarStore.setState({ calendars: [] });
}

describe('calendarStore', () => {
  beforeEach(resetStore);

  describe('initCalendar', () => {
    it('creates a calendar for a campaign', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      const cal = useCalendarStore.getState().getCalendar(CAMPAIGN);
      expect(cal).toBeDefined();
      expect(cal!.currentTime).toBe(0);
      expect(cal!.startTime).toBe(0);
      expect(cal!.events).toEqual([]);
    });

    it('does not overwrite existing calendar', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      useCalendarStore.getState().setTime(CAMPAIGN, 1000);
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      expect(useCalendarStore.getState().getCalendar(CAMPAIGN)!.currentTime).toBe(1000);
    });
  });

  describe('deleteCalendar', () => {
    it('removes the calendar', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      useCalendarStore.getState().deleteCalendar(CAMPAIGN);
      expect(useCalendarStore.getState().getCalendar(CAMPAIGN)).toBeUndefined();
    });
  });

  describe('updateConfig', () => {
    it('updates calendar config', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      const newConfig = { ...mockConfig, hoursPerDay: 20 };
      useCalendarStore.getState().updateConfig(CAMPAIGN, newConfig);
      expect(useCalendarStore.getState().getCalendar(CAMPAIGN)!.config.hoursPerDay).toBe(20);
    });
  });

  describe('setTime / advanceTime', () => {
    it('sets absolute time', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      useCalendarStore.getState().setTime(CAMPAIGN, 5000);
      expect(useCalendarStore.getState().getCalendar(CAMPAIGN)!.currentTime).toBe(5000);
    });

    it('advances time by delta', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      useCalendarStore.getState().setTime(CAMPAIGN, 1000);
      useCalendarStore.getState().advanceTime(CAMPAIGN, 500);
      expect(useCalendarStore.getState().getCalendar(CAMPAIGN)!.currentTime).toBe(1500);
    });
  });

  describe('setStartDate', () => {
    it('sets both startTime and currentTime', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      useCalendarStore.getState().setStartDate(CAMPAIGN, 2000);
      const cal = useCalendarStore.getState().getCalendar(CAMPAIGN)!;
      expect(cal.startTime).toBe(2000);
      expect(cal.currentTime).toBe(2000);
    });
  });

  describe('events', () => {
    beforeEach(() => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
    });

    it('addEvent creates an event with generated ID', () => {
      useCalendarStore.getState().addEvent(CAMPAIGN, {
        name: 'Festival', year: 1, month: 0, day: 15, description: 'A party!',
      });
      const cal = useCalendarStore.getState().getCalendar(CAMPAIGN)!;
      expect(cal.events).toHaveLength(1);
      expect(cal.events[0].name).toBe('Festival');
      expect(cal.events[0].id).toMatch(/^evt-/);
    });

    it('updateEvent updates event fields', () => {
      useCalendarStore.getState().addEvent(CAMPAIGN, {
        name: 'Old', year: 1, month: 0, day: 1, description: '',
      });
      const evtId = useCalendarStore.getState().getCalendar(CAMPAIGN)!.events[0].id;
      useCalendarStore.getState().updateEvent(CAMPAIGN, evtId, { name: 'New' });
      expect(useCalendarStore.getState().getCalendar(CAMPAIGN)!.events[0].name).toBe('New');
    });

    it('deleteEvent removes the event', () => {
      useCalendarStore.getState().addEvent(CAMPAIGN, {
        name: 'ToDelete', year: 1, month: 0, day: 1, description: '',
      });
      const evtId = useCalendarStore.getState().getCalendar(CAMPAIGN)!.events[0].id;
      useCalendarStore.getState().deleteEvent(CAMPAIGN, evtId);
      expect(useCalendarStore.getState().getCalendar(CAMPAIGN)!.events).toHaveLength(0);
    });

    it('getEventsForDay filters by date', () => {
      useCalendarStore.getState().addEvent(CAMPAIGN, {
        name: 'Day 1', year: 1, month: 0, day: 1, description: '',
      });
      useCalendarStore.getState().addEvent(CAMPAIGN, {
        name: 'Day 2', year: 1, month: 0, day: 2, description: '',
      });
      const events = useCalendarStore.getState().getEventsForDay(CAMPAIGN, 1, 0, 1);
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('Day 1');
    });
  });

  describe('setWeather', () => {
    it('sets weather on calendar', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      useCalendarStore.getState().setWeather(CAMPAIGN, 'rain');
      expect(useCalendarStore.getState().getCalendar(CAMPAIGN)!.weather).toBe('rain');
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/calendarStore.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/calendarStore.test.ts
git commit -m "test: add calendarStore tests"
```

---

### Task 13: battleMapStore, locationStore tests

**Files:**
- Create: `src/store/__tests__/battleMapStore.test.ts`
- Create: `src/store/__tests__/locationStore.test.ts`

- [ ] **Step 1: Write battleMapStore.test.ts**

Test all actions: `addBattleMap`, `updateBattleMap`, `removeBattleMap`, `getBattleMap`, `getBattleMaps`, `setDmOnly`, `toggleDmOnly`, `linkEncounter`, `unlinkEncounter`.

Read `src/types/battlemap.ts` for the `BattleMap` type to create test data. Pattern:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useBattleMapStore } from '@/store/battleMapStore';

const CAMPAIGN = 'test-campaign';

function resetStore() {
  useBattleMapStore.setState({ battleMaps: {} });
}

// Create minimal BattleMap matching the type
const makeBattleMap = (id: string, name: string) => ({
  id,
  name,
  imageUrl: 'test.png',
  dmOnlyElements: [],
  linkedEncounterIds: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
```

- [ ] **Step 2: Write locationStore.test.ts**

Same pattern — `addLocation`, `updateLocation`, `removeLocation`, `getLocation`, `getLocations`, `setDmOnly`, `toggleDmOnly`. Read `src/types/location.ts` for the `LocationMap` type.

- [ ] **Step 3: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/battleMapStore.test.ts src/store/__tests__/locationStore.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/store/__tests__/battleMapStore.test.ts src/store/__tests__/locationStore.test.ts
git commit -m "test: add battleMapStore and locationStore tests"
```

---

### Task 14: combatLogStore tests

**Files:**
- Create: `src/store/__tests__/combatLogStore.test.ts`

- [ ] **Step 1: Write the test file**

Test all actions: `startEncounterLog`, `endEncounterLog`, `setActiveEncounterLog`, `logEvent`, `getEvents`, `getFilteredEvents`, `exportEncounter`, `pruneOldEncounters`, `clearEncounterLog`.

Read `src/types/combatLog.ts` for `CombatLogEvent` and `CombatLogFilters` types. Key tests:
- `startEncounterLog` → creates encounter entry, sets active
- `logEvent` → adds event with generated ID and timestamp
- `getFilteredEvents` → filters by type, entityId, roundRange, searchQuery
- `pruneOldEncounters` → keeps only newest 10
- `exportEncounter('json')` vs `exportEncounter('text')` — different formats

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/combatLogStore.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/combatLogStore.test.ts
git commit -m "test: add combatLogStore tests"
```

---

### Task 15: Extend existing encounterStore tests

**Files:**
- Modify: `src/store/__tests__/encounterStore.test.ts`

- [ ] **Step 1: Review existing coverage**

The existing file covers: CRUD, entity management, combat flow, initiative, damage/heal, conditions, abilities, legendary actions, concentration, lair actions.

Missing coverage (verify by reading the source):
- `getEncountersByCampaign` — filters encounters by campaign code
- `longRestEntity` — resets HP, death saves, spell slots, hit dice, abilities, legendary actions
- `addTempHp` — adds temp HP to entity
- `reorderEntities` — reorders entities in encounter
- `setEntityHp` — sets entity HP directly
- `updateCondition` — modifies existing condition

- [ ] **Step 2: Add tests for uncovered functions**

Append new `describe` blocks after existing tests, following the same style.

- [ ] **Step 3: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/encounterStore.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/store/__tests__/encounterStore.test.ts
git commit -m "test: extend encounterStore test coverage"
```

---

### Task 16: Extend existing npcStore and dmStore tests

**Files:**
- Modify: `src/store/__tests__/npcStore.test.ts`
- Modify: `src/store/__tests__/dmStore.test.ts`

- [ ] **Step 1: Review existing npcStore coverage**

Currently covers: CRUD, update, delete, get, campaign isolation. Missing: `reorderNPCsSubset`, `updateDeathSaves`, `addSpellToNPC`, `updateSpellOnNPC`, `removeSpellFromNPC`, `setNPCSpellSlotUsed`, `useNPCFreeCast`, `longRestNPC`.

- [ ] **Step 2: Add npcStore tests for missing actions**

- [ ] **Step 3: Review existing dmStore coverage**

Currently covers: addCampaign, removeCampaign, getCampaign. Missing: `updateCampaign`, `setCustomCounterLabel`, `adjustPlayerCounter`, `setPlayerCounter`, `setPlayerColor`, `getPlayerColor`, `setDmDashboardUi`.

- [ ] **Step 4: Add dmStore tests for missing actions**

- [ ] **Step 5: Run the tests**

Run: `npm run test -- --reporter=verbose src/store/__tests__/npcStore.test.ts src/store/__tests__/dmStore.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/store/__tests__/npcStore.test.ts src/store/__tests__/dmStore.test.ts
git commit -m "test: extend npcStore and dmStore test coverage"
```

---

### Task 17: Full suite verification

- [ ] **Step 1: Run all unit tests**

Run: `npm run test -- --reporter=verbose`

Expected: All tests pass.

- [ ] **Step 2: Run type checking**

Run: `npm run type-check`

Expected: No new type errors.

- [ ] **Step 3: Final commit with any fixes**

If any test needed fixing:

```bash
git add -u
git commit -m "test: fix any issues found during full test suite run"
```

- [ ] **Step 4: Verify test count**

Run: `npm run test -- --reporter=verbose 2>&1 | tail -5`

Expected: Significantly more tests than after Phase 1 (~1,159 → ~1,400+ total).
