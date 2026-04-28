import { describe, it, expect, beforeEach } from 'vitest';
import { useCalendarStore } from '@/store/calendarStore';
import type { CalendarConfig } from '@/types/calendar';

const CAMPAIGN = 'test-campaign';

const mockConfig: CalendarConfig = {
  clock: {
    hoursPerDay: 24,
    minutesPerHour: 60,
    secondsPerMinute: 60,
  },
  weekDays: [{ name: 'Moonday' }, { name: 'Starday' }],
  months: [
    { name: 'Deepwinter', days: 30 },
    { name: 'Alturiak', days: 30 },
  ],
  seasons: [],
  moons: [],
  namedYears: [],
  eras: [],
  yearOffset: 0,
  yearStartWeekdayOffset: 0,
  mechanics: {
    hoursPerLongRest: 8,
    minutesPerShortRest: 60,
    secondsPerRound: 6,
  },
};

function resetStore() {
  useCalendarStore.setState({ calendars: [] });
}

describe('calendarStore', () => {
  beforeEach(resetStore);

  describe('initCalendar', () => {
    it('creates a calendar for a campaign', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      const cal = useCalendarStore.getState().getCalendar(CAMPAIGN);
      expect(cal).toBeDefined();
      expect(cal!.currentTime).toBe(0);
      expect(cal!.startTime).toBe(0);
      expect(cal!.events).toEqual([]);
    });

    it('does not overwrite existing calendar', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      useCalendarStore.getState().setTime(CAMPAIGN, 1000);
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      expect(
        useCalendarStore.getState().getCalendar(CAMPAIGN)!.currentTime
      ).toBe(1000);
    });
  });

  describe('deleteCalendar', () => {
    it('removes the calendar', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      useCalendarStore.getState().deleteCalendar(CAMPAIGN);
      expect(useCalendarStore.getState().getCalendar(CAMPAIGN)).toBeUndefined();
    });
  });

  describe('updateConfig', () => {
    it('updates calendar config', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      const newConfig: CalendarConfig = {
        ...mockConfig,
        clock: { ...mockConfig.clock, hoursPerDay: 20 },
      };
      useCalendarStore.getState().updateConfig(CAMPAIGN, newConfig);
      expect(
        useCalendarStore.getState().getCalendar(CAMPAIGN)!.config.clock
          .hoursPerDay
      ).toBe(20);
    });
  });

  describe('setTime / advanceTime', () => {
    it('sets absolute time', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      useCalendarStore.getState().setTime(CAMPAIGN, 5000);
      expect(
        useCalendarStore.getState().getCalendar(CAMPAIGN)!.currentTime
      ).toBe(5000);
    });

    it('advances time by delta', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      useCalendarStore.getState().setTime(CAMPAIGN, 1000);
      useCalendarStore.getState().advanceTime(CAMPAIGN, 500);
      expect(
        useCalendarStore.getState().getCalendar(CAMPAIGN)!.currentTime
      ).toBe(1500);
    });
  });

  describe('setStartDate', () => {
    it('sets both startTime and currentTime', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      useCalendarStore.getState().setStartDate(CAMPAIGN, 2000);
      const cal = useCalendarStore.getState().getCalendar(CAMPAIGN)!;
      expect(cal.startTime).toBe(2000);
      expect(cal.currentTime).toBe(2000);
    });
  });

  describe('events', () => {
    beforeEach(() => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
    });

    it('addEvent creates an event with generated ID', () => {
      useCalendarStore.getState().addEvent(CAMPAIGN, {
        title: 'Festival',
        year: 1,
        month: 0,
        day: 15,
        description: 'A party!',
      });
      const cal = useCalendarStore.getState().getCalendar(CAMPAIGN)!;
      expect(cal.events).toHaveLength(1);
      expect(cal.events[0].title).toBe('Festival');
      expect(cal.events[0].id).toMatch(/^evt-/);
    });

    it('updateEvent updates event fields', () => {
      useCalendarStore.getState().addEvent(CAMPAIGN, {
        title: 'Old',
        year: 1,
        month: 0,
        day: 1,
        description: '',
      });
      const evtId = useCalendarStore.getState().getCalendar(CAMPAIGN)!.events[0]
        .id;
      useCalendarStore
        .getState()
        .updateEvent(CAMPAIGN, evtId, { title: 'New' });
      expect(
        useCalendarStore.getState().getCalendar(CAMPAIGN)!.events[0].title
      ).toBe('New');
    });

    it('deleteEvent removes the event', () => {
      useCalendarStore.getState().addEvent(CAMPAIGN, {
        title: 'ToDelete',
        year: 1,
        month: 0,
        day: 1,
        description: '',
      });
      const evtId = useCalendarStore.getState().getCalendar(CAMPAIGN)!.events[0]
        .id;
      useCalendarStore.getState().deleteEvent(CAMPAIGN, evtId);
      expect(
        useCalendarStore.getState().getCalendar(CAMPAIGN)!.events
      ).toHaveLength(0);
    });

    it('getEventsForDay filters by date', () => {
      useCalendarStore.getState().addEvent(CAMPAIGN, {
        title: 'Day 1',
        year: 1,
        month: 0,
        day: 1,
        description: '',
      });
      useCalendarStore.getState().addEvent(CAMPAIGN, {
        title: 'Day 2',
        year: 1,
        month: 0,
        day: 2,
        description: '',
      });
      const events = useCalendarStore
        .getState()
        .getEventsForDay(CAMPAIGN, 1, 0, 1);
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Day 1');
    });
  });

  describe('setWeather', () => {
    it('sets weather on calendar', () => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      useCalendarStore.getState().setWeather(CAMPAIGN, 'rain');
      expect(useCalendarStore.getState().getCalendar(CAMPAIGN)!.weather).toBe(
        'rain'
      );
    });
  });
});
