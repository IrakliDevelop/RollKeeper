import { describe, expect, it } from 'vitest';
import {
  calculateLevelUpHp,
  isValidASIChoice,
  shouldShowEditionStep,
  computeWizardSteps,
} from './LevelUpWizard.utils';
import type { CharacterAbilities } from '@/types/character';

const abilities: CharacterAbilities = {
  strength: 10,
  dexterity: 10,
  constitution: 13,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

describe('level-up choices', () => {
  it('keeps the edition step after a choice so Back can return to it', () => {
    expect(shouldShowEditionStep(undefined, 2)).toBe(true);
    expect(shouldShowEditionStep('PHB', 2)).toBe(false);
    expect(shouldShowEditionStep(undefined, 1)).toBe(false);
    expect(
      computeWizardSteps({
        isCustomClass: false,
        needsEditionPicker: true,
        isMulticlassed: true,
        needsSubclassMigration: false,
        requiresSubclass: false,
        hasFeatures: false,
        requiresASI: false,
        needsHPInput: false,
      }).map(step => step.id)
    ).toEqual(['class', 'edition', 'confirm']);
  });

  it('requires exactly two legal ASI points or a selected feat', () => {
    expect(isValidASIChoice(undefined, abilities)).toBe(false);
    expect(isValidASIChoice({ type: 'asi', increases: [] }, abilities)).toBe(
      false
    );
    expect(
      isValidASIChoice(
        { type: 'asi', increases: [{ ability: 'strength', amount: 1 }] },
        abilities
      )
    ).toBe(false);
    expect(
      isValidASIChoice(
        { type: 'asi', increases: [{ ability: 'strength', amount: 2 }] },
        abilities
      )
    ).toBe(true);
    expect(
      isValidASIChoice(
        { type: 'asi', increases: [{ ability: 'constitution', amount: 2 }] },
        { ...abilities, constitution: 19 }
      )
    ).toBe(false);
    expect(
      isValidASIChoice(
        { type: 'feat', feat: { id: 'tough' } as never, grantedSpells: [] },
        abilities
      )
    ).toBe(true);
  });
});

describe('level-up HP', () => {
  it('uses post-ASI CON and adds retroactive HP for previous levels', () => {
    expect(
      calculateLevelUpHp({
        max: 24,
        current: 19,
        previousLevel: 3,
        oldConstitution: 13,
        newConstitution: 14,
        roll: 5,
      })
    ).toEqual({ max: 34, current: 29, gained: 10 });
  });

  it('does not add historic levels to a manually set maximum', () => {
    expect(
      calculateLevelUpHp({
        max: 5,
        current: 0,
        previousLevel: 10,
        oldConstitution: 8,
        newConstitution: 8,
        roll: 1,
      })
    ).toEqual({ max: 6, current: 1, gained: 1 });
  });

  it('clamps extreme negative retroactive HP and current HP', () => {
    expect(
      calculateLevelUpHp({
        max: 3,
        current: 0,
        previousLevel: 2,
        oldConstitution: 18,
        newConstitution: 3,
        roll: 1,
      })
    ).toEqual({ max: 1, current: 0, gained: -2 });
  });
});
