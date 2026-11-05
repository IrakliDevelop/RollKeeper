import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { XpAwardControl } from './XpAwardControl';

const meta: Meta<typeof XpAwardControl> = {
  component: XpAwardControl,
  args: {
    campaignCode: 'ABC123',
    dmId: 'dm-1',
    playerId: 'p-1',
    lastSyncedXp: 1200,
    projectedXp: 1500,
    pendingAwardCount: 1,
    currentLevel: 3,
  },
  parameters: { a11y: { test: 'error' } },
  decorators: [
    Story => (
      <div className="max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof XpAwardControl>;

async function checkControl(canvasElement: HTMLElement) {
  const screen = within(canvasElement);
  await expect(
    screen.getByRole('heading', { level: 3, name: 'Award XP' })
  ).toBeVisible();
  await expect(
    screen.getByText('Includes 1 award not yet received')
  ).toBeVisible();
  const add = screen.getByRole('button', { name: 'Add XP' });
  await expect(add).toHaveAttribute('aria-pressed', 'true');

  const set = screen.getByRole('button', { name: 'Set total' });
  await userEvent.click(set);
  await expect(set).toHaveAttribute('aria-pressed', 'true');
  await expect(
    screen.getByText(
      "Replaces the character's XP total, including changes since the last sync."
    )
  ).toBeVisible();
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await checkControl(canvasElement);
  },
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    await checkControl(canvasElement);
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    );
  },
};
