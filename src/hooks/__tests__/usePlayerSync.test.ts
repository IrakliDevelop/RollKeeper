import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayerSync } from '@/hooks/usePlayerSync';
import { usePlayerStore, PlayerCharacter } from '@/store/playerStore';
import {
  mockFetchResponse,
  mockFetchSequence,
  resetFetch,
} from '@/test/mocks/fetch';
import { createMockCharacterState } from '@/test/helpers';

function seedCharacter(overrides: Record<string, unknown> = {}) {
  const charData = createMockCharacterState({ id: 'char-test' });
  usePlayerStore.setState({
    characters: [
      {
        id: 'char-test',
        name: charData.name,
        race: charData.race,
        class: 'Fighter',
        level: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastPlayed: new Date(),
        characterData: charData,
        tags: [],
        isArchived: false,
        campaignCode: 'ABC123',
        campaignName: 'Test Campaign',
        syncEnabled: true,
        autoSync: true,
        ...overrides,
      },
    ],
  });
}

function seedLinkedCharacter() {
  const characterData = createMockCharacterState({ id: 'char-1' });
  usePlayerStore.setState({
    characters: [
      {
        id: 'char-1',
        name: 'Test Hero',
        race: 'Human',
        class: 'Fighter',
        level: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastPlayed: new Date(),
        characterData,
        tags: [],
        isArchived: false,
        campaignCode: 'ABC123',
        campaignName: 'Test Campaign',
        syncEnabled: true,
        autoSync: true,
      } as PlayerCharacter,
    ],
    activeCharacterId: 'char-1',
    lastSelectedCharacterId: 'char-1',
  });
  return characterData;
}

