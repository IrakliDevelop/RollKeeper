import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { CurrencyManager } from './CurrencyManager';
import type { Currency } from '@/types/character';

const sampleCurrency: Currency = {
  copper: 150,
  silver: 45,
  electrum: 10,
  gold: 78,
  platinum: 3,
};

const meta: Meta<typeof CurrencyManager> = {
  component: CurrencyManager,
  tags: ['autodocs'],
  args: {
    currency: sampleCurrency,
    onAddCurrency: fn(),
    onSubtractCurrency: fn(),
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

export const WithCurrency: Story = {};

export const WithCurrencyDark: Story = {
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
