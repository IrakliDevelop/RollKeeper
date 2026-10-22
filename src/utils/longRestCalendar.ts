import type { CalendarConfig } from '@/types/calendar';
import { getMsPerDay } from '@/utils/calendarCalculations';

/** The one toast line a long rest adds when it moves the local calendar. */
export const CALENDAR_ADVANCED_DETAIL = 'Calendar advanced by 1 day';

/**
 * The DM's shared calendar, but only when this player is in a campaign and
 * the DM has shared one. Anything else means the character's own local
 * calendar applies. Returns the calendar so callers keep its type.
 */
export function getSyncedCalendar<T extends object>(
  campaignCode: string | null | undefined,
  sharedCalendar: T | null | undefined
): T | null {
  return campaignCode && sharedCalendar ? sharedCalendar : null;
}

/**
 * A long rest moves the local calendar one day, unless the DM's shared
 * calendar is in charge or the character has no calendar. Returns whether it
 * advanced, so the toast only mentions the day when it moved.
 */
export function advanceLocalCalendarForLongRest({
  synced,
  calendar,
  advance,
}: {
  synced: boolean;
  calendar: { config: CalendarConfig } | null | undefined;
  advance: (ms: number) => void;
}): boolean {
  if (synced || !calendar) return false;
  advance(getMsPerDay(calendar.config));
  return true;
}

export function calendarRestDetails(advanced: boolean): string[] {
  return advanced ? [CALENDAR_ADVANCED_DETAIL] : [];
}
