import type { CalendarConfig } from '@/types/calendar';

/**
 * Default calendar: 7-day week, 12 months × 30 days, 4 seasons, 1 moon.
 */
export function createDefaultCalendar(): CalendarConfig {
  return {
    clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
    weekDays: [
      { name: 'Sunday' },
      { name: 'Monday' },
      { name: 'Tuesday' },
      { name: 'Wednesday' },
      { name: 'Thursday' },
      { name: 'Friday' },
      { name: 'Saturday' },
    ],
    months: [
      { name: 'January', days: 30 },
      { name: 'February', days: 30 },
      { name: 'March', days: 30 },
      { name: 'April', days: 30 },
      { name: 'May', days: 30 },
      { name: 'June', days: 30 },
      { name: 'July', days: 30 },
      { name: 'August', days: 30 },
      { name: 'September', days: 30 },
      { name: 'October', days: 30 },
      { name: 'November', days: 30 },
      { name: 'December', days: 30 },
    ],
    seasons: [
      {
        name: 'Spring',
        startDay: 0,
        endDay: 89,
        sunriseHour: 6,
        sunsetHour: 19,
      },
      {
        name: 'Summer',
        startDay: 90,
        endDay: 179,
        sunriseHour: 5,
        sunsetHour: 21,
      },
      {
        name: 'Autumn',
        startDay: 180,
        endDay: 269,
        sunriseHour: 6,
        sunsetHour: 19,
      },
      {
        name: 'Winter',
        startDay: 270,
        endDay: 359,
        sunriseHour: 7,
        sunsetHour: 17,
      },
    ],
    moons: [{ name: 'Moon', color: '#C0C0C0', phaseOffset: 0, period: 28 }],
    namedYears: [],
    eras: [{ name: 'Common Era', abbreviation: 'CE', startYear: 1 }],
    yearOffset: 1,
    yearStartWeekdayOffset: 0,
    mechanics: {
      hoursPerLongRest: 8,
      minutesPerShortRest: 60,
      secondsPerRound: 6,
    },
  };
}

/**
 * Harptos calendar (Forgotten Realms / Faerûn).
 * 12 months of 30 days each = 360 days + 5 intercalary holidays.
 * We model holidays as single-day months for simplicity.
 */
export function createHarptosCalendar(): CalendarConfig {
  return {
    clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
    weekDays: [
      { name: '1st day' },
      { name: '2nd day' },
      { name: '3rd day' },
      { name: '4th day' },
      { name: '5th day' },
      { name: '6th day' },
      { name: '7th day' },
      { name: '8th day' },
      { name: '9th day' },
      { name: '10th day' },
    ],
    months: [
      { name: 'Hammer', days: 30 },
      { name: 'Midwinter', days: 1 },
      { name: 'Alturiak', days: 30 },
      { name: 'Ches', days: 30 },
      { name: 'Tarsakh', days: 30 },
      { name: 'Greengrass', days: 1 },
      { name: 'Mirtul', days: 30 },
      { name: 'Kythorn', days: 30 },
      { name: 'Flamerule', days: 30 },
      { name: 'Midsummer', days: 1 },
      { name: 'Eleasis', days: 30 },
      { name: 'Eleint', days: 30 },
      { name: 'Highharvestide', days: 1 },
      { name: 'Marpenoth', days: 30 },
      { name: 'Uktar', days: 30 },
      { name: 'Feast of the Moon', days: 1 },
      { name: 'Nightal', days: 30 },
    ],
    seasons: [
      {
        name: 'Winter',
        startDay: 0,
        endDay: 90,
        sunriseHour: 7,
        sunsetHour: 17,
      },
      {
        name: 'Spring',
        startDay: 91,
        endDay: 181,
        sunriseHour: 6,
        sunsetHour: 19,
      },
      {
        name: 'Summer',
        startDay: 182,
        endDay: 272,
        sunriseHour: 5,
        sunsetHour: 21,
      },
      {
        name: 'Autumn',
        startDay: 273,
        endDay: 364,
        sunriseHour: 6,
        sunsetHour: 18,
      },
    ],
    moons: [{ name: 'Selûne', color: '#E8E8F0', phaseOffset: 0, period: 30 }],
    namedYears: [],
    eras: [{ name: 'Dalereckoning', abbreviation: 'DR', startYear: 1 }],
    yearOffset: 1490,
    yearStartWeekdayOffset: 0,
    mechanics: {
      hoursPerLongRest: 8,
      minutesPerShortRest: 60,
      secondsPerRound: 6,
    },
  };
}

/**
 * Greyhawk calendar (Oerth).
 * 12 months of 28 days + 4 festival weeks (7 days each) = 364 days.
 * Festival weeks modeled as single-week months.
 */
export function createGreyhawkCalendar(): CalendarConfig {
  return {
    clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
    weekDays: [
      { name: 'Starday' },
      { name: 'Sunday' },
      { name: 'Moonday' },
      { name: 'Godsday' },
      { name: 'Waterday' },
      { name: 'Earthday' },
      { name: 'Freeday' },
    ],
    months: [
      { name: 'Needfest', days: 7 },
      { name: 'Fireseek', days: 28 },
      { name: 'Readying', days: 28 },
      { name: 'Coldeven', days: 28 },
      { name: 'Growfest', days: 7 },
      { name: 'Planting', days: 28 },
      { name: 'Flocktime', days: 28 },
      { name: 'Wealsun', days: 28 },
      { name: 'Richfest', days: 7 },
      { name: 'Reaping', days: 28 },
      { name: 'Goodmonth', days: 28 },
      { name: 'Harvester', days: 28 },
      { name: 'Brewfest', days: 7 },
      { name: 'Patchwall', days: 28 },
      { name: "Ready'reat", days: 28 },
      { name: 'Sunsebb', days: 28 },
    ],
    seasons: [
      {
        name: 'Winter',
        startDay: 0,
        endDay: 90,
        sunriseHour: 7,
        sunsetHour: 17,
      },
      {
        name: 'Spring',
        startDay: 91,
        endDay: 181,
        sunriseHour: 6,
        sunsetHour: 19,
      },
      {
        name: 'Summer',
        startDay: 182,
        endDay: 272,
        sunriseHour: 5,
        sunsetHour: 21,
      },
      {
        name: 'Autumn',
        startDay: 273,
        endDay: 363,
        sunriseHour: 6,
        sunsetHour: 18,
      },
    ],
    moons: [
      { name: 'Luna', color: '#F5F5DC', phaseOffset: 0, period: 28 },
      { name: 'Celene', color: '#98D8C8', phaseOffset: 0, period: 91 },
    ],
    namedYears: [],
    eras: [{ name: 'Common Year', abbreviation: 'CY', startYear: 1 }],
    yearOffset: 591,
    yearStartWeekdayOffset: 0,
    mechanics: {
      hoursPerLongRest: 8,
      minutesPerShortRest: 60,
      secondsPerRound: 6,
    },
  };
}

export const CALENDAR_PRESETS = [
  { id: 'default', name: 'Default (Simple)', create: createDefaultCalendar },
  {
    id: 'harptos',
    name: 'Harptos (Forgotten Realms)',
    create: createHarptosCalendar,
  },
  { id: 'greyhawk', name: 'Greyhawk (Oerth)', create: createGreyhawkCalendar },
] as const;
