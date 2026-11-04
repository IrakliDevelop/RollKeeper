import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SendItemDialog, type SendItemTarget } from './SendItemDialog';
import type { InventoryItem } from '@/types/character';

const item: InventoryItem = {
  id: 'i1',
  name: 'Potion of healing',
  category: 'consumable',
  quantity: 3,
  rarity: 'common',
  tags: [],
  createdAt: '',
  updatedAt: '',
};

const targets: SendItemTarget[] = [
  {
    playerId: 'p1',
    playerName: 'Alice',
    characterName: 'Thorin',
    characterId: 'c1',
  },
  {
    playerId: 'p2',
    playerName: 'Sam',
    characterName: 'Mira',
    characterId: 'c2',
  },
];

function renderDialog(
  props: Partial<React.ComponentProps<typeof SendItemDialog>> = {}
) {
  const onClose = vi.fn();
  const onSend = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <SendItemDialog
      open
      onClose={onClose}
      item={item}
      targets={targets}
      onSend={onSend}
      {...props}
    />
  );
  return { onClose, onSend, ...utils };
}

describe('SendItemDialog', () => {
  afterEach(cleanup);

  it('shows the item and what it sends', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Send item' })).toBeVisible();
    expect(screen.getByText('Potion of healing')).toBeVisible();
    expect(screen.getByText('Sends all 3 · Common')).toBeVisible();
  });

  it('shows no detail line for a single item with no rarity', () => {
    renderDialog({ item: { ...item, quantity: 1, rarity: undefined } });
    expect(screen.getByText('Potion of healing')).toBeVisible();
    expect(screen.queryByText(/Sends all|·/)).toBeNull();
  });

  it('picks a target with a radio before sending', async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.getByRole('radiogroup', { name: 'Send to' })).toBeVisible();
    expect(
      screen.getByRole('radio', { name: 'Thorin' })
    ).toHaveAccessibleDescription('Alice');
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
    const send = screen.getByRole('button', { name: 'Send item' });
    expect(send).toHaveAttribute('data-variant', 'primary');
    expect(send.querySelector('svg')).toBeNull();
    expect(send).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'Mira' }));
    expect(screen.getByRole('radio', { name: 'Mira' })).toBeChecked();
    expect(send).toBeEnabled();
  });

  it('sends the item to the chosen target', async () => {
    const user = userEvent.setup();
    const { onSend, onClose } = renderDialog();
    await user.click(screen.getByRole('radio', { name: 'Mira' }));
    await user.click(screen.getByRole('button', { name: 'Send item' }));
    expect(onSend).toHaveBeenCalledWith(item, targets[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reads Sending… while the send runs', () => {
    renderDialog({ sending: true });
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  });

  it('says when there is nobody to send to', () => {
    const { rerender, onClose, onSend } = renderDialog({ targets: [] });
    expect(screen.getByText('Send to')).toBeVisible();
    expect(screen.getByText('No other players in this campaign')).toBeVisible();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send item' })).toBeDisabled();

    rerender(
      <SendItemDialog
        open
        onClose={onClose}
        item={item}
        targets={[]}
        onSend={onSend}
        emptyMessage="No players in this campaign yet"
      />
    );
    expect(screen.getByText('Send to')).toBeVisible();
    expect(screen.getByText('No players in this campaign yet')).toBeVisible();
    expect(screen.queryByText('No other players in this campaign')).toBeNull();
  });

  it('Cancel clears the pick', async () => {
    const user = userEvent.setup();
    const { onClose, onSend, rerender } = renderDialog();
    await user.click(screen.getByRole('radio', { name: 'Thorin' }));
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveAttribute('data-variant', 'outline');
    await user.click(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);

    const props = { onClose, item, targets, onSend };
    rerender(<SendItemDialog open={false} {...props} />);
    rerender(<SendItemDialog open {...props} />);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
    expect(screen.getByRole('button', { name: 'Send item' })).toBeDisabled();
  });
});
