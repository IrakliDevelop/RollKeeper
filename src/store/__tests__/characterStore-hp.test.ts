import { describe, it, expect, beforeEach } from 'vitest';
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

describe('characterStore — HP management', () => {
  beforeEach(() => resetStore());

  describe('applyDamageToCharacter', () => {
    it('reduces current HP', () => {
      useCharacterStore.getState().applyDamageToCharacter(10);
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(34);
    });

    it('absorbs damage in temp HP first', () => {
      resetStore({
        hitPoints: {
          current: 44,
          max: 44,
          temporary: 10,
          calculationMode: 'auto' as const,
        },
      });
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
      resetStore({
        hitPoints: {
          current: 20,
          max: 44,
          temporary: 0,
          calculationMode: 'auto' as const,
        },
      });
      useCharacterStore.getState().applyHealingToCharacter(10);
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(30);
    });

    it('caps at max HP', () => {
      resetStore({
        hitPoints: {
          current: 40,
          max: 44,
          temporary: 0,
          calculationMode: 'auto' as const,
        },
      });
      useCharacterStore.getState().applyHealingToCharacter(20);
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(44);
    });
  });

  describe('addTemporaryHPToCharacter', () => {
    it('sets temporary HP', () => {
      useCharacterStore.getState().addTemporaryHPToCharacter(10);
      expect(useCharacterStore.getState().character.hitPoints.temporary).toBe(
        10
      );
    });

    it('takes higher value (no stacking)', () => {
      resetStore({
        hitPoints: {
          current: 44,
          max: 44,
          temporary: 15,
          calculationMode: 'auto' as const,
        },
      });
      useCharacterStore.getState().addTemporaryHPToCharacter(10);
      expect(useCharacterStore.getState().character.hitPoints.temporary).toBe(
        15
      );
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
      expect(
        useCharacterStore.getState().character.hitPoints.deathSaves?.successes
      ).toBe(1);
    });

    it('adds a failure', () => {
      useCharacterStore.getState().makeDeathSavingThrow(false);
      expect(
        useCharacterStore.getState().character.hitPoints.deathSaves?.failures
      ).toBe(1);
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
      expect(
        useCharacterStore.getState().character.hitPoints.deathSaves
      ).toBeUndefined();
    });
  });

  describe('toggleHPCalculationMode', () => {
    it('switches from auto to manual', () => {
      useCharacterStore.getState().toggleHPCalculationMode();
      expect(
        useCharacterStore.getState().character.hitPoints.calculationMode
      ).toBe('manual');
    });

    it('switches from manual to auto', () => {
      resetStore({
        hitPoints: {
          current: 44,
          max: 44,
          temporary: 0,
          calculationMode: 'manual' as const,
        },
      });
      useCharacterStore.getState().toggleHPCalculationMode();
      expect(
        useCharacterStore.getState().character.hitPoints.calculationMode
      ).toBe('auto');
    });
  });

  describe('updateHitPoints', () => {
    it('updates HP fields', () => {
      useCharacterStore.getState().updateHitPoints({ current: 30 });
      expect(useCharacterStore.getState().character.hitPoints.current).toBe(30);
    });
  });
});
