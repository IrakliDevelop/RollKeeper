import type { StateStorage } from 'zustand/middleware';

import { createSafeStorage } from '@/lib/safeStorage';

import { calendarUsesIndexedDbAuthority } from './calendarLegacyProjection';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function calendars(value: unknown): Array<Record<string, unknown>> | null {
  if (
    !record(value) ||
    !record(value.state) ||
    !Array.isArray(value.state.calendars)
  )
    return null;
  return value.state.calendars.filter(record);
}

export function createCalendarAwareStorage(backing?: Storage): StateStorage {
  const safe = createSafeStorage(backing);
  const storage =
    backing ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  return {
    getItem: safe.getItem,
    removeItem: safe.removeItem,
    setItem(key, nextRaw) {
      if (key !== 'rollkeeper-calendar-data' || !storage)
        return safe.setItem(key, nextRaw);
      const previousRaw = storage.getItem(key);
      if (!previousRaw) return safe.setItem(key, nextRaw);
      try {
        const previous = JSON.parse(previousRaw) as unknown;
        const next = JSON.parse(nextRaw) as unknown;
        const previousCalendars = calendars(previous);
        const nextCalendars = calendars(next);
        if (!previousCalendars || !nextCalendars)
          return safe.setItem(key, nextRaw);
        let routed = false;
        for (const nextCalendar of nextCalendars) {
          const code =
            typeof nextCalendar.campaignCode === 'string'
              ? nextCalendar.campaignCode
              : null;
          if (!code || !calendarUsesIndexedDbAuthority(storage, code)) continue;
          const previousCalendar = previousCalendars.find(
            value => value.campaignCode === code
          );
          if (!previousCalendar) continue;
          routed = true;
          Object.keys(nextCalendar).forEach(key => delete nextCalendar[key]);
          Object.assign(nextCalendar, structuredClone(previousCalendar));
        }
        if (!routed) return safe.setItem(key, nextRaw);
        const routedRaw = JSON.stringify(next);
        if (routedRaw !== previousRaw) return safe.setItem(key, routedRaw);
      } catch {
        return safe.setItem(key, nextRaw);
      }
    },
  };
}
