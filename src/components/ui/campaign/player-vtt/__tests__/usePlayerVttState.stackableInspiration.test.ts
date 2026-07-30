import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { usePlayerVttState } from '../PlayerVttScreen.hooks';
import { usePlayerStore } from '@/store/playerStore';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

const CHARACTER_ID = 'char-vtt-stackable';

function sharedStateBody(stackableInspiration: boolean) {
  return {
    calendar: null,
    messages: [],
    dmEffects: [],
    customCounter: null,
    transfers: [],
    initiative: null,
    battleMap: null,
    settings: { stackableInspiration },
  };
}

function seedRoster() {
  const characterData = makeCharacter({
    id: CHARACTER_ID,
    stackableInspiration: false,
  });
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
}

describe('usePlayerVttState — campaign stackable inspiration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    usePlayerStore.setState({ characters: [], activeCharacterId: null });
    useCharacterStore.setState({ hasHydrated: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("materializes the DM's stackable house rule onto the character", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(sharedStateBody(true))))
    );
    seedRoster();

    const { unmount } = renderHook(() =>
      usePlayerVttState('CAMP1', CHARACTER_ID)
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });

    expect(useCharacterStore.getState().character.stackableInspiration).toBe(
      true
    );

    unmount();
  });

  it('leaves the character alone when the campaign already matches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(sharedStateBody(false))))
    );
    seedRoster();

    const { unmount } = renderHook(() =>
      usePlayerVttState('CAMP1', CHARACTER_ID)
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });

    expect(useCharacterStore.getState().character.stackableInspiration).toBe(
      false
    );

    unmount();
  });
});
