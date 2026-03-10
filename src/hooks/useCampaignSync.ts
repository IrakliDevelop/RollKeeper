import { useState, useEffect, useCallback, useRef } from 'react';
import { CampaignPlayerData } from '@/types/campaign';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 3 minutes
const ACTIVITY_EVENTS = [
  'mousemove',
  'keydown',
  'mousedown',
  'touchstart',
  'scroll',
] as const;

interface UseCampaignSyncOptions {
  code: string;
  dmId: string;
  campaignName: string;
  createdAt: string;
  interval?: number;
  enabled?: boolean;
  idleTimeout?: number;
}

interface UseCampaignSyncResult {
  players: CampaignPlayerData[];
  campaignName: string | null;
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
  refresh: () => Promise<void>;
}

export function useCampaignSync({
  code,
  dmId,
  campaignName: localCampaignName,
  createdAt,
  interval = 10000,
  enabled = true,
  idleTimeout = IDLE_TIMEOUT_MS,
}: UseCampaignSyncOptions): UseCampaignSyncResult {
  const [players, setPlayers] = useState<CampaignPlayerData[]>([]);
  const [campaignName, setCampaignName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const restoringRef = useRef(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(false);

  const restoreCampaign = useCallback(async () => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    try {
      await fetch(`/api/campaign/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dmId,
          campaignName: localCampaignName,
          createdAt,
        }),
      });
    } finally {
      restoringRef.current = false;
    }
  }, [code, dmId, localCampaignName, createdAt]);

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaign/${code}/players`);
      if (!res.ok) {
        throw new Error('Failed to fetch players');
      }

      const data = await res.json();

      if (data.campaign === null) {
        await restoreCampaign();
        setCampaignName(localCampaignName);
      } else {
        setCampaignName(data.campaign?.name ?? null);
      }

      setPlayers(data.players ?? []);
      setError(null);
      setLastFetched(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch player data'
      );
    } finally {
      setLoading(false);
    }
  }, [code, localCampaignName, restoreCampaign]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    intervalRef.current = setInterval(fetchPlayers, interval);
  }, [fetchPlayers, interval, stopPolling]);

  const pausePolling = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    stopPolling();
  }, [stopPolling]);

  const resumePolling = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    // Fetch immediately to catch up, then resume normal interval
    fetchPlayers();
    startPolling();
  }, [fetchPlayers, startPolling]);

  // Visibility change: pause when tab is hidden, resume when visible
  useEffect(() => {
    if (!enabled || !code) return;

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
  }, [enabled, code, pausePolling, resumePolling]);

  // Idle detection: pause after no activity for idleTimeout
  useEffect(() => {
    if (!enabled || !code) return;

    const resetIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      // If we were paused due to idle, resume now
      if (isPausedRef.current && !document.hidden) {
        resumePolling();
      }

      idleTimerRef.current = setTimeout(pausePolling, idleTimeout);
    };

    // Start the idle timer
    idleTimerRef.current = setTimeout(pausePolling, idleTimeout);

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
  }, [enabled, code, idleTimeout, pausePolling, resumePolling]);

  // Core polling: initial fetch + interval
  useEffect(() => {
    if (!enabled || !code) return;

    isPausedRef.current = false;
    fetchPlayers();
    startPolling();

    return () => {
      stopPolling();
    };
  }, [code, enabled, fetchPlayers, startPolling, stopPolling]);

  return {
    players,
    campaignName,
    loading,
    error,
    lastFetched,
    refresh: fetchPlayers,
  };
}
