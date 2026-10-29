import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import CombatStats from './CombatStats';

const meta: Meta<typeof CombatStats> = {
  title: 'Character/CombatStats',
  component: CombatStats,
  tags: ['autodocs'],
  args: {
    character: makeCharacter({
      initiative: { value: 3, isOverridden: true },
      flySpeed: 60,
    }),
    editing: true,
    getInitiativeModifier: () => 3,
    onUpdateInitiative: fn(),
    onResetInitiativeToDefault: fn(),
    onUpdateSpeed: fn(),
    onUpdateCharacter: fn(),
    onToggleReaction: fn(),
    onResetReaction: fn(),
    onRollInitiative: fn(),
  },
  decorators: [
    Story => (
      <div style={{ width: 343, maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

async function checkTargets(canvasElement: HTMLElement, coarse: boolean) {
  const canvas = within(canvasElement);
  const input = canvas.getByRole('textbox', { name: 'Initiative' });
  const label = input.parentElement!;
  const rect = label.getBoundingClientRect();
  const target = getComputedStyle(label, '::after');
  const width = Math.max(parseFloat(target.width), parseFloat(target.minWidth));
  const right = rect.left + rect.width / 2 + width / 2;
  const roll = canvas.getByRole('button', {
    name: 'Roll initiative (d20 + 3)',
  });
  const rollBox = roll.getBoundingClientRect();
  await expect(width).toBeGreaterThanOrEqual(coarse ? 44 : 24);
  await expect(rollBox.left).toBeGreaterThanOrEqual(right);
  await expect(rollBox.height).toBeGreaterThanOrEqual(coarse ? 44 : 24);
  const reset = canvas.getByRole('button', {
    name: 'Reset to Dexterity modifier',
  });
  await expect(reset.getBoundingClientRect().right).toBeLessThanOrEqual(
    reset.parentElement!.getBoundingClientRect().right + 1
  );
}
async function checkBoth(canvasElement: HTMLElement) {
  await checkTargets(canvasElement, false);
  const restore = emulateCoarsePointer();
  try {
    await checkTargets(canvasElement, true);
  } finally {
    restore();
  }
}
export const Narrow: Story = {
  play: ({ canvasElement }) => checkBoth(canvasElement),
};
export const NarrowDark: Story = { ...Narrow, globals: { theme: 'dark' } };
