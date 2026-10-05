import { describe, it, expect } from 'vitest';
import {
  compareEventsWithinDay,
  moveEventWithinDay,
  nextSortOrderForDay,
  sortEventsWithinDay,
} from '@/utils/calendarEventOrder';
import type { CalendarEvent } from '@/types/calendar';

function makeEvent(
  id: string,
  createdAt: number,
  overrides: Partial<CalendarEvent> = {}
): CalendarEvent {
  return {
    id,
    title: id,
    description: '',
    year: 1,
    month: 0,
    day: 4,
    createdAt,
    ...overrides,
  };
}

const ids = (events: CalendarEvent[]) => events.map(e => e.id);

describe('compareEventsWithinDay', () => {
  it('falls back to creation order, then array order, when never arranged', () => {
    const events = [
      makeEvent('c', 0),
      makeEvent('late', 20),
      makeEvent('early', 10),
      makeEvent('a', 0),
    ];
    expect(ids(sortEventsWithinDay(events))).toEqual([
      'c',
      'a',
      'early',
      'late',
    ]);
  });

  it('orders arranged events by sortOrder ahead of unarranged ones', () => {
    const events = [
      makeEvent('unarranged', 1),
      makeEvent('second', 2, { sortOrder: 1 }),
      makeEvent('first', 3, { sortOrder: 0 }),
    ];
    expect(ids(sortEventsWithinDay(events))).toEqual([
      'first',
      'second',
      'unarranged',
    ]);
  });

  it('breaks equal sortOrder ties by creation order', () => {
    expect(
      compareEventsWithinDay(
        makeEvent('a', 5, { sortOrder: 0 }),
        makeEvent('b', 1, { sortOrder: 0 })
      )
    ).toBeGreaterThan(0);
  });

  it('does not mutate its input', () => {
    const events = [makeEvent('b', 2), makeEvent('a', 1)];
    sortEventsWithinDay(events);
    expect(ids(events)).toEqual(['b', 'a']);
  });
});

describe('moveEventWithinDay', () => {
  const morning = makeEvent('morning', 3);
  const midday = makeEvent('midday', 1);
  const evening = makeEvent('evening', 2);
  const otherDay = makeEvent('other-day', 0, { day: 5 });
  const events = [morning, midday, evening, otherDay];

  it('moves an event earlier and renumbers the whole day', () => {
    // Creation order: midday, evening, morning.
    const once = moveEventWithinDay(events, 'morning', 'up');
    const twice = moveEventWithinDay(once, 'morning', 'up');
    expect(ids(sortEventsWithinDay(twice.filter(e => e.day === 4)))).toEqual([
      'morning',
      'midday',
      'evening',
    ]);
    expect(twice.find(e => e.id === 'morning')?.sortOrder).toBe(0);
    expect(twice.find(e => e.id === 'midday')?.sortOrder).toBe(1);
    expect(twice.find(e => e.id === 'evening')?.sortOrder).toBe(2);
  });

  it('moves an event later', () => {
    const moved = moveEventWithinDay(events, 'midday', 'down');
    expect(ids(sortEventsWithinDay(moved.filter(e => e.day === 4)))).toEqual([
      'evening',
      'midday',
      'morning',
    ]);
  });

  it('leaves events on other days and array order untouched', () => {
    const moved = moveEventWithinDay(events, 'morning', 'up');
    expect(ids(moved)).toEqual(ids(events));
    expect(moved.find(e => e.id === 'other-day')).toBe(otherDay);
  });

  it('returns the same array for no-op moves', () => {
    expect(moveEventWithinDay(events, 'midday', 'up')).toBe(events);
    expect(moveEventWithinDay(events, 'morning', 'down')).toBe(events);
    expect(moveEventWithinDay(events, 'missing', 'up')).toBe(events);
  });
});

describe('nextSortOrderForDay', () => {
  it('is undefined while the day has never been arranged', () => {
    expect(nextSortOrderForDay([makeEvent('a', 1)], makeEvent('x', 0))).toBe(
      undefined
    );
  });

  it('places after the highest sortOrder on that day only', () => {
    const events = [
      makeEvent('a', 1, { sortOrder: 0 }),
      makeEvent('b', 2, { sortOrder: 3 }),
      makeEvent('elsewhere', 3, { day: 9, sortOrder: 7 }),
    ];
    expect(nextSortOrderForDay(events, makeEvent('x', 0))).toBe(4);
  });

  it('ignores the excluded event', () => {
    const events = [makeEvent('a', 1, { sortOrder: 0 })];
    expect(nextSortOrderForDay(events, makeEvent('x', 0), 'a')).toBe(undefined);
  });
});
