import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStore, PlayerCharacter } from '@/store/playerStore';
import { PLAYER_STORAGE_KEY } from '@/utils/constants';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CharacterState } from '@/types/character';

/**
 * Repro for the roster clobber: each tab persists its WHOLE roster, so a tab
 * holding character B writes back a stale copy of character A over A's fresh
 * entry. The fix: zustand-persist localStorage writes are the cross-tab
 * transport — a `storage` event carrying the other tab's roster is merged
 * per-entry by `characterData.revision` (strictly newer wins).
 */

function makePlayerCharacter(
  id: string,
  characterData: CharacterState
): PlayerCharacter {
  const now = new Date();
  return {
    id,
    name: characterData.name,
    race: characterData.race,
    class: characterData.class?.name || 'Fighter',
    level: characterData.level,
    createdAt: now,
    updatedAt: now,
    lastPlayed: now,
    characterData,
    tags: [],
    isArchived: false,
  };
}

function simulateOtherTabPersist(characters: PlayerCharacter[]) {
  const persisted = JSON.stringify({
    state: { characters },
    version: 1,
  });
  const oldValue = window.localStorage.getItem(PLAYER_STORAGE_KEY);
  window.localStorage.setItem(PLAYER_STORAGE_KEY, persisted);
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: PLAYER_STORAGE_KEY,
      oldValue,
      newValue: persisted,
      storageArea: window.localStorage,
    })
  );
}

describe('cross-tab roster sync (multi-character clobber)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePlayerStore.setState({
      characters: [
        makePlayerCharacter(
          'char-a',
          makeCharacter({ id: 'char-a', revision: 3, hitPoints: hp(7) })
        ),
        makePlayerCharacter(
          'char-b',
          makeCharacter({ id: 'char-b', revision: 2, hitPoints: hp(6) })
        ),
      ],
      activeCharacterId: null,
      lastSelectedCharacterId: null,
    });
  });

  it('applies a newer-revision entry for a character this tab does not hold in characterStore', () => {
    simulateOtherTabPersist([
      makePlayerCharacter(
        'char-a',
        makeCharacter({ id: 'char-a', revision: 1, hitPoints: hp(10) }) // stale
      ),
      makePlayerCharacter(
        'char-b',
        makeCharacter({ id: 'char-b', revision: 4, hitPoints: hp(2) }) // fresh
      ),
    ]);

    const { characters } = usePlayerStore.getState();
    const a = characters.find(c => c.id === 'char-a')!;
    const b = characters.find(c => c.id === 'char-b')!;
    expect(a.characterData.revision).toBe(3);
    expect(a.characterData.hitPoints.current).toBe(7);
    expect(b.characterData.revision).toBe(4);
    expect(b.characterData.hitPoints.current).toBe(2);
  });

  it('ignores equal and older revisions', () => {
    const before = usePlayerStore.getState().characters;

    simulateOtherTabPersist([
      makePlayerCharacter(
        'char-a',
        makeCharacter({ id: 'char-a', revision: 3, hitPoints: hp(99) }) // equal
      ),
      makePlayerCharacter(
        'char-b',
        makeCharacter({ id: 'char-b', revision: 1, hitPoints: hp(99) }) // older
      ),
    ]);

    expect(usePlayerStore.getState().characters).toBe(before);
  });

  it('adopts an entry created in another tab', () => {
    simulateOtherTabPersist([
      makePlayerCharacter(
        'char-a',
        makeCharacter({ id: 'char-a', revision: 3, hitPoints: hp(7) })
      ),
      makePlayerCharacter(
        'char-b',
        makeCharacter({ id: 'char-b', revision: 2, hitPoints: hp(6) })
      ),
      makePlayerCharacter(
        'char-c',
        makeCharacter({ id: 'char-c', revision: 1, hitPoints: hp(20) })
      ),
    ]);

    const { characters } = usePlayerStore.getState();
    expect(characters.map(c => c.id)).toContain('char-c');
    expect(
      characters.find(c => c.id === 'char-c')?.characterData.hitPoints.current
    ).toBe(20);
  });

  it('keeps local-only entries', () => {
    simulateOtherTabPersist([
      makePlayerCharacter(
        'char-b',
        makeCharacter({ id: 'char-b', revision: 5, hitPoints: hp(1) })
      ),
    ]);

    const { characters } = usePlayerStore.getState();
    expect(characters.map(c => c.id)).toContain('char-a');
    expect(
      characters.find(c => c.id === 'char-a')?.characterData.revision
    ).toBe(3);
  });

  it('ignores malformed payloads and other keys', () => {
    const before = usePlayerStore.getState().characters;

    window.localStorage.setItem(PLAYER_STORAGE_KEY, 'not json');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: PLAYER_STORAGE_KEY,
        newValue: 'not json',
        storageArea: window.localStorage,
      })
    );
    expect(usePlayerStore.getState().characters).toBe(before);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'some-other-key',
        newValue: JSON.stringify({
          state: {
            characters: [
              makePlayerCharacter(
                'char-a',
                makeCharacter({ id: 'char-a', revision: 99, hitPoints: hp(1) })
              ),
            ],
          },
        }),
        storageArea: window.localStorage,
      })
    );
    expect(usePlayerStore.getState().characters).toBe(before);
  });
});

function hp(current: number) {
  return {
    current,
    max: 44,
    temporary: 0,
    calculationMode: 'auto' as const,
  };
}
