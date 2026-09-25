import { describe, it, expect, beforeEach } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import { CHARACTER_ACTION_CLASSIFICATION } from '@/store/characterActionClassification';
import type { CharacterState } from '@/types/character';

const baseCharacter = (): CharacterState =>
  ({
    ...DEFAULT_CHARACTER_STATE,
    id: 'share-party-view-char',
    revision: 1,
  }) as unknown as CharacterState;

beforeEach(() => {
  useCharacterStore.getState().loadCharacterState(baseCharacter());
});

describe('setSharePartyView', () => {
  it('sets sharePartyView to false', () => {
    useCharacterStore.getState().setSharePartyView(false);
    expect(useCharacterStore.getState().character.sharePartyView).toBe(false);
  });

  it('sets sharePartyView to true', () => {
    useCharacterStore.getState().setSharePartyView(false);
    useCharacterStore.getState().setSharePartyView(true);
    expect(useCharacterStore.getState().character.sharePartyView).toBe(true);
  });

  it('is a no-op (no revision bump) when already at the target value', () => {
    // Default is undefined, treated as true — setting true is a no-op.
    const revision = useCharacterStore.getState().character.revision;
    useCharacterStore.getState().setSharePartyView(true);
    expect(useCharacterStore.getState().character.revision).toBe(revision);

    useCharacterStore.getState().setSharePartyView(false);
    const revisionAfterFalse = useCharacterStore.getState().character.revision;
    useCharacterStore.getState().setSharePartyView(false);
    expect(useCharacterStore.getState().character.revision).toBe(
      revisionAfterFalse
    );
  });

  it('is classified CANONICAL', () => {
    expect(CHARACTER_ACTION_CLASSIFICATION.setSharePartyView).toBe('CANONICAL');
  });
});
