import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { QuickCombatStrip } from './QuickCombatStrip';

const meta: Meta<typeof QuickCombatStrip> = {
  title: 'Campaign/PlayerVtt/QuickCombatStrip',
  component: QuickCombatStrip,
  args: {
    hasUsedReaction: false,
    onToggleReaction: fn(),
    count: 1,
    maxCount: 1,
    stackable: false,
    onUse: fn(),
    onIncrement: fn(),
    onDecrement: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof QuickCombatStrip>;

export const ReactionAvailable: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const reaction = canvas.getByRole('button', { name: /use reaction/i });
    await expect(reaction).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(reaction);
    await expect(args.onToggleReaction).toHaveBeenCalledTimes(1);
  },
};

export const ReactionUsed: Story = {
  args: { hasUsedReaction: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const reaction = canvas.getByRole('button', {
      name: /reaction used — tap to reset/i,
    });
    await expect(reaction).toHaveAttribute('aria-pressed', 'true');
    await expect(reaction).toHaveTextContent(/used/i);
    await userEvent.click(reaction);
    await expect(args.onToggleReaction).toHaveBeenCalledTimes(1);
  },
};

export const InspirationAtCap: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: /use heroic inspiration/i })
    );
    await expect(args.onUse).toHaveBeenCalledTimes(1);
    // At count === maxCount the award button is hidden; correction − shows.
    await expect(
      canvas.queryByRole('button', { name: /add heroic inspiration/i })
    ).toBeNull();
    await userEvent.click(
      canvas.getByRole('button', { name: /remove heroic inspiration/i })
    );
    await expect(args.onDecrement).toHaveBeenCalledTimes(1);
  },
};

export const InspirationEmpty: Story = {
  args: { count: 0 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: /use heroic inspiration/i })
    ).toBeDisabled();
    await expect(
      canvas.queryByRole('button', { name: /remove heroic inspiration/i })
    ).toBeNull();
    await userEvent.click(
      canvas.getByRole('button', { name: /add heroic inspiration/i })
    );
    await expect(args.onIncrement).toHaveBeenCalledTimes(1);
  },
};

export const StackableShowsCount: Story = {
  args: { count: 3, maxCount: 5, stackable: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: /use heroic inspiration/i })
    ).toHaveTextContent('×3');
  },
};
