import { useState, useEffect, useCallback, useRef } from 'react';
import type { SharedCampaignState, ItemTransfer } from '@/types/sharedState';

const POLL_INTERVAL_MS = 15000; // 15 seconds
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
  acknowledgeTransfers: () => Promise<void>;
  pendingTransfers: ItemTransfer[];
  clearPendingTransfer: (transferId: string) => void;
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

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    intervalRef.current = setInterval(fetchSharedState, POLL_INTERVAL_MS);
  }, [fetchSharedState, stopPolling]);

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
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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

  const acknowledgeTransfers = useCallback(async () => {
    if (!campaignCode || !playerId) return;
    try {
      await fetch(`/api/campaign/${campaignCode}/shared`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, type: 'transfers' }),
      });
      setSharedState(prev => {
        if (!prev) return prev;
        return { ...prev, transfers: [] };
      });
    } catch (err) {
      console.error('Failed to acknowledge transfers:', err);
    }
  }, [campaignCode, playerId]);

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
    pendingTransfers,
    clearPendingTransfer,
  };
}
