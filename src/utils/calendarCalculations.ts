import type {
  CalendarConfig,
  CalendarDate,
  MoonPhaseInfo,
  MoonPhaseName,
} from '@/types/calendar';
import { MOON_PHASE_NAMES } from '@/types/calendar';

/**
 * Get the number of seconds in one day for the given clock config.
 */
export function getSecondsPerDay(config: CalendarConfig): number {
  return (
    config.clock.hoursPerDay *
    config.clock.minutesPerHour *
    config.clock.secondsPerMinute
  );
}

/**
 * Get the total number of days in one year.
 */
export function getDaysInYear(config: CalendarConfig): number {
  return config.months.reduce((sum, m) => sum + m.days, 0);
}

/**
 * Get milliseconds per day.
 */
export function getMsPerDay(config: CalendarConfig): number {
  return getSecondsPerDay(config) * 1000;
}

/**
 * Convert a currentTime (ms since epoch) into a CalendarDate.
 */
export function timeToDate(time: number, config: CalendarConfig): CalendarDate {
  const secondsPerDay = getSecondsPerDay(config);
  const totalSeconds = Math.floor(time / 1000);

  // Handle negative time
  const totalDays =
    totalSeconds >= 0
      ? Math.floor(totalSeconds / secondsPerDay)
      : -Math.ceil(Math.abs(totalSeconds) / secondsPerDay);

  const remainderSeconds =
    ((totalSeconds % secondsPerDay) + secondsPerDay) % secondsPerDay;

  const hour = Math.floor(
    remainderSeconds /
      (config.clock.minutesPerHour * config.clock.secondsPerMinute)
  );
  const minuteSeconds =
    remainderSeconds %
    (config.clock.minutesPerHour * config.clock.secondsPerMinute);
  const minute = Math.floor(minuteSeconds / config.clock.secondsPerMinute);
  const second = minuteSeconds % config.clock.secondsPerMinute;

  const daysInYear = getDaysInYear(config);

  // Handle negative days
  let year: number;
  let dayOfYear: number;
  if (totalDays >= 0) {
    year = Math.floor(totalDays / daysInYear);
    dayOfYear = totalDays % daysInYear;
  } else {
    year = -Math.ceil(Math.abs(totalDays) / daysInYear);
    dayOfYear = ((totalDays % daysInYear) + daysInYear) % daysInYear;
  }

  // Walk months to find month index + day of month
  let monthIndex = 0;
  let remaining = dayOfYear;
  for (let i = 0; i < config.months.length; i++) {
    if (remaining < config.months[i].days) {
      monthIndex = i;
      break;
    }
    remaining -= config.months[i].days;
  }
  const dayOfMonth = remaining;

  // Day of week
  const dayOfWeek =
    ((totalDays % config.weekDays.length) +
      config.yearStartWeekdayOffset +
      // Extra modulo to handle negatives
      config.weekDays.length * 1000) %
    config.weekDays.length;

  const displayYear = year + config.yearOffset;

  // Look up era
  const era = config.eras.find(
    e =>
      displayYear >= e.startYear &&
      (e.endYear === undefined || displayYear <= e.endYear)
  );

  // Look up season
  const season = config.seasons.find(
    s => dayOfYear >= s.startDay && dayOfYear <= s.endDay
  );

  // Look up named year
  const namedYear = config.namedYears.find(ny => ny.year === displayYear);

  return {
    year: displayYear,
    month: monthIndex,
    dayOfMonth,
    dayOfYear,
    dayOfWeek,
    hour,
    minute,
    second,
    totalDays,
    era,
    season,
    yearName: namedYear?.name,
  };
}

/**
 * Convert a CalendarDate back to milliseconds since epoch.
 * Only uses year, month, dayOfMonth, hour, minute, second.
 */
export function dateToTime(
  date: Pick<
    CalendarDate,
    'year' | 'month' | 'dayOfMonth' | 'hour' | 'minute' | 'second'
  >,
  config: CalendarConfig
): number {
  const rawYear = date.year - config.yearOffset;
  const daysInYear = getDaysInYear(config);

  let dayOfYear = 0;
  for (let i = 0; i < date.month; i++) {
    dayOfYear += config.months[i].days;
  }
  dayOfYear += date.dayOfMonth;

  const totalDays = rawYear * daysInYear + dayOfYear;
  const secondsPerDay = getSecondsPerDay(config);
  const timeOfDaySeconds =
    date.hour * config.clock.minutesPerHour * config.clock.secondsPerMinute +
    date.minute * config.clock.secondsPerMinute +
    date.second;

  return (totalDays * secondsPerDay + timeOfDaySeconds) * 1000;
}

/**
 * Get moon phase for a given total day count.
 */
export function getMoonPhase(
  totalDays: number,
  moon: CalendarConfig['moons'][number]
): MoonPhaseInfo {
  const dayOfPeriod =
    (((totalDays - moon.phaseOffset) % moon.period) + moon.period) %
    moon.period;
  const phaseIndex = Math.floor((dayOfPeriod / moon.period) * 8) % 8;

  return {
    moon,
    phase: MOON_PHASE_NAMES[phaseIndex] as MoonPhaseName,
    phaseIndex,
  };
}

