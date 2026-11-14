import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, waitFor, within } from 'storybook/test';

import FeatureModal from './FeatureModal';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import type { ExtendedFeature } from '@/types/character';

const BASE: ExtendedFeature = {
  id: 'feat-second-wind',
  name: 'Second Wind',
  sourceType: 'class',
  sourceDetail: 'Fighter 1',
  maxUses: 0,
  usedUses: 1,
  scaleWithProficiency: true,
  proficiencyMultiplier: 1,
  restType: 'short',
  category: 'Healing',
  description:
    '<p>Regain hit points equal to <strong>1d10 + your fighter level</strong>.</p><ul><li>Bonus action</li><li>Once per short rest</li></ul>',
  displayOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const LONG_URL = 'https://example.test/' + 'a'.repeat(80);

const meta: Meta<typeof FeatureModal> = {
  title: 'Character/FeatureModal',
  component: FeatureModal,
  tags: ['autodocs'],
  args: { isOpen: true, characterLevel: 5, onClose: fn() },
  parameters: { a11y: { test: 'error', context: { include: ['body'] } } },
};
export default meta;

type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

/** The dialog zooms and fades in; measure and assert visibility after that. */
async function openDialog(name: string) {
  const dialog = await body().findByRole('dialog', { name });
  await waitFor(() => expect(dialog.getAnimations()).toHaveLength(0));
  return dialog;
}

export const Limited: Story = {
  args: { feature: BASE },
  play: async () => {
    const screen = body();
    await expect(await openDialog('Second Wind')).toBeVisible();
    await expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' && el.textContent === '2 of 3 uses remaining'
      )
    ).toBeVisible();
    await expect(screen.getByText('Recharges on a short rest')).toBeVisible();
    await expect(screen.getAllByRole('listitem')).toHaveLength(2);
    await expect(screen.getByText('Proficiency bonus × 1')).toBeVisible();
  },
};

export const Passive: Story = {
  args: {
    feature: {
      ...BASE,
      id: 'feat-darkvision',
      name: 'Darkvision',
      sourceType: 'race',
      sourceDetail: undefined,
      isPassive: true,
      maxUses: 0,
      scaleWithProficiency: false,
      category: undefined,
      description: '<p>You can see in dim light within 60 feet.</p>',
    },
  },
  play: async () => {
    const screen = body();
    await openDialog('Darkvision');
    await expect(
      screen.getByText('Passive ability - always active')
    ).toBeVisible();
    await expect(screen.queryByText(/^Recharges on/)).toBeNull();
  },
};

export const Unlimited: Story = {
  args: {
    feature: {
      ...BASE,
      id: 'feat-unlimited',
      name: 'Fighting Style',
      maxUses: 0,
      usedUses: 0,
      isPassive: false,
      scaleWithProficiency: false,
      category: undefined,
      description: undefined,
    },
  },
  play: async () => {
    const screen = body();
    await openDialog('Fighting Style');
    await expect(screen.getByText('Unlimited uses')).toBeVisible();
    await expect(
      screen.queryByRole('heading', { name: 'Description' })
    ).toBeNull();
  },
};

export const Dark: Story = {
  args: Limited.args,
  globals: { theme: 'dark' },
};

export const Blue: Story = {
  args: Limited.args,
  globals: { theme: 'blue' },
};

const phone = {
  viewport: {
    options: {
      phone: {
        name: 'Phone',
        styles: { width: '390px', height: '844px' },
        type: 'mobile',
      },
    },
  },
};

export const Phone: Story = {
  args: {
    feature: {
      ...BASE,
      description: `<p>See <a href="${LONG_URL}">${LONG_URL}</a></p>`,
    },
  },
  parameters: { ...meta.parameters, ...phone },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async () => {
    await openDialog('Second Wind');
    const region = body().getByRole('region', { name: 'Description' });
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth);
  },
};

export const Touch: Story = {
  args: Limited.args,
  parameters: { ...meta.parameters, ...phone },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async () => {
    await openDialog('Second Wind');
    const restore = emulateCoarsePointer();
    try {
      const rect = body()
        .getByRole('button', { name: 'Close' })
        .getBoundingClientRect();
      await expect(rect.height).toBeGreaterThanOrEqual(44);
      await expect(rect.width).toBeGreaterThanOrEqual(44);
    } finally {
      restore();
    }
  },
};
