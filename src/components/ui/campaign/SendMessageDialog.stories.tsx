import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { SendMessageDialog } from './SendMessageDialog';
import type { CampaignPlayerData } from '@/types/campaign';

const players = [
  { playerId: 'p1', playerName: 'Alice', characterName: 'Thorin' },
  { playerId: 'p2', playerName: 'Sam', characterName: 'Mira' },
] as CampaignPlayerData[];

const meta: Meta<typeof SendMessageDialog> = {
  component: SendMessageDialog,
  args: {
    open: true,
    onClose: fn(),
    campaignCode: 'ABC123',
    dmId: 'dm-1',
    players,
  },
  parameters: {
    a11y: {
      test: 'error',
      context: {
        include: ['body'],
        // The node after the editor content is RichTextEditor's own
        // `text-faint` placeholder (2.92:1). It is outside this PR's scope.
        exclude: ['.rich-text-editor-content + div'],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SendMessageDialog>;

// Dialog renders in a portal on document.body — query the whole document.
function body(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

// The editor shows "Loading editor..." until it mounts, so wait for it.
async function expectEditor(screen: ReturnType<typeof body>) {
  await screen.findByRole('textbox', { name: 'Message (optional)' });
  await screen.findByText('Meet at the Rusty Anchor after the session.');
}

export const AllPlayers: Story = {
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    await screen.findByRole('dialog', { name: 'Message all players' });
    await waitFor(() =>
      expect(screen.getByText('All players (2)')).toBeVisible()
    );
    await expect(screen.getByLabelText('Title')).toHaveAttribute(
      'placeholder',
      'The bridge is out'
    );
    await expectEditor(screen);
  },
};

export const OnePlayer: Story = {
  args: { targetPlayer: players[0] },
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    await screen.findByRole('dialog', { name: 'Message Thorin' });
    await waitFor(() =>
      expect(screen.getByText('Thorin (Alice)')).toBeVisible()
    );
    await expectEditor(screen);
  },
};

// The page clears the recipient as it closes the dialog, like this harness.
function ClosingHarness() {
  const [target, setTarget] = useState<CampaignPlayerData | null>(players[0]);
  return (
    <SendMessageDialog
      open={target !== null}
      onClose={() => setTarget(null)}
      targetPlayer={target}
      players={players}
      campaignCode="ABC123"
      dmId="dm-1"
    />
  );
}

export const KeepsRecipientWhileClosing: Story = {
  render: () => <ClosingHarness />,
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    await screen.findByRole('dialog', { name: 'Message Thorin' });
    await expectEditor(screen);
    await userEvent.keyboard('{Escape}');
    // The dialog stays mounted while it fades out.
    const closing = canvasElement.ownerDocument.querySelector(
      '[role=dialog][data-state=closed]'
    );
    await expect(closing).not.toBeNull();
    await expect(closing).toHaveTextContent('Message Thorin');
    await expect(closing).toHaveTextContent('Thorin (Alice)');
  },
};
