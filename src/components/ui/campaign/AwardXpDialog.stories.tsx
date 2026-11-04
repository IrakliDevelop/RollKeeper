import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { AwardXpDialog } from './AwardXpDialog';
import type { CampaignPlayerData } from '@/types/campaign';

const players = [
  { playerId: 'p1', playerName: 'Alice', characterName: 'Thorin' },
  { playerId: 'p2', playerName: 'Sam', characterName: 'Mira' },
  { playerId: 'p3', playerName: 'Jo', characterName: 'Bartholomew Underhill' },
] as CampaignPlayerData[];

const meta: Meta<typeof AwardXpDialog> = {
  component: AwardXpDialog,
  args: {
    open: true,
    onClose: fn(),
    campaignCode: 'ABC123',
    dmId: 'dm-1',
    players,
  },
  parameters: { a11y: { test: 'error' } },
};

export default meta;
type Story = StoryObj<typeof AwardXpDialog>;

// Dialog renders in a portal on document.body — query the whole document.
function body(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    await screen.findByRole('dialog', { name: 'Award XP' });
    await expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    const disabled = screen.getByRole('button', {
      name: 'Award XP to 3 players',
    });
    await expect(disabled).toBeDisabled();

    await userEvent.type(screen.getByLabelText('XP to add'), '300');
    await waitFor(() => expect(disabled).toBeEnabled());

    await userEvent.click(screen.getByRole('checkbox', { name: 'Mira' }));
    await expect(
      await screen.findByRole('button', { name: 'Award XP to 2 players' })
    ).toBeEnabled();
  },
};
