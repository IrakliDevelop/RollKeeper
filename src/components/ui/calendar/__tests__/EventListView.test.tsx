import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelAllDialogs } from '@/components/ui/feedback/confirm-dialog';
import { renderConfirmDialogHost } from '@/test/confirmDialog';
import type { CalendarConfig, CalendarEvent } from '@/types/calendar';
import { EventListView } from '../EventListView';

const config: CalendarConfig = {
  clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
  weekDays: Array.from({ length: 7 }, (_, i) => ({ name: `Day ${i + 1}` })),
  months: [
    { name: 'Firstmonth', days: 30 },
    { name: 'Secondmonth', days: 30 },
  ],
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
    title: 'Market',
    description: '',
    year: 1,
    month: 0,
    day: 0,
    createdAt: 1,
  },
  {
    id: 'e2',
    title: 'Feast',
    description: '',
    year: 2,
    month: 0,
    day: 3,
    createdAt: 2,
  },
];

afterEach(() => {
  cancelAllDialogs();
  cleanup();
});

function renderList(list: CalendarEvent[] = events) {
  renderConfirmDialogHost();
  return render(
    <EventListView
      events={list}
      config={config}
      onUpdateEvent={vi.fn()}
      onDeleteEvent={vi.fn()}
    />
  );
}

describe('EventListView', () => {
  it('keeps typed edits when the parent re-renders', async () => {
    const user = userEvent.setup();
    const { rerender } = renderList();
    await user.click(screen.getByRole('button', { name: 'Edit Market' }));
    const title = await screen.findByRole('textbox', { name: /^Title/ });
    await user.clear(title);
    await user.type(title, 'Night market');

    rerender(
      <EventListView
        events={events}
        config={config}
        onUpdateEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
      />
    );

    expect(screen.getByRole('textbox', { name: /^Title/ })).toHaveValue(
      'Night market'
    );
  });

  it('opening another event resets the form', async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole('button', { name: 'Edit Market' }));
    const title = await screen.findByRole('textbox', { name: /^Title/ });
    await user.clear(title);
    await user.type(title, 'Night market');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Edit Feast' }));

    expect(await screen.findByRole('textbox', { name: /^Title/ })).toHaveValue(
      'Feast'
    );
  });

  it('labels the filters and drops the number input', () => {
    const { container } = renderList();
    const search = screen.getByRole('textbox', { name: 'Search events' });
    expect(search).toHaveAttribute('placeholder', 'Search events');
    expect(screen.getByRole('combobox', { name: 'Month' })).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Sort by' })
    ).toBeInTheDocument();
    const year = screen.getByRole('textbox', { name: 'Year' });
    expect(year).toHaveAttribute('placeholder', '1492');
    expect(container.querySelector('input[type="number"]')).toBeNull();
  });

  it('filters by year and clears back to all', async () => {
    const user = userEvent.setup();
    renderList();
    const year = screen.getByRole('textbox', { name: 'Year' });
    await user.type(year, '2');
    expect(screen.queryByText('Market')).toBeNull();
    expect(screen.getByText('Feast')).toBeInTheDocument();

    await user.clear(year);
    expect(screen.getByText('Market')).toBeInTheDocument();
    expect(screen.getByText('Feast')).toBeInTheDocument();
  });

  it('groups days in a divided list without a box', () => {
    const { container } = renderList();
    const heading = screen.getAllByRole('heading', { level: 3 })[0];
    expect(heading).toHaveClass('type-label-heading', 'text-muted');
    expect(heading).toHaveTextContent('1 Firstmonth, Year 1');
    expect(heading.className).not.toMatch(/tracking-|rounded/);

    const list = heading.nextElementSibling as HTMLElement;
    expect(list.tagName).toBe('UL');
    expect(list).toHaveClass('divide-y', 'divide-divider');

    expect(container.querySelector('.bg-surface-secondary')).toBeNull();
    expect(screen.getByRole('button', { name: 'Market' })).toHaveClass(
      'pointer-coarse:min-h-11'
    );
  });

  it('invites a day pick when there are no events', () => {
    renderList([]);
    expect(
      screen.getByText('Choose a day on the calendar to add an event.')
    ).toBeInTheDocument();
  });
});
