import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDmCalendarSync } from '@/hooks/useDmCalendarSync';
import { useCalendarStore } from '@/store/calendarStore';
import { useDmStore } from '@/store/dmStore';
import {
  clickConfirmDialogButton,
  findConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';
import { dateToTime } from '@/utils/calendarCalculations';
import { createDefaultCalendar } from '@/utils/calendarPresets';

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

function seedCalendar() {
  const config = createDefaultCalendar();
  const time = dateToTime(
    { year: 1, month: 0, dayOfMonth: 4, hour: 14, minute: 30, second: 0 },
    config
  );
  useCalendarStore.setState({
    calendars: [
      {
        campaignCode: 'K7QX2M',
        config,
        currentTime: time,
        startTime: time,
        events: [],
        weather: 'clear',
      },
    ],
  });
}

function findCalendar() {
  return useCalendarStore
    .getState()
    .calendars.find(c => c.campaignCode === 'K7QX2M');
}

describe('DM calendar page, with a calendar', () => {
  const originalDelete = useCalendarStore.getState().deleteCalendar;

  beforeEach(() => {
    seedCalendar();
  });

  afterEach(() => {
    useCalendarStore.setState({ deleteCalendar: originalDelete });
    vi.mocked(useDmCalendarSync).mockReturnValue({
      lastPushed: null,
      error: null,
    });
  });

  it('reset asks first and keeps the calendar on cancel', async () => {
    renderConfirmDialogHost();
    render(<CalendarPage />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Reset calendar' })
    );
    const dialog = await findConfirmDialog();
    expect(dialog).toHaveTextContent('Reset the calendar?');
    expect(dialog).toHaveTextContent(
      'Deletes the time, start date, settings and every event. Players keep the last synced calendar until you create a new one.'
    );

    await clickConfirmDialogButton('Cancel');
    expect(findCalendar()).toBeDefined();
  });

  it('reset deletes the calendar once on confirm', async () => {
    const spy = vi.fn(originalDelete);
    useCalendarStore.setState({ deleteCalendar: spy });
    renderConfirmDialogHost();
    render(<CalendarPage />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Reset calendar' })
    );
    await clickConfirmDialogButton('Reset calendar');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('K7QX2M');
    expect(findCalendar()).toBeUndefined();
    expect(
      await screen.findByRole('heading', { name: 'Choose a calendar' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('has no inline reset card', () => {
    render(<CalendarPage />);
    expect(screen.queryByText(/Reset this calendar/)).toBeNull();
    expect(document.querySelector('main .bg-surface-raised')).toBeNull();
  });

  it('sync error is a fixed sentence', () => {
    vi.mocked(useDmCalendarSync).mockReturnValue({
      lastPushed: null,
      error: 'Push failed (500)',
    });
    render(<CalendarPage />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(
      "Couldn't sync the calendar to players. The next change will try again."
    );
    expect(alert.textContent).toBe(
      "Couldn't sync the calendar to players. The next change will try again."
    );
    expect(alert).toHaveClass('type-small', 'text-blood-text');
    expect(screen.queryByText(/Push failed/)).toBeNull();
  });

  it('shows the syncing and synced lines', () => {
    const { unmount } = render(<CalendarPage />);
    expect(screen.getByText('Syncing…')).toHaveClass('text-muted');
    unmount();

    vi.mocked(useDmCalendarSync).mockReturnValue({
      lastPushed: new Date(),
      error: null,
    });
    render(<CalendarPage />);
    expect(screen.getByText('Synced to players just now')).toBeInTheDocument();
  });

  it('has no primary with a calendar and keeps the sync controls', () => {
    render(<CalendarPage />);
    expect(
      document.querySelectorAll('main [data-variant="primary"]')
    ).toHaveLength(0);
    expect(screen.getByTestId('calendar-sync-controls')).toBeInTheDocument();
  });
});
