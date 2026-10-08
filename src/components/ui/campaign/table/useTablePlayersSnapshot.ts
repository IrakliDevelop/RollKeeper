'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { CampaignPlayer } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/buildEntity';
import type { TableCampaignPlayer } from '@/lib/table/roster';
import type { CampaignPlayerData } from '@/types/campaign';

export type TablePlayersSnapshot =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | {
      status: 'ready';
      /** Identity entries for exact verification (playerId = legacyPlayerId). */
      players: TableCampaignPlayer[];
      /** Display rows for the reused PlayerTab (id = playerId). */
      campaignPlayers: CampaignPlayer[];
      /** Server-authorized rows incl. character data (read-only live merge). */
      data: CampaignPlayerData[];
      /** The latest refresh failed; `data` is the last successful snapshot. */
      stale: boolean;
      /** Time (ms) of the last successful refresh. */
      fetchedAt: number;
    };

/** A reused snapshot is fresh for this long after its fetch. */
const CACHE_FRESH_MS = 10_000;

type ReadySnapshot = Extract<TablePlayersSnapshot, { status: 'ready' }>;

export interface TablePlayersCache {
  get(campaignCode: string): ReadySnapshot | null;
  set(campaignCode: string, snapshot: ReadySnapshot): void;
}

/** PR06 W4: one players snapshot per workspace page, across scene panels. */
export function createTablePlayersCache(): TablePlayersCache {
  const entries = new Map<string, ReadySnapshot>();
  return {
    get: campaignCode => entries.get(campaignCode) ?? null,
    set: (campaignCode, snapshot) => entries.set(campaignCode, snapshot),
  };
}

const PlayersCacheContext = createContext<TablePlayersCache | null>(null);
export const TablePlayersCacheProvider = PlayersCacheContext.Provider;

/**
 * Reads the server-authorized campaign players snapshot (DM-only route).
 * Identity comes only from here; names are display data, never a key.
 * Read-only: no encounter or campaign store is touched.
 */
export function useTablePlayersSnapshot(
  campaignCode: string,
  options: {
    /** Poll interval while a scene run is active (C3-6); null = no polling. */
    pollMs?: number | null;
    /** Changing value triggers a refresh (e.g. each turn change). */
    refreshKey?: unknown;
  } = {}
): {
  snapshot: TablePlayersSnapshot;
  refresh: () => void;
} {
  const cache = useContext(PlayersCacheContext);
  const [snapshot, setSnapshot] = useState<TablePlayersSnapshot>(
    () => cache?.get(campaignCode) ?? { status: 'loading' }
  );
  const [attempt, setAttempt] = useState(0);
  /** Mount read skipped while a workspace-cached snapshot is fresh. */
  const reuseOnMount = useRef(true);
  const inFlight = useRef<AbortController | null>(null);
  const pollMs = options.pollMs ?? null;
  const refreshKey = options.refreshKey;

  useEffect(() => {
    const cached = reuseOnMount.current ? cache?.get(campaignCode) : null;
    reuseOnMount.current = false;
    if (cached && Date.now() - cached.fetchedAt < CACHE_FRESH_MS) return;
    // Single in-flight request: a newer refresh supersedes the previous one.
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    void (async () => {
      try {
        const response = await fetch(
          `/api/campaign/${encodeURIComponent(campaignCode)}/players`,
          { signal: controller.signal, cache: 'no-store' }
        );
        if (!response.ok) throw new Error('players unavailable');
        const data = (await response.json()) as {
          players?: CampaignPlayerData[];
        };
        const rows = (data.players ?? []).filter(
          row =>
            typeof row?.playerId === 'string' &&
            row.playerId.length > 0 &&
            typeof row.characterId === 'string'
        );
        if (controller.signal.aborted) return;
        const ready: ReadySnapshot = {
          status: 'ready',
          players: rows.map(row => ({
            playerId: row.playerId,
            characterId: row.characterId,
            name: row.characterName || row.playerName || row.playerId,
          })),
          campaignPlayers: rows.map(row => ({
            id: row.playerId,
            name: row.characterName || row.playerName || row.playerId,
            class: row.characterData?.class?.name ?? '',
            level: row.characterData?.level ?? 1,
            armorClass: row.characterData?.armorClass ?? 10,
            currentHp: row.characterData?.hitPoints?.current ?? 0,
            maxHp: row.characterData?.hitPoints?.max ?? 0,
            dexterity: row.characterData?.abilities?.dexterity ?? 10,
            avatarUrl: row.characterData?.avatar,
          })),
          data: rows,
          stale: false,
          fetchedAt: Date.now(),
        };
        cache?.set(campaignCode, ready);
        setSnapshot(ready);
      } catch {
        if (controller.signal.aborted) return;
        // F1: a failed poll keeps the last ready data and only marks it stale.
        setSnapshot(previous =>
          previous.status === 'ready'
            ? { ...previous, stale: true }
            : { status: 'unavailable' }
        );
      }
    })();
    return () => controller.abort();
  }, [cache, campaignCode, attempt, refreshKey]);

  useEffect(() => {
    if (pollMs === null) return;
    const timer = setInterval(() => setAttempt(value => value + 1), pollMs);
    return () => clearInterval(timer);
  }, [pollMs]);

  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  return { snapshot, refresh };
}
