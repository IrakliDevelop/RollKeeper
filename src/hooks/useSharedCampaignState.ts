import { useState, useEffect, useCallback, useRef } from 'react';
import type { SharedCampaignState, ItemTransfer } from '@/types/sharedState';

const POLL_INTERVAL_MS = 15000; // 15 seconds (idle / out of combat)
const COMBAT_POLL_INTERVAL_MS = 5000; // 5 seconds while combat is active
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_EVENTS = [
  'mousemove',
  'keydown',
  'mousedown',
  'touchstart',
  'scroll',
] as const;

interface UseSharedCampaignStateResult {
  sharedState: SharedCampaignState | null;
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
  acknowledgeMessage: (messageId: string) => Promise<void>;
  acknowledgeDmEffects: () => Promise<void>;
  /**
   * Acknowledges one or more transfers by id in a SINGLE request, or — with
   * no argument — the entire queue. Always pass exactly the ids that were
   * applied, as a batch when there's more than one: this route does a
   * non-atomic read-filter-write, so N separate concurrent calls (one per
   * id) race each other and the last writer silently undoes every other
   * call's removal — the batch form does one read-filter-write for the
   * whole set instead. A no-argument call DELETEs the whole Redis key,
   * destroying any transfer enqueued between the client's last poll and
   * this call before it's ever applied (harmless for a gift, a silently
   * lost purchase for one that carries `costCopper`).
   *
   * Resolves `true` iff the server actually confirmed the acknowledge (a
   * non-2xx response resolves `false`, same as a network failure) — unlike
   * the other acknowledge helpers, the caller uses this to decide whether
   * it's safe to forget local dedup state for these ids (see
   * `useItemTransferAutoMerge`); a false positive here would let the ledger
   * forget a transfer the server still holds, re-applying (and, for a
   * purchase, re-charging) it on the next reload.
   */
  acknowledgeTransfers: (transferIds?: string | string[]) => Promise<boolean>;
  /**
   * Acknowledge one XP award by receipt. THROWS on failure (unlike the other
   * acknowledge helpers) — the award processor must stop, not continue.
   */
  acknowledgeXpAward: (receipt: string) => Promise<void>;
  pendingTransfers: ItemTransfer[];
  clearPendingTransfer: (transferId: string) => void;
  /** Immediate refetch (e.g. on a relay poke). Debounced: at most one per second. */
  refetchNow: () => void;
}

