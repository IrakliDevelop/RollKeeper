import { describe, it, expect, beforeEach } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import { initCrossTabCharacterSync } from '@/lib/crossTabCharacterSync';
import { characterEnvelopeKey } from '@/lib/characterCanonicalStorage';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import type { CharacterState } from '@/types/character';

const baseCharacter = (revision: number, extra: object = {}): CharacterState =>
  ({
    ...DEFAULT_CHARACTER_STATE,
    id: 'sync-char',
    revision,
    ...extra,
  }) as unknown as CharacterState;

const fireEnvelopeEvent = (character: CharacterState, watermarks = {}) => {
  const key = characterEnvelopeKey(character.id);
  const newValue = JSON.stringify({
    state: { character, intentWatermarks: watermarks },
    version: 0,
  });
  window.dispatchEvent(
    new StorageEvent('storage', { key, newValue, storageArea: localStorage })
  );
};

describe('cross-tab character envelope sync', () => {
  let teardown: () => void;

  beforeEach(() => {
    teardown?.();
    useCharacterStore.getState().loadCharacterState(baseCharacter(5));
    teardown = initCrossTabCharacterSync(useCharacterStore);
  });

  it('adopts a strictly newer revision and its watermarks', () => {
    fireEnvelopeEvent(baseCharacter(6, { name: 'newer' }), {
      tabX: { seq: 3, lastSeen: 1 },
    });
    expect(useCharacterStore.getState().character.revision).toBe(6);
    expect(useCharacterStore.getState().intentWatermarks.tabX?.seq).toBe(3);
  });

  it('rejects equal revision without fresher stamps (legacy stamp-less)', () => {
    fireEnvelopeEvent(baseCharacter(5, { name: 'imposter' }));
    expect(useCharacterStore.getState().character.name).not.toBe('imposter');
  });

  it('adopts equal revision with strictly greater stamps (tiebreak)', () => {
    useCharacterStore
      .getState()
      .loadCharacterState(baseCharacter(5, { lastMutatedAt: 100 }));
    fireEnvelopeEvent(
      baseCharacter(5, { name: 'tiebreak-winner', lastMutatedAt: 200 })
    );
    expect(useCharacterStore.getState().character.name).toBe('tiebreak-winner');
  });

  it('ignores a different character id', () => {
    const other = { ...baseCharacter(99), id: 'other-char' };
    fireEnvelopeEvent(other as CharacterState);
    expect(useCharacterStore.getState().character.id).toBe('sync-char');
    expect(useCharacterStore.getState().character.revision).toBe(5);
  });

  it('ignores older revisions', () => {
    fireEnvelopeEvent(baseCharacter(4, { name: 'stale' }));
    expect(useCharacterStore.getState().character.revision).toBe(5);
  });
});
