import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { usePlayerVttState } from '../PlayerVttScreen.hooks';
import { usePlayerStore } from '@/store/playerStore';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

const EMPTY_SHARED_STATE = {
  calendar: null,
  messages: [],
  dmEffects: [],
  customCounter: null,
  transfers: [],
  initiative: null,
  battleMap: null,
};

const CHARACTER_ID = 'char-vtt-1';

function seedRoster() {
  const characterData = makeCharacter({ id: CHARACTER_ID });
  usePlayerStore.setState({
    characters: [
      {
        id: CHARACTER_ID,
        name: characterData.name,
        race: characterData.race,
        class: 'Fighter',
        level: characterData.level,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastPlayed: new Date(),
        characterData,
        tags: [],
        isArchived: false,
        syncEnabled: false,
        autoSync: false,
      },
    ],
  });
  return characterData;
}

describe('usePlayerVttState — roster write-back', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(EMPTY_SHARED_STATE)))
    );
    usePlayerStore.setState({ characters: [], activeCharacterId: null });
    useCharacterStore.setState({ hasHydrated: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('persists live characterStore changes (e.g. damage) back into the playerStore roster blob', async () => {
    seedRoster();

    const { result, unmount } = renderHook(() =>
      usePlayerVttState('CAMP1', CHARACTER_ID)
    );

    // Let the load effect run and the initial-load guard window (50ms) clear.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });

    expect(result.current.character.id).toBe(CHARACTER_ID);
    expect(result.current.character.hitPoints.current).toBe(44);

    // A store action mutates characterStore directly, mirroring what any VTT
    // panel (e.g. DockVitals) does when the player takes damage mid-session.
    act(() => {
      useCharacterStore.getState().applyDamageToCharacter(5);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const roster = usePlayerStore
      .getState()
      .characters.find(c => c.id === CHARACTER_ID);
    expect(roster?.characterData.hitPoints.current).toBe(39);

    unmount();
  });
});
