// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CalendarGrid } from '@/components/ui/calendar/CalendarGrid';
import type {
  CalendarConfig,
  CalendarDate,
  CalendarEvent,
} from '@/types/calendar';

afterEach(cleanup);

const config: CalendarConfig = {
  clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
  weekDays: Array.from({ length: 7 }, (_, i) => ({ name: `Day ${i + 1}` })),
  months: [{ name: 'Firstmonth', days: 30 }],
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

const currentDate: CalendarDate = {
  year: 0,
  month: 0,
  dayOfMonth: 0,
  dayOfYear: 0,
  dayOfWeek: 0,
  hour: 0,
  minute: 0,
  second: 0,
  totalDays: 0,
};

function makeEvent(
  id: string,
  day: number,
  createdAt: number,
  overrides: Partial<CalendarEvent> = {}
): CalendarEvent {
  return {
    id,
    title: `Event ${id}`,
    description: '',
    year: 0,
    month: 0,
    day,
    createdAt,
    ...overrides,
  };
}

// Distinct emoji so markers are queryable by text
const EMOJI = ['🐉', '🔥', '🎉', '⚔️', '🏰', '🌙', '💀', '🎁'];

function renderGrid(events: CalendarEvent[]) {
  return render(
    <CalendarGrid
      browseYear={0}
      browseMonth={0}
      config={config}
      currentDate={currentDate}
      events={events}
      showMoonPhases={false}
    />
  );
}

describe('CalendarGrid markers', () => {
  it('renders five markers plus +N chip for 8 events, ordered by createdAt', () => {
    // shuffled createdAt: sorted order is EMOJI[0..7]
    const events = EMOJI.map((emoji, i) =>
      makeEvent(`e${i}`, 9, i + 1, { emoji })
    ).reverse();
    renderGrid(events);

    for (const emoji of EMOJI.slice(0, 5)) {
      expect(screen.getByText(emoji)).toBeInTheDocument();
    }
    for (const emoji of EMOJI.slice(5)) {
      expect(screen.queryByText(emoji)).not.toBeInTheDocument();
    }
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('renders five markers with no chip for exactly 5 events', () => {
    const events = EMOJI.slice(0, 5).map((emoji, i) =>
      makeEvent(`e${i}`, 9, i + 1, { emoji })
    );
    renderGrid(events);
    for (const emoji of EMOJI.slice(0, 5)) {
      expect(screen.getByText(emoji)).toBeInTheDocument();
    }
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it('renders legacy events as default blue dots and colored events with their color', () => {
    const { container } = renderGrid([
      makeEvent('legacy', 3, 1),
      makeEvent('colored', 3, 2, { color: '#ff0000' }),
    ]);
    const dots = container.querySelectorAll(
      'span[aria-hidden="true"].rounded-full'
    );
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveStyle({ backgroundColor: '#3b82f6' });
    expect(dots[1]).toHaveStyle({ backgroundColor: '#ff0000' });
  });

  it('day-cell buttons have min-h-14', () => {
    const { container } = renderGrid([]);
    const buttons = container.querySelectorAll('td button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(b => expect(b).toHaveClass('min-h-14'));
  });
});
