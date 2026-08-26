import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ConditionBadge } from './ConditionBadge';

const meta: Meta<typeof ConditionBadge> = {
  component: ConditionBadge,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: { name: 'Poisoned', onRemove: fn() },
};

export const BasicDark: Story = {
  ...Basic,
  globals: { theme: 'dark' },
};

export const WithStackCount: Story = {
  args: { name: 'Exhaustion', stackCount: 3, onRemove: fn() },
};

export const WithStackCountDark: Story = {
  ...WithStackCount,
  globals: { theme: 'dark' },
};

export const WithSourceSpell: Story = {
  args: { name: 'Frightened', sourceSpell: 'Fear', onRemove: fn() },
};

export const WithSourceSpellDark: Story = {
  ...WithSourceSpell,
  globals: { theme: 'dark' },
};
