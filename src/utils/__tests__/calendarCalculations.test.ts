import { describe, it, expect } from 'vitest';
import {
  timeToDate,
  dateToTime,
  getMoonPhase,
  getMonthGrid,
  addTime,
  getSecondsPerDay,
  getDaysInYear,
  getMsPerDay,
  getShortRestMs,
  getLongRestMs,
  getAllMoonPhases,
  formatDate,
  formatTime,
  getDayPeriod,
  getTotalDaysForDate,
} from '@/utils/calendarCalculations';
import {
  createDefaultCalendar,
  createHarptosCalendar,
  createGreyhawkCalendar,
} from '@/utils/calendarPresets';

const defaultConfig = createDefaultCalendar();

// ── Basic helpers ───────────────────────────────────────────────

describe('getSecondsPerDay', () => {
  it('calculates correctly for default config', () => {
    expect(getSecondsPerDay(defaultConfig)).toBe(86400);
  });

  it('works with non-standard clock', () => {
    const custom = {
      ...defaultConfig,
      clock: { hoursPerDay: 10, minutesPerHour: 100, secondsPerMinute: 100 },
    };
    expect(getSecondsPerDay(custom)).toBe(10 * 100 * 100);
  });
});

describe('getDaysInYear', () => {
  it('calculates correctly for default config (12 × 30)', () => {
    expect(getDaysInYear(defaultConfig)).toBe(360);
  });

  it('calculates correctly for Harptos (360 + 5 holidays)', () => {
    const harptos = createHarptosCalendar();
    expect(getDaysInYear(harptos)).toBe(365);
  });

  it('calculates correctly for Greyhawk', () => {
    const greyhawk = createGreyhawkCalendar();
    // 12 × 28 + 4 × 7 = 336 + 28 = 364
    expect(getDaysInYear(greyhawk)).toBe(364);
  });
});

describe('getMsPerDay', () => {
  it('returns seconds per day × 1000', () => {
    expect(getMsPerDay(defaultConfig)).toBe(86400 * 1000);
  });
});

// ── timeToDate ──────────────────────────────────────────────────

describe('timeToDate', () => {
  it('converts time=0 to day 0 of year with offset', () => {
    const date = timeToDate(0, defaultConfig);
    expect(date.year).toBe(1); // yearOffset = 1
    expect(date.month).toBe(0);
    expect(date.dayOfMonth).toBe(0);
    expect(date.hour).toBe(0);
    expect(date.minute).toBe(0);
    expect(date.second).toBe(0);
    expect(date.totalDays).toBe(0);
  });

  it('converts one full day of ms to day 1', () => {
    const oneDayMs = 86400 * 1000;
    const date = timeToDate(oneDayMs, defaultConfig);
    expect(date.totalDays).toBe(1);
    expect(date.dayOfMonth).toBe(1);
    expect(date.hour).toBe(0);
  });

  it('computes hour/minute/second from remainder', () => {
    const ms = (2 * 3600 + 30 * 60 + 15) * 1000;
    const date = timeToDate(ms, defaultConfig);
    expect(date.hour).toBe(2);
    expect(date.minute).toBe(30);
    expect(date.second).toBe(15);
    expect(date.totalDays).toBe(0);
  });

  it('rolls over to next month after 30 days', () => {
    const ms = 30 * 86400 * 1000;
    const date = timeToDate(ms, defaultConfig);
    expect(date.month).toBe(1);
    expect(date.dayOfMonth).toBe(0);
  });

  it('rolls over to next year after 360 days', () => {
    const ms = 360 * 86400 * 1000;
    const date = timeToDate(ms, defaultConfig);
    expect(date.year).toBe(2);
    expect(date.month).toBe(0);
    expect(date.dayOfMonth).toBe(0);
  });

  it('computes dayOfWeek with offset', () => {
    const date0 = timeToDate(0, defaultConfig);
    expect(date0.dayOfWeek).toBe(0);

    const date1 = timeToDate(86400 * 1000, defaultConfig);
    expect(date1.dayOfWeek).toBe(1);

    // Day 7 → weekday 0 (wraps)
    const date7 = timeToDate(7 * 86400 * 1000, defaultConfig);
    expect(date7.dayOfWeek).toBe(0);
  });

  it('respects yearStartWeekdayOffset', () => {
    const config = { ...defaultConfig, yearStartWeekdayOffset: 3 };
    const date0 = timeToDate(0, config);
    expect(date0.dayOfWeek).toBe(3);

    const date1 = timeToDate(86400 * 1000, config);
    expect(date1.dayOfWeek).toBe(4);
  });

  it('finds correct era', () => {
    const date = timeToDate(0, defaultConfig);
    expect(date.era?.abbreviation).toBe('CE');
  });

  it('finds correct season', () => {
    const date = timeToDate(0, defaultConfig);
    expect(date.season?.name).toBe('Spring');

    const dateSummer = timeToDate(100 * 86400 * 1000, defaultConfig);
    expect(dateSummer.season?.name).toBe('Summer');
  });

  it('finds named year when configured', () => {
    const config = {
      ...defaultConfig,
      namedYears: [{ year: 1, name: 'Year of the Dragon' }],
    };
    const date = timeToDate(0, config);
    expect(date.yearName).toBe('Year of the Dragon');
  });

  it('works with Harptos calendar', () => {
    const harptos = createHarptosCalendar();
    const date = timeToDate(0, harptos);
    expect(date.year).toBe(1490);
    expect(date.month).toBe(0); // Hammer
    expect(date.dayOfMonth).toBe(0);
  });

  it('works with Greyhawk calendar', () => {
    const greyhawk = createGreyhawkCalendar();
    const date = timeToDate(0, greyhawk);
    expect(date.year).toBe(591);
    expect(date.month).toBe(0); // Needfest
  });

  it('handles non-standard clock config', () => {
    const config = {
      ...defaultConfig,
      clock: { hoursPerDay: 10, minutesPerHour: 50, secondsPerMinute: 50 },
    };
    const secondsPerDay = 10 * 50 * 50; // 25000
    // 3 hours, 25 minutes, 10 seconds
    const ms = (3 * 50 * 50 + 25 * 50 + 10) * 1000;
    const date = timeToDate(ms, config);
    expect(date.hour).toBe(3);
    expect(date.minute).toBe(25);
    expect(date.second).toBe(10);
    expect(date.totalDays).toBe(0);
  });
});

