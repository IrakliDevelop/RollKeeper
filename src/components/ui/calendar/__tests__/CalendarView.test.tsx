import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cancelAllDialogs } from '@/components/ui/feedback/confirm-dialog';
import { useCalendarStore } from '@/store/calendarStore';
import { dateToTime, timeToDate } from '@/utils/calendarCalculations';
import { createDefaultCalendar } from '@/utils/calendarPresets';
import type { CalendarEvent } from '@/types/calendar';

import { CalendarView } from '../CalendarView';

const CODE = 'K7QX2M';
const config = createDefaultCalendar();
const now = dateToTime(
  { year: 1, month: 0, dayOfMonth: 4, hour: 14, minute: 30, second: 0 },
  config
);

function makeEvent(id: string, title: string, day: number): CalendarEvent {
  return {
    id,
    title,
    description: '',
    year: 1,
    month: 0,
    day,
    createdAt: day,
  };
}

beforeEach(() => {
  useCalendarStore.setState({
    calendars: [
      {
        campaignCode: CODE,
        config,
        currentTime: now,
        startTime: now,
        events: [makeEvent('e1', 'Market', 4), makeEvent('e2', 'Feast', 9)],
        weather: 'fog',
      },
    ],
  });
});

afterEach(() => {
  useCalendarStore.setState({ calendars: [] });
  cancelAllDialogs();
  cleanup();
});

describe('CalendarView', () => {
  it('lays out the view without cards or a primary', () => {
    const { container } = render(<CalendarView campaignCode={CODE} />);

    expect(container.querySelector('.bg-surface-raised')).toBeNull();
    expect(container.querySelector('.rounded-lg, .shadow-sm')).toBeNull();
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(
      0
    );
    expect(screen.getByText('Day 1 of the campaign')).toHaveClass(
      'type-small',
      'text-muted'
    );
  });

  it('opens the start date dialog and links to settings', async () => {
    const user = userEvent.setup();
    render(<CalendarView campaignCode={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Start date' }));
    expect(
      screen.getByRole('dialog', { name: 'Campaign start date' })
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');

    const link = screen.getByRole('link', { name: 'Settings' });
    expect(link).toHaveAttribute(
      'href',
      `/dm/campaign/${CODE}/calendar/settings`
    );
    expect(link.querySelector('button')).toBeNull();
    expect(link.closest('button')).toBeNull();
  });

  it('shows a danger Reset calendar button only with onReset', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    const { unmount } = render(
      <CalendarView campaignCode={CODE} onReset={onReset} />
    );

    const reset = screen.getByRole('button', { name: 'Reset calendar' });
    expect(reset).toHaveAttribute('data-variant', 'danger');
    await user.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
    unmount();

    render(<CalendarView campaignCode={CODE} />);
    expect(screen.queryByRole('button', { name: 'Reset calendar' })).toBeNull();
  });

  it('switches between Calendar and Events with SubTabs', async () => {
    const user = userEvent.setup();
    render(<CalendarView campaignCode={CODE} />);

    const list = screen.getByRole('tablist', { name: 'Calendar and events' });
    expect(within(list).getByRole('tab', { name: 'Calendar' })).toBeVisible();
    const eventsTab = within(list).getByRole('tab', { name: /^Events/ });
    const badge = eventsTab.querySelector('[data-variant="neutral"]');
    expect(badge).toHaveTextContent('2');
    expect(list.querySelector('svg')).toBeNull();

    await user.click(eventsTab);
    expect(
      screen.getByRole('textbox', { name: 'Search events' })
    ).toBeInTheDocument();
  });

  it('weather toggles write to the store', async () => {
    const user = userEvent.setup();
    render(<CalendarView campaignCode={CODE} />);

    await user.click(
      within(screen.getByRole('group', { name: 'Weather' })).getByRole(
        'button',
        { name: 'Clear' }
      )
    );
    expect(useCalendarStore.getState().calendars[0].weather).toBe('clear');
  });

  it('Edit time sets the clock', async () => {
    const user = userEvent.setup();
    render(<CalendarView campaignCode={CODE} />);

    await user.click(screen.getByRole('button', { name: 'Edit time' }));
    const hour = screen.getByRole('textbox', { name: 'Hour' });
    await user.clear(hour);
    await user.type(hour, '9');
    await user.click(screen.getByRole('button', { name: 'Set time' }));

    const date = timeToDate(
      useCalendarStore.getState().calendars[0].currentTime,
      config
    );
    expect(date).toMatchObject({ hour: 9, minute: 30, second: 0 });
  });

  it('Escape in the event dialog leaves the day popover open', async () => {
    const user = userEvent.setup();
    render(<CalendarView campaignCode={CODE} />);

    await user.click(screen.getByRole('button', { name: '5 January 1' }));
    await user.click(screen.getByRole('button', { name: 'Add event' }));
    await screen.findByRole('dialog', { name: 'Add event' });
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Add event' })).toHaveLength(
      1
    );
  });

  it('puts the moon legend under the grid', () => {
    render(<CalendarView campaignCode={CODE} />);
    expect(
      screen.getByRole('heading', { level: 4, name: 'Moon phases' })
    ).toBeInTheDocument();
  });
});
