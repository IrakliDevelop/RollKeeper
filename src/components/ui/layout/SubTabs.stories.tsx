import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { SubTabs } from './SubTabs';
const meta: Meta<typeof SubTabs> = {
  title: 'Layout/SubTabs',
  component: SubTabs,
  parameters: { a11y: { test: 'error' } },
  args: {
    label: 'Inventory',
    defaultValue: 'weapons',
    tabs: [
      {
        id: 'story-weapons',
        value: 'weapons',
        label: 'Weapons',
        content: <p>Longsword</p>,
      },
      {
        id: 'story-items',
        value: 'items',
        label: 'Items',
        content: <p>Rope</p>,
      },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'Items' }));
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Rope');
  },
};
export const Dark: Story = { ...Light, globals: { theme: 'dark' } };

export const TouchTabs: Story = {
  beforeEach: () => emulateCoarsePointer(),
  play: async ({ canvasElement }) => {
    for (const tab of within(canvasElement).getAllByRole('tab')) {
      await expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(
        44
      );
    }
  },
};
