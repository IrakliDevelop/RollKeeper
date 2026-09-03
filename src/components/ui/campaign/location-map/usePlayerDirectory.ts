'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { CampaignPlayerData } from '@/types/campaign';

export interface PlayerDirectory {
  ids: ReadonlySet<string>;
  nameOf(characterId: string): string | undefined;
}

interface DirectoryState {
  generation: number;
  directory: PlayerDirectory | null;
  requested: Set<string>;
  inFlight: Promise<void> | null;
  refreshQueued: boolean;
}

/**
 * DM-side membership cross-check for awareness peers: the DM-only
 * `/players` route mapped by characterId (== the player's awareness `id`).
 * One fetch on mount; `ensureKnown` refetches at most once per unknown id
 * so a player who joins the campaign mid-session becomes verified without
 * polling. An id first seen while a request is in flight queues exactly one
 * follow-up (the in-flight response may predate it). A campaign change
 * bumps the generation: state resets and late responses from the previous
 * campaign are discarded. Best-effort: failures leave the directory null
 * (every player row then shows as unverified — never as verified).
 */
export function usePlayerDirectory(
  campaignCode: string,
  enabled: boolean
): {
  directory: PlayerDirectory | null;
  ensureKnown(ids: readonly string[]): void;
} {
  const [directory, setDirectory] = useState<PlayerDirectory | null>(null);
  const stateRef = useRef<DirectoryState>({
    generation: 0,
    directory: null,
    requested: new Set(),
    inFlight: null,
    refreshQueued: false,
  });

  const fetchOnce = useCallback(
    async (generation: number): Promise<void> => {
      try {
        const res = await fetch(`/api/campaign/${campaignCode}/players`);
        if (stateRef.current.generation !== generation) return;
        if (!res.ok) return;
        const data = (await res.json()) as { players?: CampaignPlayerData[] };
        if (stateRef.current.generation !== generation) return;
        const names = new Map<string, string>();
        for (const p of data.players ?? []) {
          names.set(p.characterId, p.playerName || p.characterName);
        }
        const next: PlayerDirectory = {
          ids: new Set(names.keys()),
          nameOf: id => names.get(id),
        };
        stateRef.current.directory = next;
        setDirectory(next);
      } catch {
        // best-effort
      }
    },
    [campaignCode]
  );

  const load = useCallback((): void => {
    const state = stateRef.current;
    if (state.inFlight) {
      state.refreshQueued = true;
      return;
    }
    const generation = state.generation;
    state.inFlight = (async () => {
      do {
        state.refreshQueued = false;
        await fetchOnce(generation);
      } while (
        state.refreshQueued &&
        stateRef.current.generation === generation
      );
      if (stateRef.current.generation === generation) state.inFlight = null;
    })();
  }, [fetchOnce]);

  // Campaign change: new generation, fresh books; a still-running loop for
  // the old generation exits at its next check and its responses are ignored.
  useEffect(() => {
    stateRef.current = {
      generation: stateRef.current.generation + 1,
      directory: null,
      requested: new Set(),
      inFlight: null,
      refreshQueued: false,
    };
    setDirectory(null);
  }, [campaignCode]);

  useEffect(() => {
    if (!enabled) return;
    load();
  }, [enabled, load]);

  const ensureKnown = useCallback(
    (ids: readonly string[]) => {
      if (!enabled) return;
      const state = stateRef.current;
      let unknown = false;
      for (const id of ids) {
        if (state.directory?.ids.has(id)) continue;
        if (state.requested.has(id)) continue;
        state.requested.add(id);
        unknown = true;
      }
      if (unknown) load();
    },
    [enabled, load]
  );

  return { directory, ensureKnown };
}
