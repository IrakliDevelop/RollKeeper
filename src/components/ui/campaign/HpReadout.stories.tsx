import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { HpReadout } from './HpReadout';

const meta: Meta<typeof HpReadout> = {
  title: 'Campaign/HpReadout',
  component: HpReadout,
  tags: ['autodocs'],
  parameters: { a11y: { test: 'error' } },
  render: () => (
    <div className="max-w-xs space-y-4">
      <HpReadout current={44} max={44} />
      <HpReadout current={30} max={44} temp={5} />
      <HpReadout current={5} max={44} />
      <HpReadout current={0} max={44} />
      <HpReadout current={30} max={44} size="sm" />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Tiers: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Bloodied')).toHaveLength(2);
    await expect(canvas.getByText('+5 temp HP')).toBeInTheDocument();
    await expect(canvas.getByText('Down')).toBeInTheDocument();
  },
};

export const TiersDark: Story = {
  ...Tiers,
  globals: { theme: 'dark' },
};

export const TiersBlue: Story = {
  ...Tiers,
  globals: { theme: 'blue' },
};
