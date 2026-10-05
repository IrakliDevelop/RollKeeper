import type { CalendarEvent } from '@/types/calendar';

type DayKey = Pick<CalendarEvent, 'year' | 'month' | 'day'>;

export type EventMoveDirection = 'up' | 'down';

export function isSameEventDay(a: DayKey, b: DayKey): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * Orders events that share a day. DM-arranged events (with `sortOrder`) come
 * first; events never arranged keep creation order. Remaining ties return 0
 * so the (stable) sort keeps array order, as player projections carry no
 * `sortOrder` or `createdAt`.
 */
export function compareEventsWithinDay(
  a: CalendarEvent,
  b: CalendarEvent
): number {
  if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  } else if (a.sortOrder !== undefined) {
    return -1;
  } else if (b.sortOrder !== undefined) {
    return 1;
  }
  return a.createdAt - b.createdAt;
}

export function sortEventsWithinDay(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(compareEventsWithinDay);
}

/**
 * The `sortOrder` a new or newly-moved event gets on `day`: after every other
 * event there, or none while the day has never been arranged.
 */
export function nextSortOrderForDay(
  events: CalendarEvent[],
  day: DayKey,
  excludeId?: string
): number | undefined {
  const orders = events
    .filter(e => e.id !== excludeId && isSameEventDay(e, day))
    .map(e => e.sortOrder)
    .filter((order): order is number => order !== undefined);
  if (orders.length === 0) return undefined;
  return Math.max(...orders) + 1;
}

/**
 * Moves one event up or down among the events on its day and renumbers that
 * day 0..n-1. Returns the same array when the move is a no-op.
 */
export function moveEventWithinDay(
  events: CalendarEvent[],
  eventId: string,
  direction: EventMoveDirection
): CalendarEvent[] {
  const target = events.find(e => e.id === eventId);
  if (!target) return events;
  const dayEvents = sortEventsWithinDay(
    events.filter(e => isSameEventDay(e, target))
  );
  const from = dayEvents.findIndex(e => e.id === eventId);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= dayEvents.length) return events;

  [dayEvents[from], dayEvents[to]] = [dayEvents[to], dayEvents[from]];
  const nextOrder = new Map(dayEvents.map((e, index) => [e.id, index]));
  return events.map(e =>
    nextOrder.has(e.id) ? { ...e, sortOrder: nextOrder.get(e.id) } : e
  );
}
