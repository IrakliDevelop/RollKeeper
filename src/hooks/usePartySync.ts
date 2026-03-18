import { useState, useEffect, useCallback, useRef } from 'react';
import { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = [
  'mousemove',
  'keydown',
  'mousedown',
  'touchstart',
  'scroll',
] as const;

interface UsePartySyncOptions {
  campaignCode: string | null;
  currentCharacterId: string;
  interval?: number;
  enabled?: boolean;
}

interface UsePartySyncResult {
  partyMembers: PartyMemberHP[];
  loading: boolean;
}

export function usePartySync({
  campaignCode,
  currentCharacterId,
  interval = 20000,
  enabled = true,
}: UsePartySyncOptions): UsePartySyncResult {
  const [partyMembers, setPartyMembers] = useState<PartyMemberHP[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(false);

  const fetchPartyHP = useCallback(async () => {
    if (!campaignCode) return;
    try {
      const res = await fetch(`/api/campaign/${campaignCode}/party-hp`);
      if (!res.ok) return;
      const data = await res.json();
      const members: PartyMemberHP[] = data.members ?? [];
      // Filter out self
      setPartyMembers(
        members.filter(m => m.characterId !== currentCharacterId)
      );
    } catch {
      // Silent failure — party HP is non-critical
    } finally {
      setLoading(false);
    }
  }, [campaignCode, currentCharacterId]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    intervalRef.current = setInterval(fetchPartyHP, interval);
  }, [fetchPartyHP, interval, stopPolling]);

  const pausePolling = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    stopPolling();
  }, [stopPolling]);

  const resumePolling = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    fetchPartyHP();
    startPolling();
  }, [fetchPartyHP, startPolling]);

  // Visibility detection
  useEffect(() => {
    if (!enabled || !campaignCode) return;

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
  }, [enabled, campaignCode, pausePolling, resumePolling]);

  // Idle detection
  useEffect(() => {
    if (!enabled || !campaignCode) return;

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
  }, [enabled, campaignCode, pausePolling, resumePolling]);

  // Core polling
  useEffect(() => {
    if (!enabled || !campaignCode) {
      setPartyMembers([]);
      setLoading(false);
      return;
    }

    isPausedRef.current = false;
    fetchPartyHP();
    startPolling();

    return () => {
      stopPolling();
    };
  }, [campaignCode, enabled, fetchPartyHP, startPolling, stopPolling]);

  return { partyMembers, loading };
}