describe('usePlayerSync', () => {
  beforeEach(() => {
    resetFetch();
    usePlayerStore.setState({ characters: [] });
  });

  it('reads campaign fields from the character', () => {
    seedCharacter();

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-test' })
    );

    expect(result.current.campaignCode).toBe('ABC123');
    expect(result.current.campaignName).toBe('Test Campaign');
    expect(result.current.syncEnabled).toBe(true);
    expect(result.current.autoSync).toBe(true);
  });

  it('syncNow posts character data to sync endpoint', async () => {
    seedCharacter();
    const fetchFn = mockFetchResponse(200, {
      success: true,
      lastSynced: '2025-06-01T00:00:00.000Z',
    });

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-test' })
    );

    const charData = createMockCharacterState({ id: 'char-test' });
    await act(async () => {
      await result.current.syncNow(charData);
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, opts] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/campaign/ABC123/sync');
    expect(opts.method).toBe('POST');
    expect(result.current.syncStatus).toBe('synced');
  });

  it('syncNow is a no-op when syncEnabled is false', async () => {
    seedCharacter({ syncEnabled: false });
    const fetchFn = mockFetchResponse(200, { success: true });

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-test' })
    );

    const charData = createMockCharacterState({ id: 'char-test' });
    await act(async () => {
      await result.current.syncNow(charData);
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.syncStatus).toBe('idle');
  });

  it('syncNow is a no-op when no campaignCode', async () => {
    seedCharacter({ campaignCode: undefined });
    const fetchFn = mockFetchResponse(200, { success: true });

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-test' })
    );

    const charData = createMockCharacterState({ id: 'char-test' });
    await act(async () => {
      await result.current.syncNow(charData);
    });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('falls back to join endpoint on sync failure', async () => {
    seedCharacter();
    const fetchFn = mockFetchSequence([
      { status: 500, body: { error: 'Server error' } },
      { status: 200, body: { success: true, campaignName: 'Test Campaign' } },
    ]);

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-test' })
    );

    const charData = createMockCharacterState({ id: 'char-test' });
    await act(async () => {
      await result.current.syncNow(charData);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const secondUrl = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(secondUrl).toBe('/api/campaign/ABC123/join');
    expect(result.current.syncStatus).toBe('synced');
  });

  it('sets error status when both sync and rejoin fail', async () => {
    seedCharacter();
    mockFetchSequence([
      { status: 500, body: { error: 'fail' } },
      { status: 500, body: { error: 'fail' } },
    ]);

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-test' })
    );

    const charData = createMockCharacterState({ id: 'char-test' });
    await act(async () => {
      await result.current.syncNow(charData);
    });

    expect(result.current.syncStatus).toBe('error');
  });

  it('toggleAutoSync flips the autoSync flag', async () => {
    seedCharacter({ autoSync: true });

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-test' })
    );

    expect(result.current.autoSync).toBe(true);

    act(() => {
      result.current.toggleAutoSync();
    });

    const char = usePlayerStore.getState().characters[0];
    expect(char.autoSync).toBe(false);
  });

  it('leaveCampaign clears campaign fields', async () => {
    seedCharacter();

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-test' })
    );

    act(() => {
      result.current.leaveCampaign();
    });

    const char = usePlayerStore.getState().characters[0];
    expect(char.campaignCode).toBeUndefined();
    expect(char.campaignName).toBeUndefined();
    expect(char.syncEnabled).toBeUndefined();
    expect(result.current.syncStatus).toBe('idle');
  });

  it('on 410 clears campaign link, notifies, and does NOT attempt rejoin', async () => {
    const characterData = seedLinkedCharacter();
    const fetchFn = mockFetchResponse(410, { error: 'removed' });
    const onRemoved = vi.fn();

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-1', onRemovedFromCampaign: onRemoved })
    );

    await act(async () => {
      await result.current.syncNow(characterData);
    });

    expect(onRemoved).toHaveBeenCalledTimes(1);
    // two fetches: the sync call, then the self-removal DELETE
    // (closes the kick-vs-sync resurrection race) — no /join rejoin attempt
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [secondUrl, secondOpts] = (fetchFn as ReturnType<typeof vi.fn>).mock
      .calls[1];
    expect(secondUrl).toBe('/api/campaign/ABC123/players/char-1');
    expect(secondOpts.method).toBe('DELETE');

    const char = usePlayerStore.getState().characters[0];
    expect(char.campaignCode).toBeUndefined();
    expect(char.syncEnabled).toBeUndefined();
    expect(result.current.syncStatus).toBe('idle');
  });

  it('queued pending sync during a 410 does not fire the removal callback twice', async () => {
    const characterData = seedLinkedCharacter();
    mockFetchResponse(410, { error: 'removed' });
    const onRemoved = vi.fn();

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-1', onRemovedFromCampaign: onRemoved })
    );

    await act(async () => {
      const first = result.current.syncNow(characterData);
      // second call while first is in flight → queued into pendingSyncData
      const second = result.current.syncNow(characterData);
      await Promise.all([first, second]);
    });

    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it('non-410 failure still attempts rejoin (existing behavior preserved)', async () => {
    const characterData = seedLinkedCharacter();
    const fetchFn = mockFetchResponse(500, { error: 'boom' });
    const onRemoved = vi.fn();

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-1', onRemovedFromCampaign: onRemoved })
    );

    await act(async () => {
      await result.current.syncNow(characterData);
    });

    expect(onRemoved).not.toHaveBeenCalled();
    // sync call + rejoin attempt
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(usePlayerStore.getState().characters[0].campaignCode).toBe('ABC123');
  });

  it('leaveCampaign fires server-side removal and clears local link', async () => {
    seedLinkedCharacter();
    const fetchFn = mockFetchResponse(200, { success: true });

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-1' })
    );

    act(() => {
      result.current.leaveCampaign();
    });

    expect(fetchFn).toHaveBeenCalledWith(
      '/api/campaign/ABC123/players/char-1',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(
      usePlayerStore.getState().characters[0].campaignCode
    ).toBeUndefined();
  });

  it('leaveCampaign still clears local link when the server call fails', async () => {
    seedLinkedCharacter();
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('network down'))
    ) as unknown as typeof global.fetch;

    const { result } = renderHook(() =>
      usePlayerSync({ characterId: 'char-1' })
    );

    act(() => {
      result.current.leaveCampaign();
    });

    expect(
      usePlayerStore.getState().characters[0].campaignCode
    ).toBeUndefined();
  });
});
