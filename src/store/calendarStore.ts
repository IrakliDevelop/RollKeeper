import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CalendarConfig,
  CalendarEvent,
  CampaignCalendar,
} from '@/types/calendar';

const CALENDAR_STORAGE_KEY = 'rollkeeper-calendar-data';

function generateEventId(): string {
  return (
    'evt-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  );
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
        const newEvent: CalendarEvent = {
          ...event,
          id: generateEventId(),
          createdAt: Date.now(),
        };
        set(state => ({
          calendars: state.calendars.map(c =>
            c.campaignCode === campaignCode
              ? { ...c, events: [...(c.events ?? []), newEvent] }
              : c
          ),
        }));
      },

      updateEvent: (campaignCode, eventId, updates) => {
        set(state => ({
          calendars: state.calendars.map(c =>
            c.campaignCode === campaignCode
              ? {
                  ...c,
                  events: (c.events ?? []).map(e =>
                    e.id === eventId ? { ...e, ...updates } : e
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

      getEventsForDay: (campaignCode, year, month, day) => {
        const calendar = get().calendars.find(
          c => c.campaignCode === campaignCode
        );
        if (!calendar) return [];
        return (calendar.events ?? [])
          .filter(e => e.year === year && e.month === month && e.day === day)
          .sort((a, b) => a.createdAt - b.createdAt);
      },
    }),
    {
      name: CALENDAR_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
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
