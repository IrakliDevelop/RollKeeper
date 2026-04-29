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
      expect(useCharacterStore.getState().character.abilities.strength).toBe(
        20
      );
    });

    it('clamps to minimum 1', () => {
      useCharacterStore.getState().updateAbilityScore('strength', -5);
      expect(useCharacterStore.getState().character.abilities.strength).toBe(1);
    });

    it('clamps to maximum 30', () => {
      useCharacterStore.getState().updateAbilityScore('strength', 50);
      expect(useCharacterStore.getState().character.abilities.strength).toBe(
        30
      );
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
      expect(
        useCharacterStore.getState().character.skills.arcana.proficient
      ).toBe(true);
    });

    it('removes proficiency from a skill', () => {
      useCharacterStore.getState().updateSkillProficiency('athletics', false);
      expect(
        useCharacterStore.getState().character.skills.athletics.proficient
      ).toBe(false);
    });
  });

  describe('updateSkillExpertise', () => {
    it('sets expertise on a skill', () => {
      useCharacterStore.getState().updateSkillExpertise('perception', true);
      expect(
        useCharacterStore.getState().character.skills.perception.expertise
      ).toBe(true);
    });

    it('removes expertise from a skill', () => {
      useCharacterStore.getState().updateSkillExpertise('perception', false);
      expect(
        useCharacterStore.getState().character.skills.perception.expertise
      ).toBe(false);
    });
  });

  describe('toggleSkillBonusAbility', () => {
    it('adds a bonus ability', () => {
      useCharacterStore.getState().toggleSkillBonusAbility('arcana', 'wisdom');
      expect(
        useCharacterStore.getState().character.skills.arcana.bonusAbilities
      ).toContain('wisdom');
    });

    it('removes an existing bonus ability', () => {
      resetStore({
        skills: {
          ...makeCharacter().skills,
          arcana: {
            proficient: false,
            expertise: false,
            bonusAbilities: ['wisdom'],
          },
        },
      });
      useCharacterStore.getState().toggleSkillBonusAbility('arcana', 'wisdom');
      expect(
        useCharacterStore.getState().character.skills.arcana.bonusAbilities
      ).toBeUndefined();
    });
  });

  describe('updateSavingThrowProficiency', () => {
    it('sets saving throw proficiency', () => {
      useCharacterStore.getState().updateSavingThrowProficiency('wisdom', true);
      expect(
        useCharacterStore.getState().character.savingThrows.wisdom.proficient
      ).toBe(true);
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
      expect(useCharacterStore.getState().character.jackOfAllTrades).toBe(
        false
      );
    });
  });

  describe('updateInitiative', () => {
    it('sets initiative value', () => {
      useCharacterStore.getState().updateInitiative(5, true);
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
      expect(
        useCharacterStore.getState().character.reaction.hasUsedReaction
      ).toBe(true);
      useCharacterStore.getState().toggleReaction();
      expect(
        useCharacterStore.getState().character.reaction.hasUsedReaction
      ).toBe(false);
    });
  });

  describe('heroicInspiration', () => {
    it('updateHeroicInspiration sets count', () => {
      useCharacterStore.getState().updateHeroicInspiration({ count: 1 });
      expect(
        useCharacterStore.getState().character.heroicInspiration.count
      ).toBe(1);
    });
  });
});
