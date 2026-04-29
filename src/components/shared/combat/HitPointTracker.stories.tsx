import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { HitPointTracker } from './HitPointTracker';
import type { HitPoints } from '@/types/character';

const baseHitPoints: HitPoints = {
  current: 25,
  max: 40,
  temporary: 5,
  calculationMode: 'auto' as const,
  deathSaves: { successes: 0, failures: 0, isStabilized: false },
};

const meta: Meta<typeof HitPointTracker> = {
  component: HitPointTracker,
  tags: ['autodocs'],
  args: {
    hitPoints: baseHitPoints,
    onApplyDamage: fn(),
    onApplyHealing: fn(),
    onAddTemporaryHP: fn(),
    onMakeDeathSave: fn(),
    onResetDeathSaves: fn(),
    onToggleCalculationMode: fn(),
    onUpdateHitPoints: fn(),
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

export const Healthy: Story = {};

export const HealthyDark: Story = {
  globals: { theme: 'dark' },
};

export const Dying: Story = {
  args: {
    hitPoints: {
      ...baseHitPoints,
      current: 0,
      temporary: 0,
    },
  },
};

export const DyingDark: Story = {
  ...Dying,
  globals: { theme: 'dark' },
};

export const Dead: Story = {
  args: {
    hitPoints: {
      ...baseHitPoints,
      current: 0,
      temporary: 0,
      deathSaves: { successes: 0, failures: 3, isStabilized: false },
    },
  },
};

export const DeadDark: Story = {
  ...Dead,
  globals: { theme: 'dark' },
};

export const Stabilized: Story = {
  args: {
    hitPoints: {
      ...baseHitPoints,
      current: 0,
      temporary: 0,
      deathSaves: { successes: 3, failures: 0, isStabilized: true },
    },
  },
};

export const StabilizedDark: Story = {
  ...Stabilized,
  globals: { theme: 'dark' },
};

export const Readonly: Story = {
  args: { readonly: true },
};

export const ReadonlyDark: Story = {
  ...Readonly,
  globals: { theme: 'dark' },
};

export const Compact: Story = {
  args: { compact: true },
};

export const CompactDark: Story = {
  ...Compact,
  globals: { theme: 'dark' },
};
