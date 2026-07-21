'use client';

import { useCallback, useEffect, useRef } from 'react';

import { applyPlayersToEncounter } from '@/utils/encounterSync';
import type { CampaignPlayerData } from '@/types/campaign';

const PLAYERS_REFETCH_DEBOUNCE_MS = 1000;
const FALLBACK_POLL_MS = 45_000;

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
  const trailingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doFetch = useCallback(() => {
    if (!encounterId) return;
    lastFetchRef.current = Date.now();
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

  // Leading-edge fire immediately; a poke inside the debounce window
  // schedules ONE trailing fetch at window expiry instead of being dropped
  // (a burst of pokes — e.g. two players hit by one AoE — must not leave
  // the second player's HP stale indefinitely). Repeated pokes inside the
  // window coalesce onto the single pending timeout rather than stacking.
  const onPlayersPoke = useCallback(() => {
    if (!encounterId) return;
    const now = Date.now();
    const elapsed = now - lastFetchRef.current;
    if (elapsed >= PLAYERS_REFETCH_DEBOUNCE_MS) {
      doFetch();
      return;
    }
    if (trailingTimeoutRef.current) return;
    trailingTimeoutRef.current = setTimeout(() => {
      trailingTimeoutRef.current = null;
      doFetch();
    }, PLAYERS_REFETCH_DEBOUNCE_MS - elapsed);
  }, [encounterId, doFetch]);

  useEffect(() => {
    return () => {
      if (trailingTimeoutRef.current) {
        clearTimeout(trailingTimeoutRef.current);
        trailingTimeoutRef.current = null;
      }
    };
  }, []);

  // Passive polling fallback: without this, if pokes never arrive (relay
  // env unset, relay down, no active battlemap key) player HP freezes
  // forever. No document.hidden gating — background operation is the point.
  useEffect(() => {
    if (!encounterId) return;
    const id = setInterval(() => {
      onPlayersPoke(); // same debounced path — poke+poll coalesce
    }, FALLBACK_POLL_MS);
    return () => clearInterval(id);
  }, [encounterId, onPlayersPoke]);

  return { onPlayersPoke };
}
