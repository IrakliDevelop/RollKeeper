import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, within } from 'storybook/test';
import { CampaignSettingsSection } from './CampaignSettingsSection';

const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  portrait: { name: 'Portrait', styles: { width: '820px', height: '1180px' } },
  landscape: {
    name: 'Landscape',
    styles: { width: '1180px', height: '820px' },
  },
};

const meta: Meta<typeof CampaignSettingsSection> = {
  title: 'Campaign/CampaignSettingsSection',
  component: CampaignSettingsSection,
  tags: ['autodocs'],
  parameters: {
    viewport: { options: VIEWPORTS },
    a11y: { test: 'error' },
  },
  args: {
    campaignCode: 'K7QX2M',
    open: true,
    onOpenChange: fn(),
    onBannerChange: fn(),
    stackableInspiration: true,
    onStackableInspirationChange: fn(),
    customCounterLabel: 'Desperation',
    onCustomCounterLabelChange: fn(),
    npcSpellSlotMode: 'inline',
    onNpcSpellSlotModeChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Add image' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('switch', { name: 'Stackable heroic inspiration' })
    ).toBeChecked();
    await expect(
      canvas.getByRole('textbox', { name: 'Player counter' })
    ).toHaveValue('Desperation');
    await expect(
      canvas.getByRole('radio', { name: 'Beside each spell level' })
    ).toBeChecked();
  },
};

export const BannerSet: Story = {
  args: { bannerUrl: '/landing/battle-map.webp' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Change image' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Remove image' })
    ).toBeInTheDocument();
  },
};

export const BannerSetRail: Story = {
  ...BannerSet,
  globals: { viewport: { value: 'landscape', isRotated: false } },
  decorators: [
    Story => (
      <div style={{ width: '17rem' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const change = canvas.getByRole('button', { name: 'Change image' });
    const remove = canvas.getByRole('button', { name: 'Remove image' });
    await expect(
      Math.abs(
        change.getBoundingClientRect().width -
          remove.getBoundingClientRect().width
      )
    ).toBeLessThanOrEqual(1);
    // The buttons fill the rail, not just match each other.
    const row = change.closest('.pb-4') as HTMLElement;
    await expect(
      Math.abs(
        change.getBoundingClientRect().width - row.getBoundingClientRect().width
      )
    ).toBeLessThanOrEqual(1);
  },
};

export const OpenDark: Story = {
  ...Open,
  globals: { theme: 'dark' },
};

export const Collapsed: Story = {
  args: { open: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Campaign settings' })
    ).toHaveAttribute('aria-expanded', 'false');
  },
};
