// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarGrid } from '@/components/ui/calendar/CalendarGrid';
import { EventListView } from '@/components/ui/calendar/EventListView';
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
  title: string,
  createdAt: number,
  overrides: Partial<CalendarEvent> = {}
): CalendarEvent {
  return {
    id,
    title,
    description: '',
    year: 0,
    month: 0,
    day: 2,
    createdAt,
    ...overrides,
  };
}

// Arranged as morning → midday → evening, though created in another order.
const events: CalendarEvent[] = [
  makeEvent('evening', 'Evening feast', 1, { sortOrder: 2 }),
  makeEvent('morning', 'Morning ambush', 2, { sortOrder: 0 }),
  makeEvent('midday', 'Midday council', 3, { sortOrder: 1 }),
  makeEvent('lonely', 'Lonely errand', 4, { day: 5 }),
];

const titlesIn = (root: HTMLElement) =>
  within(root)
    .getAllByText(/feast|ambush|council/)
    .map(node => node.textContent);

function renderGrid(onMoveEvent?: () => void) {
  return render(
    <CalendarGrid
      browseYear={0}
      browseMonth={0}
      config={config}
      currentDate={currentDate}
      events={events}
      selectedDay={{ year: 0, month: 0, day: 2 }}
      onDayClick={vi.fn()}
      onAddEvent={vi.fn()}
      onEditEvent={vi.fn()}
      onDeleteEvent={vi.fn()}
      onMoveEvent={onMoveEvent}
    />
  );
}

describe('CalendarGrid day popover ordering', () => {
  it('lists the selected day in arranged order', () => {
    const { container } = renderGrid(vi.fn());
    expect(titlesIn(container)).toEqual([
      'Morning ambush',
      'Midday council',
      'Evening feast',
    ]);
  });

  it('moves events through onMoveEvent and disables edge moves', async () => {
    const onMoveEvent = vi.fn();
    renderGrid(onMoveEvent);
    const user = userEvent.setup();

    expect(
      screen.getByRole('button', { name: 'Move Morning ambush earlier' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Move Evening feast later' })
    ).toBeDisabled();

    await user.click(
      screen.getByRole('button', { name: 'Move Midday council earlier' })
    );
    await user.click(
      screen.getByRole('button', { name: 'Move Morning ambush later' })
    );
    expect(onMoveEvent.mock.calls).toEqual([
      ['midday', 'up'],
      ['morning', 'down'],
    ]);
  });

  it('hides move controls without an onMoveEvent handler', () => {
    renderGrid(undefined);
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
  });
});

describe('EventListView ordering', () => {
  function renderList(onMoveEvent = vi.fn()) {
    render(
      <EventListView
        events={events}
        config={config}
        onUpdateEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
        onMoveEvent={onMoveEvent}
      />
    );
    return onMoveEvent;
  }

  it('groups a day in arranged order and offers moves', async () => {
    const onMoveEvent = renderList();
    expect(titlesIn(document.body)).toEqual([
      'Morning ambush',
      'Midday council',
      'Evening feast',
    ]);
    await userEvent
      .setup()
      .click(
        screen.getByRole('button', { name: 'Move Evening feast earlier' })
      );
    expect(onMoveEvent).toHaveBeenCalledWith('evening', 'up');
  });

  it('offers no moves for a lone event on its day', () => {
    renderList();
    expect(
      screen.queryByRole('button', { name: /Move Lonely errand/ })
    ).toBeNull();
  });

  it('hides moves while a search filter can hide same-day events', async () => {
    renderList();
    await userEvent
      .setup()
      .type(screen.getByPlaceholderText('Search events...'), 'ambush');
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
  });
});
