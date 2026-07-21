import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDmVttPlayersRefresh } from '../useDmVttPlayersRefresh';
import { applyPlayersToEncounter } from '@/utils/encounterSync';
import { mockFetchResponse, resetFetch } from '@/test/mocks/fetch';
import type { CampaignPlayerData } from '@/types/campaign';

vi.mock('@/utils/encounterSync', () => ({
  applyPlayersToEncounter: vi.fn(),
}));

const CAMPAIGN_CODE = 'TEST01';
const ENCOUNTER_ID = 'enc-1';

const PLAYERS: CampaignPlayerData[] = [
  {
    playerId: 'p1',
    playerName: 'Alice',
    characterId: 'char-1',
    characterName: 'Thorn',
    characterData: {} as CampaignPlayerData['characterData'],
    lastSynced: '2025-01-01T00:00:00.000Z',
  },
];

describe('useDmVttPlayersRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetFetch();
    vi.mocked(applyPlayersToEncounter).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches players and applies them to the encounter on poke', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    const { result } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );

    await act(async () => {
      result.current.onPlayersPoke();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchFn).toHaveBeenCalledWith(
      `/api/campaign/${CAMPAIGN_CODE}/players`
    );
    expect(applyPlayersToEncounter).toHaveBeenCalledWith(ENCOUNTER_ID, PLAYERS);
  });

  it('debounces a second poke within 1s (no immediate second fetch)', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    const { result } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );

    await act(async () => {
      result.current.onPlayersPoke();
      result.current.onPlayersPoke();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('a poke during the debounce window schedules one trailing fetch at window expiry', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    const { result } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );

    // Two pokes back-to-back: the first is a leading fetch, the second lands
    // inside the debounce window and must schedule a trailing fetch instead
    // of being silently dropped.
    await act(async () => {
      result.current.onPlayersPoke();
      result.current.onPlayersPoke();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // A third poke, still inside the window, must coalesce with the already
    // scheduled trailing fetch rather than stacking a second timeout.
    await act(async () => {
      result.current.onPlayersPoke();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Window expires: exactly one trailing fetch fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    // No further fetch from a stacked/duplicate timeout.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('clears a pending trailing fetch on unmount', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    const { result, unmount } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );

    await act(async () => {
      result.current.onPlayersPoke(); // leading
      result.current.onPlayersPoke(); // schedules trailing
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('never fetches when encounterId is null', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    const { result } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, null)
    );

    await act(async () => {
      result.current.onPlayersPoke();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(applyPlayersToEncounter).not.toHaveBeenCalled();
  });

  it('silently swallows fetch errors', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('network fail'))
    ) as unknown as typeof global.fetch;
    const { result } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );

    await act(async () => {
      expect(() => result.current.onPlayersPoke()).not.toThrow();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(applyPlayersToEncounter).not.toHaveBeenCalled();
  });

  it('silently ignores a non-OK HTTP response', async () => {
    mockFetchResponse(500, { error: 'boom' });
    const { result } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );

    await act(async () => {
      result.current.onPlayersPoke();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(applyPlayersToEncounter).not.toHaveBeenCalled();
  });

  it('polls every 45s even when no poke ever arrives (relay-down fallback)', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    renderHook(() => useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID));

    // No poke — only the passive interval should drive fetches.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(applyPlayersToEncounter).toHaveBeenCalledWith(ENCOUNTER_ID, PLAYERS);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('stops polling after unmount', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    const { unmount } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('does not poll when encounterId is null', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    renderHook(() => useDmVttPlayersRefresh(CAMPAIGN_CODE, null));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
