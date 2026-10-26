import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import {
  getHpBarColor,
  getHpNumberColor,
  getHpTierTextColor,
} from '@/utils/hpColor';
import { HP_STATUS_LABELS, hpPercent, hpStatus, hpTier } from '@/utils/hpState';
import { remountOnTheme } from './remountOnTheme';

/**
 * The HP tiers in paper and felt: the status word, the HP number and the
 * bar, all coloured through `src/utils/hpColor.ts`.
 */
const meta: Meta = {
  title: 'Foundations/HP tiers',
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

const MAX = 40;
const SAMPLES = [
  { current: 34, role: 'verdigris' },
  { current: 20, role: 'ember' },
  { current: 6, role: 'blood' },
  { current: 0, role: 'blood' },
] as const;

const THEMES = [
  { theme: 'light', label: 'Paper (light)' },
  { theme: 'dark', label: 'Felt (dark)' },
] as const;

function TierRow({
  current,
  role,
}: {
  current: number;
  role: (typeof SAMPLES)[number]['role'];
}) {
  const percent = hpPercent(current, MAX);
  return (
    <li className="space-y-1" data-sample={current}>
      <div className="flex items-baseline gap-2">
        <span
          data-part="number"
          className={`type-num-lg ${getHpNumberColor(current, MAX)}`}
        >
          {current}
        </span>
        <span className="type-body text-body">/ {MAX}</span>
        <span
          data-part="word"
          className={`type-ui ${getHpTierTextColor(hpTier(percent))}`}
        >
          {HP_STATUS_LABELS[hpStatus(current, MAX)]}
        </span>
      </div>
      <div className="bg-divider h-1 w-full">
        <div
          data-part="bar"
          className={`h-full ${getHpBarColor(current, MAX)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {/* Reference swatches the play test compares against. */}
      <span
        hidden
        data-probe="fill"
        style={{ backgroundColor: `var(--${role}-fill)` }}
      />
      <span hidden data-probe="text" style={{ color: `var(--${role}-text)` }} />
    </li>
  );
}

function HpTiersPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {THEMES.map(({ theme, label }) => (
        <section
          key={theme}
          data-theme={theme}
          className="bg-background border-divider space-y-4 rounded-md border p-4"
        >
          <h2 className="type-heading text-heading">{label}</h2>
          <ul className="space-y-4">
            {SAMPLES.map(sample => (
              <TierRow key={sample.current} {...sample} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const colour = (el: Element, prop: 'color' | 'backgroundColor') =>
  getComputedStyle(el)[prop];

async function checkTiers(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  for (const { label } of THEMES) {
    const panel = canvas
      .getByRole('heading', { name: label })
      .closest<HTMLElement>('[data-theme]')!;
    for (const { current } of SAMPLES) {
      const row = panel.querySelector(`[data-sample="${current}"]`)!;
      const fill = colour(
        row.querySelector('[data-probe="fill"]')!,
        'backgroundColor'
      );
      const text = colour(row.querySelector('[data-probe="text"]')!, 'color');
      // The bar is the tier's role fill and the word its role text.
      await expect(
        colour(row.querySelector('[data-part="bar"]')!, 'backgroundColor')
      ).toBe(fill);
      await expect(
        colour(row.querySelector('[data-part="word"]')!, 'color')
      ).toBe(text);
    }
    // A healthy HP number stays the heading colour; lower tiers take the role.
    const heading = colour(panel.querySelector('h2')!, 'color');
    const healthy = panel.querySelector('[data-sample="34"]')!;
    await expect(
      colour(healthy.querySelector('[data-part="number"]')!, 'color')
    ).toBe(heading);
    const bloodied = panel.querySelector('[data-sample="20"]')!;
    await expect(
      colour(bloodied.querySelector('[data-part="number"]')!, 'color')
    ).toBe(colour(bloodied.querySelector('[data-probe="text"]')!, 'color'));
  }
  await expect(canvas.getAllByText('Down')).toHaveLength(2);
}

export const HpTiers: Story = {
  render: () => <HpTiersPage />,
  play: async ({ canvasElement }) => checkTiers(canvasElement),
};
