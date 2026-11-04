import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { CampaignNav } from './CampaignNav';

const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  portrait: { name: 'Portrait', styles: { width: '820px', height: '1180px' } },
  landscape: {
    name: 'Landscape',
    styles: { width: '1180px', height: '820px' },
  },
};

const meta: Meta<typeof CampaignNav> = {
  title: 'Campaign/CampaignNav',
  component: CampaignNav,
  tags: ['autodocs'],
  parameters: {
    nextjs: { appDirectory: true },
    viewport: { options: VIEWPORTS },
    a11y: { test: 'error' },
  },
  args: { code: 'K7QX2M' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Row: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('link')).toHaveLength(4);
    const list = canvas.getByRole('list');
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
  },
};

export const Vertical: Story = {
  args: { vertical: true },
  decorators: [
    Story => (
      <div style={{ width: '17rem' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole('list');
    const links = canvas.getAllByRole('link');
    await expect(links).toHaveLength(4);
    for (const link of links) {
      await expect(
        Math.abs(
          link.getBoundingClientRect().width -
            list.getBoundingClientRect().width
        )
      ).toBeLessThanOrEqual(1);
    }
  },
};

export const RowDark: Story = {
  ...Row,
  globals: { ...Row.globals, theme: 'dark' },
};

export const VerticalDark: Story = {
  ...Vertical,
  globals: { theme: 'dark' },
};
