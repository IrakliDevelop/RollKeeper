// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EventListView } from '@/components/ui/calendar/EventListView';
import type { CalendarConfig, CalendarEvent } from '@/types/calendar';

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

const events: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Legacy event',
    description: '',
    year: 0,
    month: 0,
    day: 1,
    createdAt: 1,
  },
  {
    id: 'e2',
    title: 'Red event',
    description: '',
    year: 0,
    month: 0,
    day: 2,
    createdAt: 2,
    color: '#ff0000',
  },
  {
    id: 'e3',
    title: 'Dragon event',
    description: '',
    year: 0,
    month: 0,
    day: 3,
    createdAt: 3,
    emoji: '🐉',
  },
];

describe('EventListView markers', () => {
  it('renders emoji, custom color dot, and legacy blue dot per event', () => {
    const { container } = render(
      <EventListView
        events={events}
        config={config}
        onUpdateEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
      />
    );
    expect(screen.getByText('🐉')).toBeInTheDocument();
    const dots = container.querySelectorAll(
      'span[aria-hidden="true"].rounded-full'
    );
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveStyle({ backgroundColor: '#3b82f6' });
    expect(dots[1]).toHaveStyle({ backgroundColor: '#ff0000' });
  });
});
