import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { Switch } from '@/components/ui/forms/switch';
import type { Currency } from '@/types/character';
import { NPCCurrencyStrip } from './NPCCurrencyStrip';

const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  portrait: { name: 'Portrait', styles: { width: '820px', height: '1180px' } },
};

const PURSE: Currency = {
  platinum: 2,
  gold: 1250,
  electrum: 0,
  silver: 34,
  copper: 7,
};

const meta: Meta<typeof NPCCurrencyStrip> = {
  title: 'Campaign/NPCCurrencyStrip',
  component: NPCCurrencyStrip,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof NPCCurrencyStrip>;

function EditableStrip({ label }: { label?: string }) {
  const [currency, setCurrency] = useState(PURSE);
  return (
    <NPCCurrencyStrip
      currency={currency}
      label={label}
      onChange={(type, amount) =>
        setCurrency(current => ({ ...current, [type]: amount }))
      }
    />
  );
}

export const Editable: Story = {
  render: () => <EditableStrip />,
};

export const ReadOnly: Story = {
  args: { currency: PURSE, readonly: true },
};

/** The strip as the Shop tab places it: beside the "Open for business" block. */
function InShopRowLayout() {
  const [open, setOpen] = useState(true);
  return (
    <div
      data-testid="shop-row"
      className="flex flex-wrap items-stretch justify-between gap-4"
    >
      <div className="flex flex-1 items-center gap-3 rounded-lg border p-3">
        <Switch
          checked={open}
          onCheckedChange={setOpen}
          aria-label="Open for business"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-heading text-sm font-semibold">
            Open for business
          </span>
          <span className="text-body text-xs">
            Brenn is selling 4 items to players.
          </span>
        </div>
      </div>
      <EditableStrip label="Merchant's purse" />
    </div>
  );
}

const COIN_BOXES = [
  'PP (platinum pieces)',
  'GP (gold pieces)',
  'EP (electrum pieces)',
  'SP (silver pieces)',
  'CP (copper pieces)',
];

const playFitsViewport: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  for (const name of COIN_BOXES) {
    const box = canvas.getByRole('textbox', { name });
    await expect(box.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
  }
  const strip = canvas.getByRole('region', { name: 'NPC currency' });
  await expect(strip.scrollWidth).toBeLessThanOrEqual(strip.clientWidth);
  const row = canvas.getByTestId('shop-row');
  await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
    window.innerWidth
  );
};

export const InShopRow: Story = {
  render: () => <InShopRowLayout />,
  parameters: { viewport: { options: VIEWPORTS } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: playFitsViewport,
};

export const InShopRowPortrait: Story = {
  render: () => <InShopRowLayout />,
  parameters: { viewport: { options: VIEWPORTS } },
  globals: { viewport: { value: 'portrait', isRotated: false } },
  play: playFitsViewport,
};
