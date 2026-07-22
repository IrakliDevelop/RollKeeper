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

    // Clear the mount's own leading-fetch debounce window first so the
    // poke below produces its own fetch instead of being coalesced into it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    await act(async () => {
      result.current.onPlayersPoke();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2); // mount fetch + poke fetch
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

    // Clear the mount's own leading-fetch debounce window first so the
    // first poke below is a genuine leading fetch, not coalesced with mount.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    await act(async () => {
      result.current.onPlayersPoke();
      result.current.onPlayersPoke();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2); // mount fetch + poke1 leading
  });

  it('a poke during the debounce window schedules one trailing fetch at window expiry', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    const { result } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );

    // Clear the mount's own leading-fetch debounce window first so poke1
    // below is a genuine leading fetch, matching the scenario this test
    // is documenting (not coalesced with the mount fetch).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Two pokes back-to-back: the first is a leading fetch, the second lands
    // inside the debounce window and must schedule a trailing fetch instead
    // of being silently dropped.
    await act(async () => {
      result.current.onPlayersPoke();
      result.current.onPlayersPoke();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2); // mount fetch + poke1 leading

    // A third poke, still inside the window, must coalesce with the already
    // scheduled trailing fetch rather than stacking a second timeout.
    await act(async () => {
      result.current.onPlayersPoke();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    // Window expires: exactly one trailing fetch fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);

    // No further fetch from a stacked/duplicate timeout.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('clears a pending trailing fetch on unmount', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    const { result, unmount } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );

    // Clear the mount's own leading-fetch debounce window first so the
    // pokes below exercise poke-driven leading/trailing behavior.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    await act(async () => {
      result.current.onPlayersPoke(); // leading
      result.current.onPlayersPoke(); // schedules trailing
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2); // mount fetch + poke1 leading

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2); // trailing fetch was cleared
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

    // Mount already fires one leading fetch; from there, no poke ever
    // arrives — only the passive interval should drive further fetches.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(applyPlayersToEncounter).toHaveBeenCalledWith(ENCOUNTER_ID, PLAYERS);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('stops polling after unmount', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    const { unmount } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );
    // Mount's own leading fetch already fired synchronously on render.
    expect(fetchFn).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1); // interval never fires post-unmount
  });

  it('does not poll when encounterId is null', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    renderHook(() => useDmVttPlayersRefresh(CAMPAIGN_CODE, null));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fetches once on mount without any poke (leading fetch)', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    renderHook(() => useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(applyPlayersToEncounter).toHaveBeenCalledWith(ENCOUNTER_ID, PLAYERS);
  });

  it('exposes the fetched players array and updates it on later fetches', async () => {
    mockFetchResponse(200, { players: PLAYERS });
    const { result } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.players).toEqual(PLAYERS);

    const updated = [{ ...PLAYERS[0], characterName: 'Thorn II' }];
    mockFetchResponse(200, { players: updated });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000); // clear the debounce window
      result.current.onPlayersPoke();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.players).toEqual(updated);
  });

  it('exposes an empty players array when there is no linked encounter', () => {
    const { result } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, null)
    );
    expect(result.current.players).toEqual([]);
  });
});
