'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LocationMetadata, SyncedLocation } from '@/types/location';

const POLL_INTERVAL_MS = 20_000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = [
  'mousemove',
  'keydown',
  'mousedown',
  'touchstart',
  'scroll',
] as const;

interface UseLocationSyncResult {
  locations: LocationMetadata[];
  loading: boolean;
  fetchLocationState: (id: string) => Promise<SyncedLocation | null>;
}

export function useLocationSync(
  campaignCode: string | undefined
): UseLocationSyncResult {
  const [locations, setLocations] = useState<LocationMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isPausedRef = useRef(false);

  const isIdle = useCallback(() => {
    return Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS;
  }, []);

  const fetchLocations = useCallback(async () => {
    if (!campaignCode) {
      setLoading(false);
      return;
    }
    if (document.hidden || isIdle()) return;

    try {
      const res = await fetch(`/api/campaign/${campaignCode}/locations`);
      if (!res.ok) return;
      const data = await res.json();
      setLocations(data.locations ?? []);
    } catch {
      // Silently ignore fetch errors — we'll retry on next interval
    } finally {
      setLoading(false);
    }
  }, [campaignCode, isIdle]);

  const fetchLocationState = useCallback(
    async (id: string): Promise<SyncedLocation | null> => {
      if (!campaignCode) return null;
      try {
        const res = await fetch(
          `/api/campaign/${campaignCode}/locations/${id}`
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.location ?? null;
      } catch {
        return null;
      }
    },
    [campaignCode]
  );

  // Track user activity to detect idle
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (isPausedRef.current && !document.hidden) {
        isPausedRef.current = false;
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, []);

  // Polling with visibility check
  useEffect(() => {
    if (!campaignCode) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchLocations();

    intervalRef.current = setInterval(() => {
      if (document.hidden || isIdle()) return;
      fetchLocations();
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden && !isIdle()) {
        // Tab became visible — fetch immediately to catch up
        fetchLocations();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [campaignCode, fetchLocations, isIdle]);

  return { locations, loading, fetchLocationState };
}