// ── dateToTime ──────────────────────────────────────────────────

describe('dateToTime', () => {
  it('round-trips with timeToDate', () => {
    const originalMs = (45 * 86400 + 3600 * 5 + 60 * 23 + 17) * 1000;
    const date = timeToDate(originalMs, defaultConfig);
    const rebuilt = dateToTime(date, defaultConfig);
    expect(rebuilt).toBe(originalMs);
  });

  it('converts year 1, month 0, day 0, 00:00:00 back to 0', () => {
    const t = dateToTime(
      { year: 1, month: 0, dayOfMonth: 0, hour: 0, minute: 0, second: 0 },
      defaultConfig
    );
    expect(t).toBe(0);
  });

  it('round-trips with Harptos config', () => {
    const harptos = createHarptosCalendar();
    const originalMs = 100 * 86400 * 1000;
    const date = timeToDate(originalMs, harptos);
    const rebuilt = dateToTime(date, harptos);
    expect(rebuilt).toBe(originalMs);
  });
});

// ── Moon phases ─────────────────────────────────────────────────

describe('getMoonPhase', () => {
  it('returns new-moon at day 0 with offset 0', () => {
    const moon = defaultConfig.moons[0];
    const result = getMoonPhase(0, moon);
    expect(result.phase).toBe('new-moon');
    expect(result.phaseIndex).toBe(0);
  });

  it('returns full-moon at half period', () => {
    const moon = defaultConfig.moons[0]; // period = 28
    const result = getMoonPhase(14, moon);
    expect(result.phase).toBe('full-moon');
    expect(result.phaseIndex).toBe(4);
  });

  it('respects phaseOffset', () => {
    const moon = { ...defaultConfig.moons[0], phaseOffset: 14 };
    const result = getMoonPhase(14, moon);
    expect(result.phase).toBe('new-moon');
  });

  it('cycles through all 8 phases over one period', () => {
    const moon = defaultConfig.moons[0]; // period 28
    const seenPhases = new Set<number>();
    for (let d = 0; d < 28; d++) {
      seenPhases.add(getMoonPhase(d, moon).phaseIndex);
    }
    expect(seenPhases.size).toBe(8);
  });

  it('phase transitions happen on expected days for period 28', () => {
    const moon = defaultConfig.moons[0]; // period 28, 3.5 days per phase
    // Phase boundaries: 0, 3.5, 7, 10.5, 14, 17.5, 21, 24.5
    expect(getMoonPhase(0, moon).phaseIndex).toBe(0); // new-moon
    expect(getMoonPhase(3, moon).phaseIndex).toBe(0); // still new-moon
    expect(getMoonPhase(4, moon).phaseIndex).toBe(1); // waxing-crescent
    expect(getMoonPhase(7, moon).phaseIndex).toBe(2); // first-quarter
    expect(getMoonPhase(14, moon).phaseIndex).toBe(4); // full-moon
    expect(getMoonPhase(21, moon).phaseIndex).toBe(6); // last-quarter
  });

  it('wraps around after one full period', () => {
    const moon = defaultConfig.moons[0];
    expect(getMoonPhase(28, moon).phase).toBe(getMoonPhase(0, moon).phase);
    expect(getMoonPhase(56, moon).phase).toBe(getMoonPhase(0, moon).phase);
  });
});

