import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { isIndexedDbMigrationEnabled } from '@/lib/indexeddb/persistenceBootstrap';
import { createSafeStorage } from '@/lib/safeStorage';
import { createCalendarAwareStorage } from '@/lib/durableDm/calendarAwareStorage';
import type {
  CalendarConfig,
  CalendarEvent,
  CampaignCalendar,
  WeatherType,
} from '@/types/calendar';
import {
  isSameEventDay,
  moveEventWithinDay,
  nextSortOrderForDay,
  sortEventsWithinDay,
  type EventMoveDirection,
} from '@/utils/calendarEventOrder';

const CALENDAR_STORAGE_KEY = 'rollkeeper-calendar-data';

function generateEventId(): string {
  return `evt-${crypto.randomUUID()}`;
}

interface CalendarStoreState {
  calendars: CampaignCalendar[];
  initCalendar: (campaignCode: string, config: CalendarConfig) => void;
  getCalendar: (campaignCode: string) => CampaignCalendar | undefined;
  deleteCalendar: (campaignCode: string) => void;
  updateConfig: (campaignCode: string, config: CalendarConfig) => void;
  setTime: (campaignCode: string, time: number) => void;
  setStartDate: (campaignCode: string, time: number) => void;
  advanceTime: (campaignCode: string, deltaMs: number) => void;
  addEvent: (
    campaignCode: string,
    event: Omit<CalendarEvent, 'id' | 'createdAt'>
  ) => void;
  updateEvent: (
    campaignCode: string,
    eventId: string,
    updates: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>
  ) => void;
  deleteEvent: (campaignCode: string, eventId: string) => void;
  moveEvent: (
    campaignCode: string,
    eventId: string,
    direction: EventMoveDirection
  ) => void;
  setWeather: (campaignCode: string, weather: WeatherType) => void;
  getEventsForDay: (
    campaignCode: string,
    year: number,
    month: number,
    day: number
  ) => CalendarEvent[];
}

export const useCalendarStore = create<CalendarStoreState>()(
  persist(
    (set, get) => ({
      calendars: [],

      initCalendar: (campaignCode, config) => {
        set(state => {
          // Don't overwrite existing calendar
          if (state.calendars.some(c => c.campaignCode === campaignCode)) {
            return state;
          }
          return {
            calendars: [
              ...state.calendars,
              {
                campaignCode,
                config,
                currentTime: 0,
                startTime: 0,
                events: [],
              },
            ],
          };
        });
      },

      getCalendar: campaignCode => {
        return get().calendars.find(c => c.campaignCode === campaignCode);
      },

      deleteCalendar: campaignCode => {
        set(state => ({
          calendars: state.calendars.filter(
            c => c.campaignCode !== campaignCode
          ),
        }));
      },

      updateConfig: (campaignCode, config) => {
        set(state => ({
          calendars: state.calendars.map(c =>
            c.campaignCode === campaignCode ? { ...c, config } : c
          ),
        }));
      },

      setTime: (campaignCode, time) => {
        set(state => ({
          calendars: state.calendars.map(c =>
            c.campaignCode === campaignCode ? { ...c, currentTime: time } : c
          ),
        }));
      },

      setStartDate: (campaignCode, time) => {
        set(state => ({
          calendars: state.calendars.map(c =>
            c.campaignCode === campaignCode
              ? { ...c, startTime: time, currentTime: time }
              : c
          ),
        }));
      },

      advanceTime: (campaignCode, deltaMs) => {
        set(state => ({
          calendars: state.calendars.map(c =>
            c.campaignCode === campaignCode
              ? { ...c, currentTime: c.currentTime + deltaMs }
              : c
          ),
        }));
      },

      addEvent: (campaignCode, event) => {
        set(state => ({
          calendars: state.calendars.map(c => {
            if (c.campaignCode !== campaignCode) return c;
            const events = c.events ?? [];
            const { sortOrder: _ignored, ...input } = event;
            void _ignored;
            const sortOrder = nextSortOrderForDay(events, event);
            const newEvent: CalendarEvent = {
              ...input,
              ...(sortOrder === undefined ? {} : { sortOrder }),
              id: generateEventId(),
              createdAt: Date.now(),
            };
            return { ...c, events: [...events, newEvent] };
          }),
        }));
      },

      updateEvent: (campaignCode, eventId, updates) => {
        set(state => ({
          calendars: state.calendars.map(c => {
            if (c.campaignCode !== campaignCode) return c;
            const events = c.events ?? [];
            return {
              ...c,
              events: events.map(e => {
                if (e.id !== eventId) return e;
                const updated = { ...e, ...updates };
                if (isSameEventDay(e, updated)) return updated;
                // Moved to another day: append after that day's events.
                const { sortOrder: _previous, ...rest } = updated;
                void _previous;
                const sortOrder = nextSortOrderForDay(events, updated, e.id);
                return sortOrder === undefined ? rest : { ...rest, sortOrder };
              }),
            };
          }),
        }));
      },

      moveEvent: (campaignCode, eventId, direction) => {
        set(state => ({
          calendars: state.calendars.map(c =>
            c.campaignCode === campaignCode
              ? {
                  ...c,
                  events: moveEventWithinDay(
                    c.events ?? [],
                    eventId,
                    direction
                  ),
                }
              : c
          ),
        }));
      },

      deleteEvent: (campaignCode, eventId) => {
        set(state => ({
          calendars: state.calendars.map(c =>
            c.campaignCode === campaignCode
              ? { ...c, events: (c.events ?? []).filter(e => e.id !== eventId) }
              : c
          ),
        }));
      },

      setWeather: (campaignCode, weather) => {
        set(state => ({
          calendars: state.calendars.map(c =>
            c.campaignCode === campaignCode ? { ...c, weather } : c
          ),
        }));
      },

      getEventsForDay: (campaignCode, year, month, day) => {
        const calendar = get().calendars.find(
          c => c.campaignCode === campaignCode
        );
        if (!calendar) return [];
        return sortEventsWithinDay(
          (calendar.events ?? []).filter(e =>
            isSameEventDay(e, { year, month, day })
          )
        );
      },
    }),
    {
      name: CALENDAR_STORAGE_KEY,
      skipHydration: isIndexedDbMigrationEnabled(),
      storage: createJSONStorage(() =>
        typeof localStorage === 'undefined'
          ? createSafeStorage()
          : createCalendarAwareStorage(localStorage)
      ),
      version: 3,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as CalendarStoreState;
        let calendars = state.calendars ?? [];
        if (version < 2) {
          calendars = calendars.map((c: CampaignCalendar) => ({
            ...c,
            events: c.events ?? [],
          }));
        }
        if (version < 3) {
          calendars = calendars.map((c: CampaignCalendar) => ({
            ...c,
            startTime: c.startTime ?? 0,
          }));
        }
        return { ...state, calendars };
      },
    }
  )
);

export default useCalendarStore;