/**
 * Get all moon phases for a given day.
 */
export function getAllMoonPhases(
  totalDays: number,
  config: CalendarConfig
): MoonPhaseInfo[] {
  return config.moons.map(moon => getMoonPhase(totalDays, moon));
}

/**
 * Add time to current time and return new time.
 */
export function addTime(
  currentTime: number,
  config: CalendarConfig,
  delta: {
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    rounds?: number;
  }
): number {
  const { clock, mechanics } = config;
  const secondsPerMinute = clock.secondsPerMinute;
  const secondsPerHour = clock.minutesPerHour * secondsPerMinute;
  const secondsPerDay = clock.hoursPerDay * secondsPerHour;

  let totalDeltaSeconds = 0;
  if (delta.days) totalDeltaSeconds += delta.days * secondsPerDay;
  if (delta.hours) totalDeltaSeconds += delta.hours * secondsPerHour;
  if (delta.minutes) totalDeltaSeconds += delta.minutes * secondsPerMinute;
  if (delta.seconds) totalDeltaSeconds += delta.seconds;
  if (delta.rounds)
    totalDeltaSeconds += delta.rounds * mechanics.secondsPerRound;

  return currentTime + totalDeltaSeconds * 1000;
}

/**
 * Get short rest duration in ms.
 */
export function getShortRestMs(config: CalendarConfig): number {
  return (
    config.mechanics.minutesPerShortRest * config.clock.secondsPerMinute * 1000
  );
}

/**
 * Get long rest duration in ms.
 */
export function getLongRestMs(config: CalendarConfig): number {
  return (
    config.mechanics.hoursPerLongRest *
    config.clock.minutesPerHour *
    config.clock.secondsPerMinute *
    1000
  );
}

/**
 * Format a CalendarDate as a readable string.
 */
export function formatDate(date: CalendarDate, config: CalendarConfig): string {
  const monthName =
    config.months[date.month]?.name ?? `Month ${date.month + 1}`;
  const dayDisplay = date.dayOfMonth + 1; // 1-based for display
  return `${dayDisplay} ${monthName}, Year ${date.year}`;
}

/**
 * Format time as HH:MM.
 */
export function formatTime(date: CalendarDate): string {
  const h = String(date.hour).padStart(2, '0');
  const m = String(date.minute).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Get day period label based on hour and season.
 */
export function getDayPeriod(
  date: CalendarDate,
  config: CalendarConfig
): string {
  const season = date.season;
  const sunrise =
    season?.sunriseHour ?? Math.floor(config.clock.hoursPerDay * 0.25);
  const sunset =
    season?.sunsetHour ?? Math.floor(config.clock.hoursPerDay * 0.75);
  const midday = Math.floor((sunrise + sunset) / 2);

  if (date.hour < sunrise) return 'Night';
  if (date.hour < midday) return 'Morning';
  if (date.hour < sunset) return 'Afternoon';
  return 'Evening';
}

/**
 * Build a month grid (for calendar display).
 * Returns an array of weeks, each week is an array of day numbers (or null for empty cells).
 * Day numbers are 0-based day-of-month.
 */
export function getMonthGrid(
  year: number,
  monthIndex: number,
  config: CalendarConfig
): (number | null)[][] {
  const rawYear = year - config.yearOffset;
  const daysInYear = getDaysInYear(config);

  // Calculate the total days at the start of this month
  let dayOfYearStart = 0;
  for (let i = 0; i < monthIndex; i++) {
    dayOfYearStart += config.months[i].days;
  }
  const totalDaysAtMonthStart = rawYear * daysInYear + dayOfYearStart;

  // What weekday does this month start on?
  const startWeekday =
    ((totalDaysAtMonthStart % config.weekDays.length) +
      config.yearStartWeekdayOffset +
      config.weekDays.length * 1000) %
    config.weekDays.length;

  const daysInMonth = config.months[monthIndex].days;
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];

  // Fill leading nulls
  for (let i = 0; i < startWeekday; i++) {
    currentWeek.push(null);
  }

  for (let day = 0; day < daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === config.weekDays.length) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Fill trailing nulls
  if (currentWeek.length > 0) {
    while (currentWeek.length < config.weekDays.length) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

/**
 * Get the total days value for a specific day in a month (for moon phase lookups).
 */
export function getTotalDaysForDate(
  year: number,
  monthIndex: number,
  dayOfMonth: number,
  config: CalendarConfig
): number {
  const rawYear = year - config.yearOffset;
  const daysInYear = getDaysInYear(config);
  let dayOfYear = 0;
  for (let i = 0; i < monthIndex; i++) {
    dayOfYear += config.months[i].days;
  }
  dayOfYear += dayOfMonth;
  return rawYear * daysInYear + dayOfYear;
}
