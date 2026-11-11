import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSharedCampaignState } from '@/hooks/useSharedCampaignState';
import { useCalendarStore } from '@/store/calendarStore';
import { createDefaultCalendar } from '@/utils/calendarPresets';
import { dateToTime } from '@/utils/calendarCalculations';

import { PlayerCalendarView } from '../PlayerCalendarView';

vi.mock('@/hooks/useSharedCampaignState', () => ({
  useSharedCampaignState: vi.fn(() => ({
    sharedState: null,
    lastFetched: null,
  })),
}));

afterEach(() => {
  cleanup();
  useCalendarStore.setState({ calendars: [] });
  vi.mocked(useSharedCampaignState).mockReturnValue({
    sharedState: null,
    lastFetched: null,
  } as ReturnType<typeof useSharedCampaignState>);
});

describe('PlayerCalendarView', () => {
  it('setup lists the shared presets with the DM descriptions', async () => {
    const { container } = render(<PlayerCalendarView characterId="char-1" />);

    expect(
      screen.getByRole('radiogroup', { name: 'Choose a calendar' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(
      screen.getByRole('radio', { name: 'Default (Simple)' })
    ).toHaveAccessibleDescription(
      '7-day weeks, 12 months of 30 days, 4 seasons, 1 moon'
    );
    expect(container.querySelector('[class*="accent-"]')).toBeNull();

    await userEvent.click(
      screen.getByRole('radio', { name: 'Harptos (Forgotten Realms)' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create Calendar' })
    );

    const created = useCalendarStore
      .getState()
      .calendars.find(c => c.campaignCode === 'char-1')!;
    expect(created.config.weekDays).toHaveLength(10);
  });

  it('synced time shows a neutral period icon', () => {
    const config = createDefaultCalendar();
    vi.mocked(useSharedCampaignState).mockReturnValue({
      sharedState: {
        calendar: {
          config,
          currentTime: dateToTime(
            {
              year: 1,
              month: 0,
              dayOfMonth: 0,
              hour: 14,
              minute: 0,
              second: 0,
            },
            config
          ),
          startTime: 0,
        },
      },
      lastFetched: new Date(),
    } as unknown as ReturnType<typeof useSharedCampaignState>);

    const { container } = render(
      <PlayerCalendarView characterId="char-1" campaignCode="K7QX2M" />
    );

    expect(screen.getByText('Afternoon')).toBeInTheDocument();
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(0);
    expect(container.querySelector('svg.lucide-sun')).toHaveClass('text-muted');
    // Scoped to the time display: the month grid below keeps its accent
    // classes until the shared grid restyle.
    const timeDisplay = screen.getByText('Afternoon').closest('.inline-flex')!;
    expect(timeDisplay.querySelector('[class*="accent-"]')).toBeNull();
  });
});
