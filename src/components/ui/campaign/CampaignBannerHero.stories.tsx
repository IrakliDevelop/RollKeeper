import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, within } from 'storybook/test';
import { CampaignBannerHero } from './CampaignBannerHero';

const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  portrait: { name: 'Portrait', styles: { width: '820px', height: '1180px' } },
  landscape: {
    name: 'Landscape',
    styles: { width: '1180px', height: '820px' },
  },
};

const meta: Meta<typeof CampaignBannerHero> = {
  title: 'Campaign/CampaignBannerHero',
  component: CampaignBannerHero,
  tags: ['autodocs'],
  parameters: {
    nextjs: { appDirectory: true },
    viewport: { options: VIEWPORTS },
    a11y: { test: 'error' },
  },
  args: {
    code: 'K7QX2M',
    bannerUrl: '/landing/battle-map.webp',
    onBannerChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

async function expectInsideViewport(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const links = canvas.getAllByRole('link');
  await expect(links).toHaveLength(4);
  for (const link of links) {
    const rect = link.getBoundingClientRect();
    await expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
    await expect(rect.height).toBeGreaterThanOrEqual(44);
  }
}

export const Landscape: Story = {
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expectInsideViewport(canvasElement);
    const canvas = within(canvasElement);
    const banner = canvasElement.querySelector('img')!.parentElement!;
    const locations = canvas.getByRole('link', { name: 'Locations' });
    const calendar = canvas.getByRole('link', { name: 'Calendar' });
    // The links flank the banner on wide screens.
    await expect(locations.getBoundingClientRect().right).toBeLessThanOrEqual(
      banner.getBoundingClientRect().left
    );
    await expect(calendar.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      banner.getBoundingClientRect().right
    );
  },
};

export const Portrait: Story = {
  globals: { viewport: { value: 'portrait', isRotated: false } },
  play: async ({ canvasElement }) => expectInsideViewport(canvasElement),
};

export const Phone: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expectInsideViewport(canvasElement);
    const canvas = within(canvasElement);
    const banner = canvasElement.querySelector('img')!.parentElement!;
    // The banner sits above the links on narrow screens.
    await expect(
      canvas.getByRole('link', { name: 'Locations' }).getBoundingClientRect()
        .top
    ).toBeGreaterThanOrEqual(banner.getBoundingClientRect().bottom);
  },
};

export const NoBanner: Story = {
  args: { bannerUrl: undefined },
  globals: { viewport: { value: 'landscape', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No banner image yet')).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Add image' })
    ).toBeInTheDocument();
  },
};

export const NoBannerPhone: Story = {
  ...NoBanner,
  globals: { viewport: { value: 'phone', isRotated: false } },
};
