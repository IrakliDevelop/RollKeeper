import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { HeroicInspirationTracker } from './HeroicInspirationTracker';
import type { HeroicInspiration } from '@/types/character';

const baseInspiration: HeroicInspiration = {
  count: 2,
  maxCount: 5,
};

const meta: Meta<typeof HeroicInspirationTracker> = {
  component: HeroicInspirationTracker,
  tags: ['autodocs'],
  args: {
    inspiration: baseInspiration,
    onUpdateInspiration: fn(),
    onAddInspiration: fn(),
    onUseInspiration: fn(),
    onResetInspiration: fn(),
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

export const WithDice: Story = {};

export const WithDiceDark: Story = {
  globals: { theme: 'dark' },
};

export const Empty: Story = {
  args: {
    inspiration: { count: 0, maxCount: 5 },
  },
};

export const EmptyDark: Story = {
  ...Empty,
  globals: { theme: 'dark' },
};

export const AtMax: Story = {
  args: {
    inspiration: { count: 5, maxCount: 5 },
  },
};

export const AtMaxDark: Story = {
  ...AtMax,
  globals: { theme: 'dark' },
};
