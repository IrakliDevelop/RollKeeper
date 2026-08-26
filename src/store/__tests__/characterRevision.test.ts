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

  it('does not bump revision when recalculateMaxHP is a no-op', () => {
    // makeCharacter's default (auto mode, level 5, Fighter d10, CON 14) already
    // has hitPoints.max equal to what calculateMaxHP produces, so the first
    // call is already a no-op — but exercise it once anyway to mirror how the
    // real app calls this unconditionally on every sheet mount, then confirm
    // the second call stays a no-op.
    useCharacterStore.getState().recalculateMaxHP();
    const { character: characterAfterFirst, revision: revisionAfterFirst } = {
      character: useCharacterStore.getState().character,
      revision: useCharacterStore.getState().character.revision,
    };
    expect(characterAfterFirst.hitPoints.max).toBe(44);
    expect(revisionAfterFirst).toBe(3);

    useCharacterStore.getState().recalculateMaxHP();

    expect(useCharacterStore.getState().character.revision).toBe(3);
    expect(useCharacterStore.getState().character).toBe(characterAfterFirst);
  });
});
