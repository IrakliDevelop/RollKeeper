'use client';

import { useCallback, useRef } from 'react';

import { applyPlayersToEncounter } from '@/utils/encounterSync';
import type { CampaignPlayerData } from '@/types/campaign';

const PLAYERS_REFETCH_DEBOUNCE_MS = 1000;

/**
 * Poke-driven player refresh for the DM VTT. The DM VTT has no player
 * polling of its own (EncounterView's poll only runs on the encounters
 * page), so without this the VTT's player HP is frozen until that other
 * tab is foregrounded. Best-effort: failures are silent, the next poke or
 * the EncounterView poll catches up.
 */
export function useDmVttPlayersRefresh(
  campaignCode: string,
  encounterId: string | null
): { onPlayersPoke: () => void } {
  const lastFetchRef = useRef(0);

  const onPlayersPoke = useCallback(() => {
    if (!encounterId) return;
    const now = Date.now();
    if (now - lastFetchRef.current < PLAYERS_REFETCH_DEBOUNCE_MS) return;
    lastFetchRef.current = now;
    void (async () => {
      try {
        const res = await fetch(`/api/campaign/${campaignCode}/players`);
        if (!res.ok) return;
        const data = await res.json();
        const players: CampaignPlayerData[] = data.players ?? [];
        applyPlayersToEncounter(encounterId, players);
      } catch {
        // silent — poke is best-effort
      }
    })();
  }, [campaignCode, encounterId]);

  return { onPlayersPoke };
}
