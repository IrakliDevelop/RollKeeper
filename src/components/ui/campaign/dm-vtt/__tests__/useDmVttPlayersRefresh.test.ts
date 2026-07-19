import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    resetFetch();
    vi.mocked(applyPlayersToEncounter).mockClear();
  });

  it('fetches players and applies them to the encounter on poke', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    const { result } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );

    await act(async () => {
      result.current.onPlayersPoke();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchFn).toHaveBeenCalledWith(
      `/api/campaign/${CAMPAIGN_CODE}/players`
    );
    expect(applyPlayersToEncounter).toHaveBeenCalledWith(ENCOUNTER_ID, PLAYERS);
  });

  it('debounces a second poke within 1s', async () => {
    const fetchFn = mockFetchResponse(200, { players: PLAYERS });
    const { result } = renderHook(() =>
      useDmVttPlayersRefresh(CAMPAIGN_CODE, ENCOUNTER_ID)
    );

    await act(async () => {
      result.current.onPlayersPoke();
      result.current.onPlayersPoke();
      await Promise.resolve();
      await Promise.resolve();
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
      await Promise.resolve();
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
      await Promise.resolve();
      await Promise.resolve();
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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(applyPlayersToEncounter).not.toHaveBeenCalled();
  });
});
