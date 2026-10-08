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
  /**
   * Acceptance A4: one shared read per campaign at a time — concurrent
   * consumers (scene roster, combat panel, StrictMode re-runs) share it.
   */
  load(
    campaignCode: string,
    read: () => Promise<ReadySnapshot>
  ): Promise<ReadySnapshot>;
}

/** PR06 W4: one players snapshot per workspace page, across scene panels. */
export function createTablePlayersCache(): TablePlayersCache {
  const entries = new Map<string, ReadySnapshot>();
  const inFlight = new Map<string, Promise<ReadySnapshot>>();
  return {
    get: campaignCode => entries.get(campaignCode) ?? null,
    set: (campaignCode, snapshot) => entries.set(campaignCode, snapshot),
    load: (campaignCode, read) => {
      const pending = inFlight.get(campaignCode);
      if (pending) return pending;
      const promise = read()
        .then(ready => {
          entries.set(campaignCode, ready);
          return ready;
        })
        .finally(() => inFlight.delete(campaignCode));
      inFlight.set(campaignCode, promise);
      return promise;
    },
  };
}

const PlayersCacheContext = createContext<TablePlayersCache | null>(null);
export const TablePlayersCacheProvider = PlayersCacheContext.Provider;

/**
 * Reads the server-authorized campaign players snapshot (DM-only route).
 * Identity comes only from here; names are display data, never a key.
 * Read-only: no encounter or campaign store is touched.
 */
/** One read of the DM-only players route (throws when unavailable). */
async function readPlayers(
  campaignCode: string,
  signal: AbortSignal
): Promise<ReadySnapshot> {
  const response = await fetch(
    `/api/campaign/${encodeURIComponent(campaignCode)}/players`,
    { signal, cache: 'no-store' }
  );
  if (!response.ok) throw new Error('players unavailable');
  const data = (await response.json()) as { players?: CampaignPlayerData[] };
  const rows = (data.players ?? []).filter(
    row =>
      typeof row?.playerId === 'string' &&
      row.playerId.length > 0 &&
      typeof row.characterId === 'string'
  );
  return {
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
}

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
  /**
   * Acceptance A1: read the server now (one shared in-flight read, aborted
   * on unmount), update the workspace cache, and resolve with the fresh
   * players — or null when the route is unavailable.
   */
  reload: () => Promise<TableCampaignPlayer[] | null>;
} {
  const cache = useContext(PlayersCacheContext);
  const [snapshot, setSnapshot] = useState<TablePlayersSnapshot>(
    () => cache?.get(campaignCode) ?? { status: 'loading' }
  );
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef<AbortController | null>(null);
  const pollMs = options.pollMs ?? null;
  const refreshKey = options.refreshKey;

  const markFailed = useCallback(
    () =>
      // F1: a failed read keeps the last ready data and only marks it stale.
      setSnapshot(previous =>
        previous.status === 'ready'
          ? { ...previous, stale: true }
          : { status: 'unavailable' }
      ),
    []
  );

  /** The (attempt, refreshKey) the last read was triggered by. */
  const lastTrigger = useRef<{ attempt: number; refreshKey: unknown } | null>(
    null
  );
  useEffect(() => {
    const previous = lastTrigger.current;
    lastTrigger.current = { attempt, refreshKey };
    // A4: only an explicit refresh/poll/refreshKey change forces a read; a
    // (re)mount — including StrictMode's effect re-run — reuses a fresh
    // workspace snapshot.
    const forced =
      previous !== null &&
      (previous.attempt !== attempt || previous.refreshKey !== refreshKey);
    const cached = cache?.get(campaignCode);
    if (!forced && cached && Date.now() - cached.fetchedAt < CACHE_FRESH_MS) {
      setSnapshot(current => (current === cached ? current : cached));
      return;
    }
    if (cache) {
      let active = true;
      void cache
        .load(campaignCode, () =>
          readPlayers(campaignCode, new AbortController().signal)
        )
        .then(ready => {
          if (active) setSnapshot(ready);
        })
        .catch(() => {
          if (active) markFailed();
        });
      return () => {
        active = false;
      };
    }
    // Single in-flight request: a newer refresh supersedes the previous one.
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    void readPlayers(campaignCode, controller.signal)
      .then(ready => {
        if (controller.signal.aborted) return;
        setSnapshot(ready);
      })
      .catch(() => {
        if (!controller.signal.aborted) markFailed();
      });
    return () => controller.abort();
  }, [cache, campaignCode, attempt, refreshKey, markFailed]);

  useEffect(() => {
    if (pollMs === null) return;
    const timer = setInterval(() => setAttempt(value => value + 1), pollMs);
    return () => clearInterval(timer);
  }, [pollMs]);

  const reloading = useRef<{
    controller: AbortController;
    promise: Promise<TableCampaignPlayer[] | null>;
  } | null>(null);
  useEffect(
    () => () => {
      reloading.current?.controller.abort();
      reloading.current = null;
    },
    []
  );
  const reload = useCallback((): Promise<TableCampaignPlayer[] | null> => {
    if (reloading.current) return reloading.current.promise;
    const controller = new AbortController();
    // A shared workspace read is never aborted by one consumer.
    const promise = (
      cache
        ? cache.load(campaignCode, () =>
            readPlayers(campaignCode, new AbortController().signal)
          )
        : readPlayers(campaignCode, controller.signal)
    )
      .then(ready => {
        if (controller.signal.aborted) return null;
        setSnapshot(ready);
        return ready.players;
      })
      .catch(() => {
        if (!controller.signal.aborted) markFailed();
        return null;
      })
      .finally(() => {
        if (reloading.current?.controller === controller)
          reloading.current = null;
      });
    reloading.current = { controller, promise };
    return promise;
  }, [cache, campaignCode, markFailed]);

  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  return { snapshot, refresh, reload };
}
