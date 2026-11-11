import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCalendarStore } from '@/store/calendarStore';
import { useDmStore } from '@/store/dmStore';

import CalendarPage from '../page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'K7QX2M' }),
  usePathname: () => '/dm/campaign/K7QX2M/calendar',
}));

vi.mock('@/components/auth/HeaderTrailing', () => ({
  HeaderTrailing: () => <button>Theme</button>,
}));

vi.mock('@/hooks/useDmCalendarSync', () => ({
  useDmCalendarSync: vi.fn(() => ({ lastPushed: null, error: null })),
}));

vi.mock('@/components/ui/calendar/CalendarSyncControls', () => ({
  CalendarSyncControls: () => <div data-testid="calendar-sync-controls" />,
}));

beforeEach(() => {
  useDmStore.setState({
    dmId: 'dm-1',
    campaigns: [
      {
        code: 'K7QX2M',
        name: 'Sunken Bell',
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ],
  });
  useCalendarStore.setState({ calendars: [] });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('DM calendar page, setup state', () => {
  it('setup state offers the presets under "Choose a calendar"', () => {
    render(<CalendarPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Choose a calendar' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Pick a calendar to start from. Months, week days, moons and eras can be changed in settings.'
      )
    ).toHaveClass('type-body', 'text-muted');

    const group = screen.getByRole('radiogroup', { name: 'Choose a calendar' });
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(4);

    const primaries = document.querySelectorAll(
      'main [data-variant="primary"]'
    );
    expect(primaries).toHaveLength(1);
    expect(primaries[0]).toHaveAccessibleName('Create calendar');

    expect(document.querySelector('main .bg-surface-raised')).toBeNull();
    expect(document.querySelector('main [class*="accent-"]')).toBeNull();
    expect(screen.getByTestId('calendar-sync-controls')).toBeInTheDocument();
  });

  it('Create calendar uses the chosen preset', async () => {
    render(<CalendarPage />);

    await userEvent.click(
      screen.getByRole('radio', { name: 'Harptos (Forgotten Realms)' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create calendar' })
    );

    const created = useCalendarStore
      .getState()
      .calendars.find(c => c.campaignCode === 'K7QX2M')!;
    expect(created.config.weekDays.length).toBe(10);
  });
});