export function useSharedCampaignState(
  campaignCode: string | null | undefined,
  playerId?: string | null
): UseSharedCampaignStateResult {
  const [sharedState, setSharedState] = useState<SharedCampaignState | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [pendingTransfers, setPendingTransfers] = useState<ItemTransfer[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(false);
  const currentIntervalRef = useRef(POLL_INTERVAL_MS);
  // Stable ref so fetchSharedState can call startPolling without a circular dep.
  const startPollingRef = useRef<() => void>(() => {});

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchSharedState = useCallback(async () => {
    if (!campaignCode) return;
    try {
      const params = new URLSearchParams({ role: 'player' });
      if (playerId) params.set('playerId', playerId);
      const res = await fetch(`/api/campaign/${campaignCode}/shared?${params}`);
      if (!res.ok) {
        throw new Error('Failed to fetch shared state');
      }
      const data: SharedCampaignState = await res.json();
      setSharedState(data);
      setError(null);
      setLastFetched(new Date());
      // Adaptive poll: 5s while combat is active, 15s otherwise.
      const desired = data.initiative?.isActive
        ? COMBAT_POLL_INTERVAL_MS
        : POLL_INTERVAL_MS;
      if (desired !== currentIntervalRef.current && !isPausedRef.current) {
        currentIntervalRef.current = desired;
        startPollingRef.current();
      }
      if (data.transfers && data.transfers.length > 0) {
        setPendingTransfers(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newTransfers = data.transfers.filter(
            t => !existingIds.has(t.id)
          );
          return newTransfers.length > 0 ? [...prev, ...newTransfers] : prev;
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch shared state'
      );
    } finally {
      setLoading(false);
    }
  }, [campaignCode, playerId]);

  const REFETCH_DEBOUNCE_MS = 1000;
  const lastRefetchNowRef = useRef(0);
  const refetchNow = useCallback(() => {
    const now = Date.now();
    if (now - lastRefetchNowRef.current < REFETCH_DEBOUNCE_MS) return;
    lastRefetchNowRef.current = now;
    fetchSharedState();
  }, [fetchSharedState]);

  const startPolling = useCallback(() => {
    stopPolling();
    intervalRef.current = setInterval(
      fetchSharedState,
      currentIntervalRef.current
    );
  }, [fetchSharedState, stopPolling]);

  // Keep the ref in sync with the latest startPolling callback.
  startPollingRef.current = startPolling;

  const pausePolling = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    stopPolling();
  }, [stopPolling]);

  const resumePolling = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    fetchSharedState();
    startPolling();
  }, [fetchSharedState, startPolling]);

  // Visibility change
  useEffect(() => {
    if (!campaignCode) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pausePolling();
      } else {
        resumePolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [campaignCode, pausePolling, resumePolling]);

  // Idle detection
  useEffect(() => {
    if (!campaignCode) return;

    const resetIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (isPausedRef.current && !document.hidden) {
        resumePolling();
      }
      idleTimerRef.current = setTimeout(pausePolling, IDLE_TIMEOUT_MS);
    };

    idleTimerRef.current = setTimeout(pausePolling, IDLE_TIMEOUT_MS);

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    }

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetIdleTimer);
      }
    };
  }, [campaignCode, pausePolling, resumePolling]);

  // Core polling
  useEffect(() => {
    if (!campaignCode) {
      setSharedState(null);
      setLoading(false);
      return;
    }

    isPausedRef.current = false;
    setLoading(true);
    fetchSharedState();
    startPolling();

    return () => {
      stopPolling();
    };
  }, [campaignCode, fetchSharedState, startPolling, stopPolling]);

  const acknowledgeMessage = useCallback(
    async (messageId: string) => {
      if (!campaignCode || !playerId) return;
      try {
        await fetch(`/api/campaign/${campaignCode}/shared`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-rollkeeper-csrf': '1',
          },
          body: JSON.stringify({ playerId, messageId }),
        });
        // Optimistically remove from local state
        setSharedState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.filter(m => m.id !== messageId),
          };
        });
      } catch (err) {
        console.error('Failed to acknowledge message:', err);
      }
    },
    [campaignCode, playerId]
  );

  const acknowledgeDmEffects = useCallback(async () => {
    if (!campaignCode || !playerId) return;
    try {
      await fetch(`/api/campaign/${campaignCode}/shared`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-rollkeeper-csrf': '1',
        },
        body: JSON.stringify({ playerId, type: 'effects' }),
      });
      setSharedState(prev => {
        if (!prev) return prev;
        return { ...prev, dmEffects: [] };
      });
    } catch (err) {
      console.error('Failed to acknowledge DM effects:', err);
    }
  }, [campaignCode, playerId]);

  const acknowledgeTransfers = useCallback(
    async (transferIds?: string | string[]): Promise<boolean> => {
      if (!campaignCode || !playerId) return false;
      const ids = Array.isArray(transferIds)
        ? transferIds
        : transferIds
          ? [transferIds]
          : undefined;
      try {
        const res = await fetch(`/api/campaign/${campaignCode}/shared`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-rollkeeper-csrf': '1',
          },
          body: JSON.stringify({
            playerId,
            type: 'transfers',
            // `ids` is only `undefined` when the caller passed no argument
            // at all (the deliberate "clear the whole queue" call). An
            // explicit empty array must still be SENT as `transferIds: []`
            // — eliding it here (as an earlier version did whenever
            // `ids.length === 0`) made an intentional empty-batch no-op
            // indistinguishable, server-side, from "no id field at all",
            // which the route treats as a full-queue DELETE (Slice 3 final
            // review, Important finding).
            ...(ids !== undefined ? { transferIds: ids } : {}),
          }),
        });
        // `fetch` only rejects on network failure — a 403 (guest binding),
        // 400, or 500 resolves normally and would otherwise report success
        // on an acknowledge the server never actually performed, letting
        // the caller forget dedup state for a transfer Redis still holds.
        if (!res.ok) return false;
        setSharedState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            transfers: ids
              ? prev.transfers.filter(t => !ids.includes(t.id))
              : [],
          };
        });
        return true;
      } catch (err) {
        console.error('Failed to acknowledge transfers:', err);
        return false;
      }
    },
    [campaignCode, playerId]
  );

  const acknowledgeXpAward = useCallback(
    async (receipt: string) => {
      if (!campaignCode || !playerId) {
        throw new Error('Cannot acknowledge XP award outside a campaign');
      }
      const res = await fetch(`/api/campaign/${campaignCode}/shared`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-rollkeeper-csrf': '1',
        },
        body: JSON.stringify({ playerId, type: 'xp', receipt }),
      });
      if (!res.ok) {
        throw new Error(`Failed to acknowledge XP award (${res.status})`);
      }
      setSharedState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          xpAwards: (prev.xpAwards ?? []).filter(e => e.receipt !== receipt),
        };
      });
    },
    [campaignCode, playerId]
  );

  const clearPendingTransfer = useCallback((transferId: string) => {
    setPendingTransfers(prev => prev.filter(t => t.id !== transferId));
  }, []);

  return {
    sharedState,
    loading,
    error,
    lastFetched,
    acknowledgeMessage,
    acknowledgeDmEffects,
    acknowledgeTransfers,
    acknowledgeXpAward,
    pendingTransfers,
    clearPendingTransfer,
    refetchNow,
  };
}