describe('getAllMoonPhases', () => {
  it('returns one entry per moon', () => {
    const result = getAllMoonPhases(0, defaultConfig);
    expect(result.length).toBe(1);
    expect(result[0].moon.name).toBe('Moon');
  });

  it('returns multiple entries for Greyhawk (2 moons)', () => {
    const greyhawk = createGreyhawkCalendar();
    const result = getAllMoonPhases(0, greyhawk);
    expect(result.length).toBe(2);
    expect(result[0].moon.name).toBe('Luna');
    expect(result[1].moon.name).toBe('Celene');
  });

  it('returns empty for config with no moons', () => {
    const config = { ...defaultConfig, moons: [] };
    expect(getAllMoonPhases(0, config)).toEqual([]);
  });
});

// ── Grid ────────────────────────────────────────────────────────

describe('getMonthGrid', () => {
  it('returns correct number of days for a 30-day month', () => {
    const grid = getMonthGrid(1, 0, defaultConfig);
    const actualDays = grid.flat().filter(d => d !== null);
    expect(actualDays.length).toBe(30);
  });

  it('has correct number of columns per row', () => {
    const grid = getMonthGrid(1, 0, defaultConfig);
    for (const week of grid) {
      expect(week.length).toBe(7);
    }
  });

  it('days are sequential from 0', () => {
    const grid = getMonthGrid(1, 0, defaultConfig);
    const days = grid.flat().filter((d): d is number => d !== null);
    for (let i = 0; i < days.length; i++) {
      expect(days[i]).toBe(i);
    }
  });

  it('respects 10-day weeks (Harptos)', () => {
    const harptos = createHarptosCalendar();
    const grid = getMonthGrid(1490, 0, harptos); // Hammer, 30 days
    for (const week of grid) {
      expect(week.length).toBe(10);
    }
    const days = grid.flat().filter(d => d !== null);
    expect(days.length).toBe(30);
  });

  it('handles single-day months (Harptos holidays)', () => {
    const harptos = createHarptosCalendar();
    const grid = getMonthGrid(1490, 1, harptos); // Midwinter, 1 day
    const days = grid.flat().filter(d => d !== null);
    expect(days.length).toBe(1);
  });

  it('pads first week with nulls when month starts mid-week', () => {
    // Use a config where month 1 starts on a non-zero weekday
    const grid = getMonthGrid(1, 1, defaultConfig);
    const firstWeek = grid[0];
    // Month 0 has 30 days, day 30 with 7-day week: 30 % 7 = 2 → month 1 starts on weekday 2
    const leadingNulls = firstWeek.filter(d => d === null).length;
    expect(leadingNulls).toBe(2);
  });
});

// ── addTime ─────────────────────────────────────────────────────

describe('addTime', () => {
  it('adds days correctly', () => {
    const result = addTime(0, defaultConfig, { days: 1 });
    expect(result).toBe(86400 * 1000);
  });

  it('adds hours correctly', () => {
    const result = addTime(0, defaultConfig, { hours: 2 });
    expect(result).toBe(2 * 3600 * 1000);
  });

  it('adds rounds correctly (6 seconds each)', () => {
    const result = addTime(0, defaultConfig, { rounds: 10 });
    expect(result).toBe(60 * 1000);
  });

  it('combines multiple deltas', () => {
    const result = addTime(0, defaultConfig, {
      days: 1,
      hours: 2,
      minutes: 30,
    });
    const expected = (86400 + 7200 + 1800) * 1000;
    expect(result).toBe(expected);
  });

  it('adds to a non-zero start time', () => {
    const start = 50000;
    const result = addTime(start, defaultConfig, { seconds: 10 });
    expect(result).toBe(start + 10 * 1000);
  });

  it('adds nothing when delta is empty', () => {
    expect(addTime(12345, defaultConfig, {})).toBe(12345);
  });
});

// ── Rest durations ──────────────────────────────────────────────

describe('getShortRestMs', () => {
  it('returns 60 minutes in ms for default config', () => {
    // 60 min × 60 sec × 1000
    expect(getShortRestMs(defaultConfig)).toBe(60 * 60 * 1000);
  });
});

describe('getLongRestMs', () => {
  it('returns 8 hours in ms for default config', () => {
    // 8 hours × 60 min × 60 sec × 1000
    expect(getLongRestMs(defaultConfig)).toBe(8 * 60 * 60 * 1000);
  });
});

