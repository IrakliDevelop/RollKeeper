import { useEffect, useRef, useState, useCallback } from 'react';
import { useCalendarStore } from '@/store/calendarStore';
import type { SharedCalendar } from '@/types/sharedState';

const DEBOUNCE_MS = 2000;

interface DmCalendarSyncStatus {
  lastPushed: Date | null;
  error: string | null;
}

export function useDmCalendarSync(
  campaignCode: string,
  dmId: string
): DmCalendarSyncStatus {
  const [lastPushed, setLastPushed] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCalendarRef = useRef<{
    config: SharedCalendar['config'];
    currentTime: number;
    startTime: number;
    weather?: SharedCalendar['weather'];
  } | null>(null);
  const hasPushedRef = useRef(false);

  const pushCalendar = useCallback(
    async (calendar: {
      config: SharedCalendar['config'];
      currentTime: number;
      startTime: number;
      weather?: SharedCalendar['weather'];
    }) => {
      const data: SharedCalendar = {
        config: calendar.config,
        currentTime: calendar.currentTime,
        startTime: calendar.startTime,
        weather: calendar.weather,
        updatedAt: new Date().toISOString(),
      };

      try {
        const res = await fetch(`/api/campaign/${campaignCode}/shared`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feature: 'calendar',
            data,
            dmId,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = body.error || `Push failed (${res.status})`;
          console.error('Calendar sync push failed:', msg);
          setError(msg);
          return;
        }

        pendingCalendarRef.current = null;
        setLastPushed(new Date());
        setError(null);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Network error pushing calendar';
        console.error('Failed to push calendar to shared state:', msg);
        setError(msg);
      }
    },
    [campaignCode, dmId]
  );

  useEffect(() => {
    const debouncedPush = (calendar: {
      config: SharedCalendar['config'];
      currentTime: number;
      startTime: number;
      weather?: SharedCalendar['weather'];
    }) => {
      pendingCalendarRef.current = calendar;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        pushCalendar(calendar);
      }, DEBOUNCE_MS);
    };

    // Flush any pending push immediately when tab is about to hide
    const handleVisibilityChange = () => {
      if (document.hidden && pendingCalendarRef.current) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        pushCalendar(pendingCalendarRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Push once on mount to seed Redis
    const initial = useCalendarStore
      .getState()
      .calendars.find(c => c.campaignCode === campaignCode);
    if (initial && !hasPushedRef.current) {
      hasPushedRef.current = true;
      pushCalendar(initial);
    }

    // Subscribe to store changes
    const unsubscribe = useCalendarStore.subscribe((state, prevState) => {
      const current = state.calendars.find(
        c => c.campaignCode === campaignCode
      );
      const prev = prevState.calendars.find(
        c => c.campaignCode === campaignCode
      );

      if (!current) return;

      if (
        current.config !== prev?.config ||
        current.currentTime !== prev?.currentTime ||
        current.startTime !== prev?.startTime ||
        current.weather !== prev?.weather
      ) {
        debouncedPush(current);
      }
    });

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Flush on cleanup (e.g. navigating away within the app)
      if (debounceRef.current && pendingCalendarRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        pushCalendar(pendingCalendarRef.current);
      }
    };
  }, [campaignCode, pushCalendar]);

  return { lastPushed, error };
}
