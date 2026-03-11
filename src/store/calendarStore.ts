import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CalendarConfig, CampaignCalendar } from '@/types/calendar';

const CALENDAR_STORAGE_KEY = 'rollkeeper-calendar-data';

interface CalendarStoreState {
  calendars: CampaignCalendar[];
  initCalendar: (campaignCode: string, config: CalendarConfig) => void;
  getCalendar: (campaignCode: string) => CampaignCalendar | undefined;
  deleteCalendar: (campaignCode: string) => void;
  updateConfig: (campaignCode: string, config: CalendarConfig) => void;
  setTime: (campaignCode: string, time: number) => void;
  advanceTime: (campaignCode: string, deltaMs: number) => void;
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
              { campaignCode, config, currentTime: 0 },
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

      advanceTime: (campaignCode, deltaMs) => {
        set(state => ({
          calendars: state.calendars.map(c =>
            c.campaignCode === campaignCode
              ? { ...c, currentTime: c.currentTime + deltaMs }
              : c
          ),
        }));
      },
    }),
    {
      name: CALENDAR_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

export default useCalendarStore;
