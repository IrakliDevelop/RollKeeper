import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  PLAYER_BACKUP_DASHBOARD_SCENARIOS,
  createPlayerBackupDashboardFixture,
} from './PlayerBackupSummaryCard.fixtures';
import { PlayerBackupSummaryCard } from './PlayerBackupSummaryCard';

const meta: Meta<typeof PlayerBackupSummaryCard> = {
  component: PlayerBackupSummaryCard,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof meta>;

const titles: Record<
  (typeof PLAYER_BACKUP_DASHBOARD_SCENARIOS)[number],
  string
> = {
  'not-started': 'NotStarted',
  resumable: 'Resumable',
  'ongoing-complete': 'OngoingComplete',
  'one-time-complete': 'OneTimeComplete',
  'no-characters': 'NoCharacters',
  unavailable: 'Unavailable',
};

const stories = Object.fromEntries(
  PLAYER_BACKUP_DASHBOARD_SCENARIOS.map(scenario => [
    titles[scenario],
    {
      args: { view: createPlayerBackupDashboardFixture(scenario) },
    } satisfies Story,
  ])
) as Record<string, Story>;

export const NotStarted = stories.NotStarted;
export const Resumable = stories.Resumable;
export const OngoingComplete = stories.OngoingComplete;
export const OneTimeComplete = stories.OneTimeComplete;
export const NoCharacters = stories.NoCharacters;
export const Unavailable = stories.Unavailable;

export const NotStartedNarrow: Story = {
  args: { view: createPlayerBackupDashboardFixture('not-started') },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const OngoingNarrow: Story = {
  args: { view: createPlayerBackupDashboardFixture('ongoing-complete') },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const UnavailableNarrow: Story = {
  args: { view: createPlayerBackupDashboardFixture('unavailable') },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const OngoingDark: Story = {
  args: { view: createPlayerBackupDashboardFixture('ongoing-complete') },
  globals: { theme: 'dark' },
};

export const OngoingParchment: Story = {
  args: { view: createPlayerBackupDashboardFixture('ongoing-complete') },
  globals: { theme: 'parchment' },
};
