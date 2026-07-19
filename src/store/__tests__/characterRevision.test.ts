import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

describe('characterStore — revision bumping', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCharacterStore.setState({
      character: makeCharacter({ revision: 3 }),
      hasUnsavedChanges: false,
      saveStatus: 'saved',
    });
  });

  it('bumps revision on a character mutation', () => {
    useCharacterStore.getState().updateAbilityScore('strength', 18);
    expect(useCharacterStore.getState().character.revision).toBe(4);
  });

  it('bumps revision once per mutation, not per field', () => {
    useCharacterStore.getState().updateAbilityScore('strength', 18);
    useCharacterStore.getState().updateAbilityScore('dexterity', 15);
    expect(useCharacterStore.getState().character.revision).toBe(5);
  });

  it('does not bump revision on non-character state changes', () => {
    useCharacterStore.setState({ hasUnsavedChanges: true });
    useCharacterStore.getState().markUnsaved();
    expect(useCharacterStore.getState().character.revision).toBe(3);
  });

  it('loadCharacterState adopts the incoming revision without bumping', () => {
    useCharacterStore
      .getState()
      .loadCharacterState(makeCharacter({ revision: 7, name: 'External' }));
    expect(useCharacterStore.getState().character.revision).toBe(7);
    expect(useCharacterStore.getState().character.name).toBe('External');
  });

  it('defaults a missing revision to 0 then bumps to 1', () => {
    useCharacterStore.setState({ character: makeCharacter() }); // no revision
    useCharacterStore.getState().updateAbilityScore('strength', 18);
    expect(useCharacterStore.getState().character.revision).toBe(1);
  });
});
