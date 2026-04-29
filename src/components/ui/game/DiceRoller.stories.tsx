import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { vi } from 'vitest';
import { DiceRoller } from './DiceRoller';

vi.mock('@/hooks/useDiceRoller', () => ({
  useDiceRoller: () => ({
    isInitialized: true,
    isRolling: false,
    rollHistory: [],
    roll: async () => null,
    clearDice: () => {},
    clearHistory: () => {},
    setAutoClearDelay: () => {},
    autoClearDelay: 10000,
  }),
}));

const meta: Meta<typeof DiceRoller> = {
  component: DiceRoller,
  tags: ['autodocs'],
  args: {
    onRollResult: fn(),
  },
  decorators: [
    Story => (
      <div style={{ maxWidth: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const ReadyDark: Story = {
  globals: { theme: 'dark' },
};

export const CustomButtons: Story = {
  args: {
    quickButtons: [
      {
        label: '1d20',
        notation: '1d20',
        color: 'bg-blue-500 hover:bg-blue-600',
      },
      {
        label: '1d8+3',
        notation: '1d8+3',
        color: 'bg-green-500 hover:bg-green-600',
      },
      {
        label: '2d6',
        notation: '2d6',
        color: 'bg-purple-500 hover:bg-purple-600',
      },
      { label: '8d6', notation: '8d6', color: 'bg-red-500 hover:bg-red-600' },
      {
        label: '1d100',
        notation: '1d100',
        color: 'bg-amber-500 hover:bg-amber-600',
      },
    ],
  },
};

export const CustomButtonsDark: Story = {
  ...CustomButtons,
  globals: { theme: 'dark' },
};
