import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
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

// The third name is one long unbroken word on purpose: a hyphen would let the
// line wrap and hide an overflow.
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
  {
    playerId: 'p3',
    playerName: 'Jo',
    characterName: 'Bartholomewunderhillgreenbottle',
    characterId: 'c3',
  },
];

const meta: Meta<typeof SendItemDialog> = {
  component: SendItemDialog,
  args: {
    open: true,
    onClose: fn(),
    onSend: fn(async () => {}),
    item,
    targets,
  },
  parameters: {
    a11y: { test: 'error' },
  },
};

export default meta;
type Story = StoryObj<typeof SendItemDialog>;

// Dialog renders in a portal on document.body — query the whole document.
function body(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    await screen.findByRole('dialog', { name: 'Send item' });
    const radios = screen.getAllByRole('radio');
    await expect(radios).toHaveLength(3);
    for (const radio of radios) {
      await expect(radio).not.toBeChecked();
    }
    const send = screen.getByRole('button', { name: 'Send item' });
    await expect(send).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Mira' }));
    await waitFor(() => expect(send).toBeEnabled());
  },
};

/**
 * At 390px the radio rows stay inside the dialog, and a long unbroken
 * character name neither pushes the dialog nor the page sideways.
 */
export const Phone: Story = {
  parameters: {
    viewport: {
      options: {
        phone: {
          name: 'Phone',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
      },
    },
  },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    const dialog = await screen.findByRole('dialog', { name: 'Send item' });
    const group = within(dialog).getByRole('radiogroup', { name: 'Send to' });
    const radios = within(group).getAllByRole('radio');
    // The dialog fades in; measure only once it is shown.
    await waitFor(() => {
      for (const radio of radios) expect(radio).toBeVisible();
    });
    // The DialogBody scrolls (overflow-y-auto forces overflow-x: auto), so the
    // dialog's own scrollWidth cannot catch a row that is too wide.
    const scroller = group.closest('.overflow-y-auto')!;
    await expect(scroller.scrollWidth).toBeLessThanOrEqual(
      scroller.clientWidth
    );
    for (const radio of radios) {
      await expect(
        radio.closest('label')!.getBoundingClientRect().right
      ).toBeLessThanOrEqual(dialog.getBoundingClientRect().right);
    }
    await expect(
      canvasElement.ownerDocument.documentElement.scrollWidth
    ).toBeLessThanOrEqual(390);
  },
};

export const NoPlayers: Story = {
  args: { targets: [], emptyMessage: 'No players in this campaign yet' },
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    await screen.findByRole('dialog', { name: 'Send item' });
    await waitFor(() =>
      expect(screen.getByText('No players in this campaign yet')).toBeVisible()
    );
    await expect(screen.queryByRole('radiogroup')).toBeNull();
  },
};
