import { describe, expect, it, vi } from 'vitest';
import { CALENDAR_PRESETS } from '@/utils/calendarPresets';
import { getMsPerDay } from '@/utils/calendarCalculations';
import {
  CALENDAR_ADVANCED_DETAIL,
  advanceLocalCalendarForLongRest,
  calendarRestDetails,
  getSyncedCalendar,
} from './longRestCalendar';

const config = CALENDAR_PRESETS[0].create();
const shared = { currentTime: 0, startTime: 0, config };

describe('getSyncedCalendar', () => {
  it('returns the shared calendar only with a campaign code and a calendar', () => {
    expect(getSyncedCalendar('ABC123', shared)).toBe(shared);
  });
  it('is null without a campaign code, even if shared state lingers', () => {
    expect(getSyncedCalendar(null, shared)).toBeNull();
    expect(getSyncedCalendar(undefined, shared)).toBeNull();
    expect(getSyncedCalendar('', shared)).toBeNull();
  });
  it('is null when the DM has shared no calendar', () => {
    expect(getSyncedCalendar('ABC123', null)).toBeNull();
    expect(getSyncedCalendar('ABC123', undefined)).toBeNull();
  });
});

describe('advanceLocalCalendarForLongRest', () => {
  it('advances one day and reports it when unsynced with a local calendar', () => {
    const advance = vi.fn();
    expect(
      advanceLocalCalendarForLongRest({
        synced: false,
        calendar: { config },
        advance,
      })
    ).toBe(true);
    expect(advance).toHaveBeenCalledExactlyOnceWith(getMsPerDay(config));
  });
  it('does nothing when synced', () => {
    const advance = vi.fn();
    expect(
      advanceLocalCalendarForLongRest({
        synced: true,
        calendar: { config },
        advance,
      })
    ).toBe(false);
    expect(advance).not.toHaveBeenCalled();
  });
  it('does nothing and does not throw without a local calendar', () => {
    const advance = vi.fn();
    for (const calendar of [null, undefined]) {
      expect(
        advanceLocalCalendarForLongRest({ synced: false, calendar, advance })
      ).toBe(false);
    }
    expect(advance).not.toHaveBeenCalled();
  });
});

describe('calendarRestDetails', () => {
  it('adds the calendar line only when the day moved', () => {
    expect(calendarRestDetails(true)).toEqual([CALENDAR_ADVANCED_DETAIL]);
    expect(calendarRestDetails(false)).toEqual([]);
    expect(CALENDAR_ADVANCED_DETAIL).toBe('Calendar advanced by 1 day');
  });
});
