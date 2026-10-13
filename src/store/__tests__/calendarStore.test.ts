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

  describe('event ordering', () => {
    const day = { year: 1, month: 0, day: 3 };

    function addDayEvent(title: string, at = day) {
      useCalendarStore
        .getState()
        .addEvent(CAMPAIGN, { title, description: '', ...at });
    }

    function titlesFor(at = day) {
      return useCalendarStore
        .getState()
        .getEventsForDay(CAMPAIGN, at.year, at.month, at.day)
        .map(e => e.title);
    }

    function idOf(title: string) {
      return useCalendarStore
        .getState()
        .getCalendar(CAMPAIGN)!
        .events.find(e => e.title === title)!.id;
    }

    beforeEach(() => {
      useCalendarStore.getState().initCalendar(CAMPAIGN, mockConfig);
      addDayEvent('Evening feast');
      addDayEvent('Morning ambush');
      addDayEvent('Midday council');
    });

    it('lists unarranged events in creation order without sortOrder', () => {
      expect(titlesFor()).toEqual([
        'Evening feast',
        'Morning ambush',
        'Midday council',
      ]);
      const events = useCalendarStore.getState().getCalendar(CAMPAIGN)!.events;
      expect(events.every(e => e.sortOrder === undefined)).toBe(true);
    });

    it('moveEvent rearranges events within the day', () => {
      const store = useCalendarStore.getState();
      store.moveEvent(CAMPAIGN, idOf('Morning ambush'), 'up');
      store.moveEvent(CAMPAIGN, idOf('Evening feast'), 'down');
      store.moveEvent(CAMPAIGN, idOf('Evening feast'), 'down');
      expect(titlesFor()).toEqual([
        'Morning ambush',
        'Midday council',
        'Evening feast',
      ]);
    });

    it('appends new events after an arranged day', () => {
      useCalendarStore
        .getState()
        .moveEvent(CAMPAIGN, idOf('Morning ambush'), 'up');
      addDayEvent('Midnight heist');
      expect(titlesFor().at(-1)).toBe('Midnight heist');
    });

    it('ignores a caller-supplied sortOrder on add', () => {
      useCalendarStore.getState().addEvent(CAMPAIGN, {
        title: 'Sneaky',
        description: '',
        sortOrder: -5,
        ...day,
      });
      const sneaky = useCalendarStore
        .getState()
        .getCalendar(CAMPAIGN)!
        .events.find(e => e.title === 'Sneaky')!;
      expect(sneaky.sortOrder).toBeUndefined();
      expect(titlesFor().at(-1)).toBe('Sneaky');
    });

    it('keeps position when an event is edited on the same day', () => {
      const store = useCalendarStore.getState();
      store.moveEvent(CAMPAIGN, idOf('Midday council'), 'up');
      store.updateEvent(CAMPAIGN, idOf('Midday council'), {
        title: 'Midday council (renamed)',
        ...day,
      });
      expect(titlesFor()).toEqual([
        'Evening feast',
        'Midday council (renamed)',
        'Morning ambush',
      ]);
    });

    it('moves an event to the end of an arranged target day', () => {
      const otherDay = { year: 1, month: 0, day: 4 };
      addDayEvent('Dawn patrol', otherDay);
      addDayEvent('Dusk patrol', otherDay);
      const store = useCalendarStore.getState();
      store.moveEvent(CAMPAIGN, idOf('Dusk patrol'), 'up');
      store.moveEvent(CAMPAIGN, idOf('Morning ambush'), 'up');

      store.updateEvent(CAMPAIGN, idOf('Morning ambush'), otherDay);
      expect(titlesFor(otherDay)).toEqual([
        'Dusk patrol',
        'Dawn patrol',
        'Morning ambush',
      ]);
    });

    it('drops sortOrder when moving to a never-arranged day', () => {
      const store = useCalendarStore.getState();
      store.moveEvent(CAMPAIGN, idOf('Morning ambush'), 'up');
      store.updateEvent(CAMPAIGN, idOf('Morning ambush'), {
        year: 1,
        month: 1,
        day: 0,
      });
      const moved = useCalendarStore
        .getState()
        .getCalendar(CAMPAIGN)!
        .events.find(e => e.title === 'Morning ambush')!;
      expect(moved).not.toHaveProperty('sortOrder');
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
