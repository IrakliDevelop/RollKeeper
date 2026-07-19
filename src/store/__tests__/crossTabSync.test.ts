import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { STORAGE_KEY } from '@/utils/constants';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CharacterState } from '@/types/character';

/**
 * Repro for the battlemap ↔ character-sheet desync: the battle map opens in
 * a new tab (BattleMapLiveBanner target="_blank"); each tab holds an
 * independent in-memory store. The fix: zustand-persist localStorage writes
 * are the cross-tab transport — a `storage` event carrying a NEWER
 * `character.revision` for the SAME character id is applied to this tab.
 */

function simulateOtherTabPersist(character: CharacterState) {
  const persisted = JSON.stringify({
    state: { character, lastSaved: new Date().toISOString() },
    version: 0,
  });
  const oldValue = window.localStorage.getItem(STORAGE_KEY);
  window.localStorage.setItem(STORAGE_KEY, persisted);
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: STORAGE_KEY,
      oldValue,
      newValue: persisted,
      storageArea: window.localStorage,
    })
  );
}

describe('cross-tab character sync (sheet tab vs battlemap tab)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCharacterStore.setState({
      character: makeCharacter({
        revision: 1,
        spellSlots: {
          1: { max: 2, used: 0 },
          2: { max: 0, used: 0 },
          3: { max: 0, used: 0 },
          4: { max: 0, used: 0 },
          5: { max: 0, used: 0 },
          6: { max: 0, used: 0 },
          7: { max: 0, used: 0 },
          8: { max: 0, used: 0 },
          9: { max: 0, used: 0 },
        },
      }),
      hasUnsavedChanges: false,
      saveStatus: 'saved',
    });
  });

  it('applies a newer-revision spell-slot spend from another tab', () => {
    simulateOtherTabPersist(
      makeCharacter({
        revision: 2,
        spellSlots: {
          ...useCharacterStore.getState().character.spellSlots,
          1: { max: 2, used: 1 },
        },
      })
    );
    expect(useCharacterStore.getState().character.spellSlots[1].used).toBe(1);
    expect(useCharacterStore.getState().character.revision).toBe(2);
  });

  it('applies a newer-revision HP change from another tab', () => {
    simulateOtherTabPersist(
      makeCharacter({
        revision: 2,
        hitPoints: {
          current: 30,
          max: 44,
          temporary: 0,
          calculationMode: 'auto' as const,
        },
      })
    );
    expect(useCharacterStore.getState().character.hitPoints.current).toBe(30);
  });

  it('ignores a stale (equal-or-older revision) write from another tab', () => {
    simulateOtherTabPersist(
      makeCharacter({
        revision: 1,
        hitPoints: {
          current: 5,
          max: 44,
          temporary: 0,
          calculationMode: 'auto' as const,
        },
      })
    );
    expect(useCharacterStore.getState().character.hitPoints.current).toBe(44);
  });

  it('ignores a write for a different character id', () => {
    simulateOtherTabPersist(
      makeCharacter({
        id: 'someone-else',
        revision: 99,
        hitPoints: {
          current: 5,
          max: 44,
          temporary: 0,
          calculationMode: 'auto' as const,
        },
      })
    );
    expect(useCharacterStore.getState().character.hitPoints.current).toBe(44);
    expect(useCharacterStore.getState().character.id).toBe('test-char-1');
  });

  it('ignores malformed persisted payloads', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not json');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: 'not json',
        storageArea: window.localStorage,
      })
    );
    expect(useCharacterStore.getState().character.hitPoints.current).toBe(44);
  });
});