// ── Formatting ──────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats correctly', () => {
    const date = timeToDate(0, defaultConfig);
    expect(formatDate(date, defaultConfig)).toBe('1 January, Year 1');
  });

  it('formats second month correctly', () => {
    const date = timeToDate(30 * 86400 * 1000, defaultConfig);
    expect(formatDate(date, defaultConfig)).toBe('1 February, Year 1');
  });

  it('formats Harptos dates', () => {
    const harptos = createHarptosCalendar();
    const date = timeToDate(0, harptos);
    expect(formatDate(date, harptos)).toBe('1 Hammer, Year 1490');
  });
});

describe('formatTime', () => {
  it('formats HH:MM with padding', () => {
    const date = timeToDate((3600 * 9 + 60 * 5) * 1000, defaultConfig);
    expect(formatTime(date)).toBe('09:05');
  });

  it('formats midnight as 00:00', () => {
    const date = timeToDate(0, defaultConfig);
    expect(formatTime(date)).toBe('00:00');
  });

  it('formats 23:59', () => {
    const date = timeToDate((23 * 3600 + 59 * 60) * 1000, defaultConfig);
    expect(formatTime(date)).toBe('23:59');
  });
});

// ── Day period ──────────────────────────────────────────────────

describe('getDayPeriod', () => {
  it('returns Night before sunrise', () => {
    const date = timeToDate(3600 * 3 * 1000, defaultConfig);
    expect(getDayPeriod(date, defaultConfig)).toBe('Night');
  });

  it('returns Morning after sunrise', () => {
    const date = timeToDate(3600 * 8 * 1000, defaultConfig);
    expect(getDayPeriod(date, defaultConfig)).toBe('Morning');
  });

  it('returns Afternoon in midday', () => {
    const date = timeToDate(3600 * 14 * 1000, defaultConfig);
    expect(getDayPeriod(date, defaultConfig)).toBe('Afternoon');
  });

  it('returns Evening after sunset', () => {
    const date = timeToDate(3600 * 20 * 1000, defaultConfig);
    expect(getDayPeriod(date, defaultConfig)).toBe('Evening');
  });

  it('uses season sunrise/sunset when available', () => {
    // Summer: sunrise=5, sunset=21, midday=13
    const date = timeToDate((90 * 86400 + 5 * 3600) * 1000, defaultConfig);
    expect(date.season?.name).toBe('Summer');
    expect(getDayPeriod(date, defaultConfig)).toBe('Morning');
  });

  it('falls back to defaults when no season matches', () => {
    const config = { ...defaultConfig, seasons: [] };
    const date = timeToDate(3600 * 12 * 1000, config);
    // No season → sunrise at 25% of 24 = hour 6, sunset at 75% = hour 18, midday = 12
    expect(getDayPeriod(date, config)).toBe('Afternoon');
  });
});

// ── getTotalDaysForDate ─────────────────────────────────────────

describe('getTotalDaysForDate', () => {
  it('returns 0 for first day of first year', () => {
    expect(getTotalDaysForDate(1, 0, 0, defaultConfig)).toBe(0);
  });

  it('returns 30 for first day of second month', () => {
    expect(getTotalDaysForDate(1, 1, 0, defaultConfig)).toBe(30);
  });

  it('returns 360 for first day of second year', () => {
    expect(getTotalDaysForDate(2, 0, 0, defaultConfig)).toBe(360);
  });

  it('is consistent with timeToDate', () => {
    const ms = 100 * 86400 * 1000;
    const date = timeToDate(ms, defaultConfig);
    const totalDays = getTotalDaysForDate(
      date.year,
      date.month,
      date.dayOfMonth,
      defaultConfig
    );
    expect(totalDays).toBe(date.totalDays);
  });
});

// ── Presets sanity checks ───────────────────────────────────────

describe('calendar presets', () => {
  it('default: timeToDate → dateToTime round-trip across a full year', () => {
    for (let day = 0; day < 360; day += 30) {
      const ms = day * 86400 * 1000;
      const date = timeToDate(ms, defaultConfig);
      expect(dateToTime(date, defaultConfig)).toBe(ms);
    }
  });

  it('harptos: timeToDate → dateToTime round-trip across a full year', () => {
    const harptos = createHarptosCalendar();
    for (let day = 0; day < 365; day += 31) {
      const ms = day * 86400 * 1000;
      const date = timeToDate(ms, harptos);
      expect(dateToTime(date, harptos)).toBe(ms);
    }
  });

  it('greyhawk: timeToDate → dateToTime round-trip across a full year', () => {
    const greyhawk = createGreyhawkCalendar();
    for (let day = 0; day < 364; day += 28) {
      const ms = day * 86400 * 1000;
      const date = timeToDate(ms, greyhawk);
      expect(dateToTime(date, greyhawk)).toBe(ms);
    }
  });
});
