import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { DockBuffs } from './DockBuffs';
import type { TemporaryBuff } from '@/types/character';

function buff(partial: Partial<TemporaryBuff>): TemporaryBuff {
  return {
    id: 'b1',
    name: 'Mage Armor',
    effects: [{ id: 'e1', targetStat: 'ac', mode: 'set', value: 13 }],
    isActive: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...partial,
  };
}

const meta: Meta<typeof DockBuffs> = {
  title: 'Campaign/PlayerVtt/DockBuffs',
  component: DockBuffs,
  args: { onToggleBuff: fn() },
};
export default meta;

type Story = StoryObj<typeof DockBuffs>;

export const MixedActiveStates: Story = {
  args: {
    buffs: [
      buff({ id: 'b1', name: 'Mage Armor', isActive: true }),
      buff({
        id: 'b2',
        name: 'Shield',
        isActive: false,
        effects: [{ id: 'e2', targetStat: 'ac', mode: 'add', value: 5 }],
      }),
    ],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const mageArmor = canvas.getByRole('button', { name: /mage armor/i });
    const shield = canvas.getByRole('button', { name: /shield/i });
    await expect(mageArmor).toHaveAttribute('aria-pressed', 'true');
    await expect(shield).toHaveAttribute('aria-pressed', 'false');
    await expect(shield).toHaveAttribute('title', '+5 AC');
    await expect(shield).toHaveTextContent('+5 AC');
    await userEvent.click(shield);
    await expect(args.onToggleBuff).toHaveBeenCalledWith('b2');
  },
};

export const NoBuffsRendersNothing: Story = {
  args: { buffs: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('button')).toBeNull();
  },
};
