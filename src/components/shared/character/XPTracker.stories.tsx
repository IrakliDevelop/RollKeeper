import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { XPTracker } from './XPTracker';

const meta: Meta<typeof XPTracker> = {
  component: XPTracker,
  tags: ['autodocs'],
  args: {
    onAddXP: fn(),
    onSetXP: fn(),
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

export const MidLevel: Story = {
  args: { currentXP: 7500, currentLevel: 5 },
};

export const MidLevelDark: Story = {
  ...MidLevel,
  globals: { theme: 'dark' },
};

export const NearLevelUp: Story = {
  args: { currentXP: 6400, currentLevel: 4 },
};

export const NearLevelUpDark: Story = {
  ...NearLevelUp,
  globals: { theme: 'dark' },
};

export const Readonly: Story = {
  args: { currentXP: 7500, currentLevel: 5, readonly: true },
};

export const ReadonlyDark: Story = {
  ...Readonly,
  globals: { theme: 'dark' },
};
