import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { SpellSlotTracker } from './SpellSlotTracker';
import type { SpellSlots, PactMagic } from '@/types/character';

const baseSpellSlots: SpellSlots = {
  1: { max: 4, used: 2 },
  2: { max: 3, used: 1 },
  3: { max: 3, used: 0 },
  4: { max: 3, used: 1 },
  5: { max: 3, used: 0 },
  6: { max: 1, used: 0 },
  7: { max: 1, used: 0 },
  8: { max: 1, used: 0 },
  9: { max: 1, used: 0 },
};

const allUsedSpellSlots: SpellSlots = {
  1: { max: 4, used: 4 },
  2: { max: 3, used: 3 },
  3: { max: 3, used: 3 },
  4: { max: 3, used: 3 },
  5: { max: 3, used: 3 },
  6: { max: 1, used: 1 },
  7: { max: 1, used: 1 },
  8: { max: 1, used: 1 },
  9: { max: 1, used: 1 },
};

const pactMagic: PactMagic = {
  slots: { max: 2, used: 1 },
  level: 3,
};

const meta: Meta<typeof SpellSlotTracker> = {
  component: SpellSlotTracker,
  tags: ['autodocs'],
  args: {
    spellSlots: baseSpellSlots,
    onSpellSlotChange: fn(),
    onPactMagicChange: fn(),
    onResetSpellSlots: fn(),
    onResetPactMagic: fn(),
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

export const MixedSlots: Story = {};

export const MixedSlotsDark: Story = {
  globals: { theme: 'dark' },
};

export const AllUsed: Story = {
  args: { spellSlots: allUsedSpellSlots },
};

export const AllUsedDark: Story = {
  ...AllUsed,
  globals: { theme: 'dark' },
};

export const WithPactMagic: Story = {
  args: { pactMagic },
};

export const WithPactMagicDark: Story = {
  ...WithPactMagic,
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
