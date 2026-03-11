import { useMemo } from 'react';
import { useCalendarStore } from '@/store/calendarStore';
import {
  timeToDate,
  getAllMoonPhases,
  getDayPeriod,
  formatDate,
  formatTime,
} from '@/utils/calendarCalculations';
import type { CalendarDate, MoonPhaseInfo } from '@/types/calendar';

interface UseCalendarResult {
  exists: boolean;
  date: CalendarDate | null;
  moonPhases: MoonPhaseInfo[];
  dayPeriod: string;
  formattedDate: string;
  formattedTime: string;
}

export function useCalendar(campaignCode: string): UseCalendarResult {
  const calendar = useCalendarStore(state =>
    state.calendars.find(c => c.campaignCode === campaignCode)
  );

  const date = useMemo(() => {
    if (!calendar) return null;
    return timeToDate(calendar.currentTime, calendar.config);
  }, [calendar]);

  const moonPhases = useMemo(() => {
    if (!date || !calendar) return [];
    return getAllMoonPhases(date.totalDays, calendar.config);
  }, [date, calendar]);

  const dayPeriod = useMemo(() => {
    if (!date || !calendar) return '';
    return getDayPeriod(date, calendar.config);
  }, [date, calendar]);

  const formattedDate = useMemo(() => {
    if (!date || !calendar) return '';
    return formatDate(date, calendar.config);
  }, [date, calendar]);

  const formattedTime = useMemo(() => {
    if (!date) return '';
    return formatTime(date);
  }, [date]);

  return {
    exists: !!calendar,
    date,
    moonPhases,
    dayPeriod,
    formattedDate,
    formattedTime,
  };
}
