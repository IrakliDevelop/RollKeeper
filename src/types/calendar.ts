// Calendar system types for D&D campaign time tracking

export interface ClockConfig {
  hoursPerDay: number;
  minutesPerHour: number;
  secondsPerMinute: number;
}

export interface WeekDay {
  name: string;
}

export interface CalendarMonth {
  name: string;
  days: number;
}

export interface Season {
  name: string;
  startDay: number; // day-of-year (0-based)
  endDay: number; // day-of-year (0-based, inclusive)
  sunriseHour: number;
  sunsetHour: number;
}

export interface Moon {
  name: string;
  color: string; // CSS color
  phaseOffset: number; // offset in days from epoch
  period: number; // days per full cycle
}

export interface NamedYear {
  year: number; // display year (after yearOffset)
  name: string;
}

export interface Era {
  name: string;
  abbreviation: string;
  startYear: number; // display year
  endYear?: number; // undefined = ongoing
}

export interface MechanicsConfig {
  hoursPerLongRest: number;
  minutesPerShortRest: number;
  secondsPerRound: number;
}

export interface CalendarConfig {
  clock: ClockConfig;
  weekDays: WeekDay[];
  months: CalendarMonth[];
  seasons: Season[];
  moons: Moon[];
  namedYears: NamedYear[];
  eras: Era[];
  yearOffset: number; // added to raw year for display
  yearStartWeekdayOffset: number; // which weekday index year 0 day 0 falls on
  mechanics: MechanicsConfig;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string; // HTML from RichTextEditor
  year: number; // display year (with offset applied)
  month: number; // 0-based month index
  day: number; // 0-based day of month
  createdAt: number; // timestamp for ordering
}

export type WeatherType =
  | 'clear'
  | 'cloudy'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'heavy-rain'
  | 'thunderstorm'
  | 'snow'
  | 'blizzard'
  | 'hail'
  | 'wind'
  | 'hot'
  | 'cold';

export const WEATHER_OPTIONS: {
  type: WeatherType;
  label: string;
  icon: string;
}[] = [
  { type: 'clear', label: 'Clear', icon: '☀️' },
  { type: 'cloudy', label: 'Cloudy', icon: '⛅' },
  { type: 'overcast', label: 'Overcast', icon: '☁️' },
  { type: 'fog', label: 'Fog', icon: '🌫️' },
  { type: 'rain', label: 'Rain', icon: '🌧️' },
  { type: 'heavy-rain', label: 'Heavy Rain', icon: '🌧️' },
  { type: 'thunderstorm', label: 'Thunderstorm', icon: '⛈️' },
  { type: 'snow', label: 'Snow', icon: '🌨️' },
  { type: 'blizzard', label: 'Blizzard', icon: '❄️' },
  { type: 'hail', label: 'Hail', icon: '🧊' },
  { type: 'wind', label: 'Windy', icon: '💨' },
  { type: 'hot', label: 'Hot', icon: '🔥' },
  { type: 'cold', label: 'Cold', icon: '🥶' },
];

export interface CampaignCalendar {
  campaignCode: string;
  config: CalendarConfig;
  currentTime: number; // milliseconds since epoch
  startTime: number; // milliseconds since epoch — campaign start reference
  events: CalendarEvent[];
  weather?: WeatherType;
}

// Derived from currentTime + config — never stored
export interface CalendarDate {
  year: number; // display year (with offset)
  month: number; // 0-based index into config.months
  dayOfMonth: number; // 0-based
  dayOfYear: number; // 0-based
  dayOfWeek: number; // 0-based index into config.weekDays
  hour: number;
  minute: number;
  second: number;
  totalDays: number; // days since epoch
  era?: Era;
  season?: Season;
  yearName?: string;
}

export type MoonPhaseName =
  | 'new-moon'
  | 'waxing-crescent'
  | 'first-quarter'
  | 'waxing-gibbous'
  | 'full-moon'
  | 'waning-gibbous'
  | 'last-quarter'
  | 'waning-crescent';

export const MOON_PHASE_NAMES: MoonPhaseName[] = [
  'new-moon',
  'waxing-crescent',
  'first-quarter',
  'waxing-gibbous',
  'full-moon',
  'waning-gibbous',
  'last-quarter',
  'waning-crescent',
];

export const MOON_PHASE_LABELS: Record<MoonPhaseName, string> = {
  'new-moon': 'New Moon',
  'waxing-crescent': 'Waxing Crescent',
  'first-quarter': 'First Quarter',
  'waxing-gibbous': 'Waxing Gibbous',
  'full-moon': 'Full Moon',
  'waning-gibbous': 'Waning Gibbous',
  'last-quarter': 'Last Quarter',
  'waning-crescent': 'Waning Crescent',
};

export interface MoonPhaseInfo {
  moon: Moon;
  phase: MoonPhaseName;
  phaseIndex: number; // 0-7
}
