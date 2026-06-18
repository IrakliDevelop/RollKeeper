import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

function resetStore(overrides: Record<string, unknown> = {}) {
  useCharacterStore.setState({
    character: makeCharacter(overrides),
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
    settings: {
      enableDeathAnimation: false,
      enableLevelUpAnimation: false,
      enableCombatStartBanner: false,
    },
    lastSelectedCharacterId: null,
  });
}

function resetMulticlassStore() {
  resetStore({
    classes: [
      {
        className: 'Fighter',
        level: 3,
        hitDie: 10,
        spellcaster: 'none',
        isCustom: false,
      },
      {
        className: 'Wizard',
        level: 2,
        hitDie: 6,
        spellcaster: 'full',
        isCustom: false,
      },
    ],
    hitDicePools: { d10: { max: 3, used: 0 }, d6: { max: 2, used: 0 } },
    level: 5,
    totalLevel: 5,
  });
}

describe('characterStore — class, level, multiclass, hit dice, XP', () => {
  beforeEach(() => resetStore());

  // ─── updateClass ──────────────────────────────────────────────────────────

  describe('updateClass', () => {
    it('updates the primary class name', () => {
      useCharacterStore.getState().updateClass({
        name: 'Rogue',
        isCustom: false,
        spellcaster: 'none',
        hitDie: 8,
      });
      expect(useCharacterStore.getState().character.class.name).toBe('Rogue');
    });

    it('updates the class hitDie', () => {
      useCharacterStore.getState().updateClass({
        name: 'Barbarian',
        isCustom: false,
        spellcaster: 'none',
        hitDie: 12,
      });
      expect(useCharacterStore.getState().character.class.hitDie).toBe(12);
    });

    it('updates the class spellcaster type', () => {
      useCharacterStore.getState().updateClass({
        name: 'Wizard',
        isCustom: false,
        spellcaster: 'full',
        hitDie: 6,
      });
      expect(useCharacterStore.getState().character.class.spellcaster).toBe(
        'full'
      );
    });

    it('supports custom classes', () => {
      useCharacterStore.getState().updateClass({
        name: 'Homebrew Class',
        isCustom: true,
        spellcaster: 'none',
        hitDie: 8,
      });
      expect(useCharacterStore.getState().character.class.isCustom).toBe(true);
      expect(useCharacterStore.getState().character.class.name).toBe(
        'Homebrew Class'
      );
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().updateClass({
        name: 'Paladin',
        isCustom: false,
        spellcaster: 'half',
        hitDie: 10,
      });
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('recalculates spell slots for a full caster', () => {
      // Fighter (non-caster) → Wizard (full caster) at level 5 gets 3/2 slots at minimum
      useCharacterStore.getState().updateClass({
        name: 'Wizard',
        isCustom: false,
        spellcaster: 'full',
        hitDie: 6,
      });
      const { spellSlots } = useCharacterStore.getState().character;
      // A level 5 full caster has 4 L1, 3 L2, 2 L3
      expect(spellSlots[1].max).toBeGreaterThan(0);
    });

    it('sets spell slots to 0 for a non-caster', () => {
      // Start as a wizard, switch to Fighter
      resetStore({
        class: {
          name: 'Wizard',
          isCustom: false,
          spellcaster: 'full',
          hitDie: 6,
        },
      });
      useCharacterStore.getState().updateClass({
        name: 'Fighter',
        isCustom: false,
        spellcaster: 'none',
        hitDie: 10,
      });
      const { spellSlots } = useCharacterStore.getState().character;
      expect(spellSlots[1].max).toBe(0);
    });
  });

  // ─── updateLevel ──────────────────────────────────────────────────────────

  describe('updateLevel', () => {
    it('updates the character level', () => {
      useCharacterStore.getState().updateLevel(8);
      expect(useCharacterStore.getState().character.level).toBe(8);
    });

    it('updates totalLevel', () => {
      useCharacterStore.getState().updateLevel(10);
      expect(useCharacterStore.getState().character.totalLevel).toBe(10);
    });

    it('clamps level to minimum of 1', () => {
      useCharacterStore.getState().updateLevel(0);
      expect(useCharacterStore.getState().character.level).toBe(1);
    });

    it('clamps level to maximum of 20', () => {
      useCharacterStore.getState().updateLevel(25);
      expect(useCharacterStore.getState().character.level).toBe(20);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().updateLevel(6);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('does not trigger level up animation when disabled', () => {
      useCharacterStore.getState().updateLevel(6);
      expect(useCharacterStore.getState().showLevelUpAnimation).toBe(false);
    });

    it('recalculates spell slots for a full caster on level change', () => {
      resetStore({
        class: {
          name: 'Wizard',
          isCustom: false,
          spellcaster: 'full',
          hitDie: 6,
        },
        level: 1,
        totalLevel: 1,
      });
      useCharacterStore.getState().updateLevel(5);
      const { spellSlots } = useCharacterStore.getState().character;
      expect(spellSlots[1].max).toBeGreaterThan(0);
    });
  });

  // ─── addClassLevel ────────────────────────────────────────────────────────

  describe('addClassLevel', () => {
    it('adds a new class to the classes array', () => {
      useCharacterStore.getState().addClassLevel('Rogue', false, 'none', 8);
      const { classes } = useCharacterStore.getState().character;
      expect(classes?.some(c => c.className === 'Rogue')).toBe(true);
    });

    it('new class starts at level 1', () => {
      useCharacterStore.getState().addClassLevel('Rogue', false, 'none', 8);
      const { classes } = useCharacterStore.getState().character;
      const rogueClass = classes?.find(c => c.className === 'Rogue');
      expect(rogueClass?.level).toBe(1);
    });

    it('increases total level by 1', () => {
      const beforeLevel =
        useCharacterStore.getState().character.totalLevel ?? 5;
      useCharacterStore.getState().addClassLevel('Rogue', false, 'none', 8);
      expect(useCharacterStore.getState().character.totalLevel).toBe(
        beforeLevel + 1
      );
    });

    it('levels up existing class if it already exists', () => {
      resetMulticlassStore();
      useCharacterStore.getState().addClassLevel('Fighter', false, 'none', 10);
      const { classes } = useCharacterStore.getState().character;
      const fighter = classes?.find(c => c.className === 'Fighter');
      expect(fighter?.level).toBe(4); // Was 3, now 4
    });

    it('stores the spellcaster type for new class', () => {
      useCharacterStore.getState().addClassLevel('Wizard', false, 'full', 6);
      const { classes } = useCharacterStore.getState().character;
      const wizard = classes?.find(c => c.className === 'Wizard');
      expect(wizard?.spellcaster).toBe('full');
    });

    it('stores the subclass when provided', () => {
      useCharacterStore
        .getState()
        .addClassLevel('Ranger', false, 'half', 10, 'Gloom Stalker');
      const { classes } = useCharacterStore.getState().character;
      const ranger = classes?.find(c => c.className === 'Ranger');
      expect(ranger?.subclass).toBe('Gloom Stalker');
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().addClassLevel('Monk', false, 'none', 8);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  // ─── removeClassLevel ─────────────────────────────────────────────────────

  describe('removeClassLevel', () => {
    it('reduces a multiclass entry level by 1', () => {
      resetMulticlassStore();
      useCharacterStore.getState().removeClassLevel('Fighter');
      const { classes } = useCharacterStore.getState().character;
      const fighter = classes?.find(c => c.className === 'Fighter');
      expect(fighter?.level).toBe(2); // Was 3, now 2
    });

    it('removes the class entirely when its level reaches 0', () => {
      resetStore({
        classes: [
          {
            className: 'Fighter',
            level: 3,
            hitDie: 10,
            spellcaster: 'none',
            isCustom: false,
          },
          {
            className: 'Wizard',
            level: 1,
            hitDie: 6,
            spellcaster: 'full',
            isCustom: false,
          },
        ],
        hitDicePools: { d10: { max: 3, used: 0 }, d6: { max: 1, used: 0 } },
        level: 4,
        totalLevel: 4,
      });
      useCharacterStore.getState().removeClassLevel('Wizard');
      const { classes } = useCharacterStore.getState().character;
      expect(classes?.some(c => c.className === 'Wizard')).toBe(false);
    });

    it('reduces totalLevel by 1', () => {
      resetMulticlassStore();
      const before = useCharacterStore.getState().character.totalLevel ?? 5;
      useCharacterStore.getState().removeClassLevel('Wizard');
      expect(useCharacterStore.getState().character.totalLevel).toBe(
        before - 1
      );
    });

    it('does nothing when class is not found', () => {
      resetMulticlassStore();
      const beforeClasses =
        useCharacterStore.getState().character.classes?.length;
      useCharacterStore.getState().removeClassLevel('Paladin');
      expect(useCharacterStore.getState().character.classes?.length).toBe(
        beforeClasses
      );
    });

    it('marks unsaved changes', () => {
      resetMulticlassStore();
      useCharacterStore.getState().removeClassLevel('Wizard');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  // ─── updateClassLevel ─────────────────────────────────────────────────────

  describe('updateClassLevel', () => {
    it('sets the level of an existing class', () => {
      resetMulticlassStore();
      useCharacterStore.getState().updateClassLevel('Fighter', 5);
      const { classes } = useCharacterStore.getState().character;
      const fighter = classes?.find(c => c.className === 'Fighter');
      expect(fighter?.level).toBe(5);
    });

    it('updates totalLevel to reflect new sum', () => {
      resetMulticlassStore();
      useCharacterStore.getState().updateClassLevel('Fighter', 5);
      // Fighter 5 + Wizard 2 = 7
      expect(useCharacterStore.getState().character.totalLevel).toBe(7);
    });

    it('clamps level to minimum of 1', () => {
      resetMulticlassStore();
      useCharacterStore.getState().updateClassLevel('Wizard', 0);
      const { classes } = useCharacterStore.getState().character;
      const wizard = classes?.find(c => c.className === 'Wizard');
      expect(wizard?.level).toBe(1);
    });

    it('clamps level to maximum of 20', () => {
      resetMulticlassStore();
      useCharacterStore.getState().updateClassLevel('Fighter', 25);
      const { classes } = useCharacterStore.getState().character;
      const fighter = classes?.find(c => c.className === 'Fighter');
      expect(fighter?.level).toBe(20);
    });

    it('does nothing when class is not found', () => {
      resetMulticlassStore();
      const before = useCharacterStore.getState().character.totalLevel;
      useCharacterStore.getState().updateClassLevel('Paladin', 3);
      expect(useCharacterStore.getState().character.totalLevel).toBe(before);
    });

    it('marks unsaved changes', () => {
      resetMulticlassStore();
      useCharacterStore.getState().updateClassLevel('Fighter', 4);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  // ─── useHitDie ────────────────────────────────────────────────────────────

  describe('useHitDie', () => {
    beforeEach(() => {
      resetStore({
        hitDicePools: { d10: { max: 5, used: 0 } },
      });
    });

    it('increments used count by 1 by default', () => {
      useCharacterStore.getState().useHitDie('d10');
      expect(
        useCharacterStore.getState().character.hitDicePools?.d10.used
      ).toBe(1);
    });

    it('increments used count by the provided amount', () => {
      useCharacterStore.getState().useHitDie('d10', 3);
      expect(
        useCharacterStore.getState().character.hitDicePools?.d10.used
      ).toBe(3);
    });

    it('does not exceed the pool maximum', () => {
      useCharacterStore.getState().useHitDie('d10', 10);
      expect(
        useCharacterStore.getState().character.hitDicePools?.d10.used
      ).toBe(5); // max is 5
    });

    it('does nothing when all dice are already used', () => {
      resetStore({ hitDicePools: { d10: { max: 3, used: 3 } } });
      useCharacterStore.getState().useHitDie('d10');
      expect(
        useCharacterStore.getState().character.hitDicePools?.d10.used
      ).toBe(3);
    });

    it('does nothing for an unknown die type', () => {
      useCharacterStore.getState().useHitDie('d20');
      // Pool should be unchanged
      expect(
        useCharacterStore.getState().character.hitDicePools?.d10.used
      ).toBe(0);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().useHitDie('d10');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  // ─── restoreHitDice ───────────────────────────────────────────────────────

  describe('restoreHitDice', () => {
    beforeEach(() => {
      resetStore({
        hitDicePools: { d10: { max: 5, used: 4 } },
      });
    });

    it('decrements used count by 1 by default', () => {
      useCharacterStore.getState().restoreHitDice('d10');
      expect(
        useCharacterStore.getState().character.hitDicePools?.d10.used
      ).toBe(3);
    });

    it('decrements used count by the provided amount', () => {
      useCharacterStore.getState().restoreHitDice('d10', 3);
      expect(
        useCharacterStore.getState().character.hitDicePools?.d10.used
      ).toBe(1);
    });

    it('does not go below 0', () => {
      useCharacterStore.getState().restoreHitDice('d10', 10);
      expect(
        useCharacterStore.getState().character.hitDicePools?.d10.used
      ).toBe(0);
    });

    it('does nothing when no dice are used', () => {
      resetStore({ hitDicePools: { d10: { max: 5, used: 0 } } });
      useCharacterStore.getState().restoreHitDice('d10');
      expect(
        useCharacterStore.getState().character.hitDicePools?.d10.used
      ).toBe(0);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().restoreHitDice('d10');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  // ─── resetAllHitDice ──────────────────────────────────────────────────────

  describe('resetAllHitDice', () => {
    it('resets all used counts to 0', () => {
      resetStore({
        hitDicePools: {
          d10: { max: 3, used: 2 },
          d6: { max: 2, used: 2 },
        },
      });
      useCharacterStore.getState().resetAllHitDice();
      const { hitDicePools } = useCharacterStore.getState().character;
      expect(hitDicePools?.d10.used).toBe(0);
      expect(hitDicePools?.d6.used).toBe(0);
    });

    it('preserves max values', () => {
      resetStore({
        hitDicePools: { d10: { max: 5, used: 3 } },
      });
      useCharacterStore.getState().resetAllHitDice();
      expect(useCharacterStore.getState().character.hitDicePools?.d10.max).toBe(
        5
      );
    });

    it('marks unsaved changes', () => {
      resetStore({ hitDicePools: { d10: { max: 5, used: 3 } } });
      useCharacterStore.getState().resetAllHitDice();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  // ─── addExperience ────────────────────────────────────────────────────────

  describe('addExperience', () => {
    it('increases experience by the given amount', () => {
      // makeCharacter starts at experience: 6500 (level 5)
      useCharacterStore.getState().addExperience(1000);
      expect(useCharacterStore.getState().character.experience).toBe(7500);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().addExperience(500);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('updates character level when XP crosses a threshold', () => {
      // Level 5 requires 6500, level 6 requires 14000. Start at 6500.
      // Adding 7500 puts us at 14000 — level 6.
      useCharacterStore.getState().addExperience(7500);
      expect(useCharacterStore.getState().character.level).toBe(6);
    });

    it('does not reduce level when XP stays within current level range', () => {
      // Adding 500 XP stays at level 5 (still below 14000)
      useCharacterStore.getState().addExperience(500);
      expect(useCharacterStore.getState().character.level).toBe(5);
    });

    it('does not trigger level up animation when disabled', () => {
      // Adding enough XP to cross level 6 threshold
      useCharacterStore.getState().addExperience(7500);
      expect(useCharacterStore.getState().showLevelUpAnimation).toBe(false);
    });

    it('recalculates spell slots on level-up via XP for a caster', () => {
      resetStore({
        class: {
          name: 'Wizard',
          isCustom: false,
          spellcaster: 'full',
          hitDie: 6,
        },
        level: 5,
        totalLevel: 5,
        experience: 6500,
      });
      // Level 5 → 6 should give more spell slots
      const slotsBefore =
        useCharacterStore.getState().character.spellSlots[3].max;
      useCharacterStore.getState().addExperience(7500); // Pushes to level 6
      const slotsAfter =
        useCharacterStore.getState().character.spellSlots[3].max;
      expect(slotsAfter).toBeGreaterThanOrEqual(slotsBefore);
    });
  });

  // ─── setExperience ────────────────────────────────────────────────────────

  describe('setExperience', () => {
    it('sets experience to the given value', () => {
      useCharacterStore.getState().setExperience(10000);
      expect(useCharacterStore.getState().character.experience).toBe(10000);
    });

    it('marks unsaved changes', () => {
      useCharacterStore.getState().setExperience(8000);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('updates character level based on new XP', () => {
      // 14000 XP = level 6
      useCharacterStore.getState().setExperience(14000);
      expect(useCharacterStore.getState().character.level).toBe(6);
    });

    it('can set experience to 0 and keep level at 1', () => {
      useCharacterStore.getState().setExperience(0);
      expect(useCharacterStore.getState().character.experience).toBe(0);
      expect(useCharacterStore.getState().character.level).toBe(1);
    });

    it('does not trigger level up animation when disabled', () => {
      // Setting to level 10 XP from level 5
      useCharacterStore.getState().setExperience(64000);
      expect(useCharacterStore.getState().showLevelUpAnimation).toBe(false);
    });
  });

  // ─── multiclass spell slot recalculation ──────────────────────────────────

  describe('multiclass spell slot recalculation', () => {
    it('addClassLevel with a caster class grants spell slots', () => {
      // Start as level 5 Fighter (no spell slots)
      useCharacterStore.getState().addClassLevel('Wizard', false, 'full', 6);
      const { spellSlots } = useCharacterStore.getState().character;
      // Fighter 5 + Wizard 1 multiclass: combined caster level = floor(5/0) + 1 = just 1 full-caster level
      // Multiclass full caster: level 1 slots exist
      expect(spellSlots[1].max).toBeGreaterThan(0);
    });

    it('updateClassLevel recalculates pact magic for warlock subclass', () => {
      resetStore({
        classes: [
          {
            className: 'Warlock',
            level: 3,
            hitDie: 8,
            spellcaster: 'warlock',
            isCustom: false,
          },
        ],
        hitDicePools: { d8: { max: 3, used: 0 } },
        level: 3,
        totalLevel: 3,
        class: {
          name: 'Warlock',
          isCustom: false,
          spellcaster: 'warlock',
          hitDie: 8,
        },
      });
      useCharacterStore.getState().updateClassLevel('Warlock', 5);
      const { pactMagic } = useCharacterStore.getState().character;
      expect(pactMagic).toBeDefined();
      expect(pactMagic?.slots.max).toBeGreaterThan(0);
    });
  });
});
