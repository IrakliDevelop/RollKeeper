import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCalendarStore } from '@/store/calendarStore';
import { createDefaultCalendar } from '@/utils/calendarPresets';

import CalendarSettingsPage from '../page';

const push = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'K7QX2M' }),
  usePathname: () => '/dm/campaign/K7QX2M/calendar/settings',
  useRouter: () => ({ push }),
}));

vi.mock('@/components/auth/HeaderTrailing', () => ({
  HeaderTrailing: () => <button>Theme</button>,
}));

beforeEach(() => {
  useCalendarStore.setState({ calendars: [] });
  push.mockReset();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('DM calendar settings page', () => {
  it('without a calendar it points back to the calendar page', () => {
    render(<CalendarSettingsPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Calendar settings' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute(
      'href',
      '/dm/campaign/K7QX2M/calendar'
    );
    expect(screen.getByText('Choose a calendar first')).toHaveClass(
      'type-subheading',
      'text-heading'
    );
    expect(
      screen.getByText('Settings open once this campaign has a calendar.')
    ).toHaveClass('type-body', 'text-muted');

    const open = screen.getByRole('link', { name: 'Open calendar' });
    expect(open).toHaveAttribute('href', '/dm/campaign/K7QX2M/calendar');
    expect(open).toHaveAttribute('data-variant', 'primary');
    expect(open.querySelector('button')).toBeNull();
    expect(
      document.querySelectorAll('main [data-variant="primary"]')
    ).toHaveLength(1);

    expect(
      screen.queryByText('No calendar found for this campaign.')
    ).toBeNull();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Set Up Calendar' })
    ).toBeNull();
  });

  it('with a calendar it saves and returns to the calendar', async () => {
    useCalendarStore.setState({
      calendars: [
        {
          campaignCode: 'K7QX2M',
          config: createDefaultCalendar(),
          currentTime: 0,
          startTime: 0,
          events: [],
        },
      ],
    });
    const user = userEvent.setup();
    render(<CalendarSettingsPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Calendar settings' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Clock' })
    ).toBeInTheDocument();

    const year = screen.getByRole('textbox', { name: 'Starting year' });
    await user.clear(year);
    await user.type(year, '7');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(useCalendarStore.getState().calendars[0].config.yearOffset).toBe(7);
    expect(push).toHaveBeenCalledWith('/dm/campaign/K7QX2M/calendar');
  });
});
