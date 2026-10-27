import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { remountOnTheme } from '@/components/ui/foundations/remountOnTheme';
import { SlotPips, type SlotLevel } from './SlotPips';

/**
 * Spell slot pips: 10px lapis circles, filled while a slot is available and
 * hollow once it is spent. Display only for now; the spell slot tracker
 * adopts them in the character sheet sweep.
 */
const meta: Meta = {
  title: 'Game/Spell slot pips',
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

const ROWS: {
  caption: string;
  level: SlotLevel;
  total: number;
  available: number;
}[] = [
  { caption: 'Level 1', level: 1, total: 4, available: 4 },
  { caption: 'Level 2', level: 2, total: 3, available: 1 },
  { caption: 'Level 3', level: 3, total: 2, available: 0 },
  { caption: 'Pact slots', level: 'pact', total: 2, available: 1 },
];

const THEMES = [
  { theme: 'light', label: 'Paper (light)' },
  { theme: 'dark', label: 'Felt (dark)' },
] as const;

function PipsPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {THEMES.map(({ theme, label }) => (
        <section
          key={theme}
          data-theme={theme}
          className="bg-background border-divider space-y-4 rounded-md border p-4"
        >
          <h2 className="type-heading text-heading">{label}</h2>
          <ul className="space-y-2">
            {ROWS.map(row => (
              <li key={row.caption} className="flex items-center gap-3">
                <span className="type-ui text-body w-24">{row.caption}</span>
                <SlotPips
                  total={row.total}
                  available={row.available}
                  level={row.level}
                />
              </li>
            ))}
          </ul>
          {/* Reference swatches the play test compares against. */}
          <span
            hidden
            data-probe="fill"
            style={{ backgroundColor: 'var(--lapis-fill)' }}
          />
          <span
            hidden
            data-probe="border"
            style={{ borderColor: 'var(--lapis-border)' }}
          />
        </section>
      ))}
    </div>
  );
}

export const Pips: Story = {
  render: () => <PipsPage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const { label } of THEMES) {
      const panel = canvas
        .getByRole('heading', { name: label })
        .closest<HTMLElement>('[data-theme]')!;
      const fill = getComputedStyle(
        panel.querySelector('[data-probe="fill"]')!
      ).backgroundColor;
      const border = getComputedStyle(
        panel.querySelector('[data-probe="border"]')!
      ).borderTopColor;
      const row = within(panel).getByRole('img', {
        name: '1 of 3 level 2 slots available',
      });
      const [available, spent] = Array.from(row.children);
      await expect(available).toHaveAttribute('data-state', 'available');
      await expect(getComputedStyle(available).backgroundColor).toBe(fill);
      await expect(spent).toHaveAttribute('data-state', 'spent');
      await expect(getComputedStyle(spent).backgroundColor).toBe(
        'rgba(0, 0, 0, 0)'
      );
      for (const pip of [available, spent]) {
        await expect(getComputedStyle(pip).borderTopColor).toBe(border);
        const box = pip.getBoundingClientRect();
        await expect(box.width).toBe(10);
        await expect(box.height).toBe(10);
      }
      await expect(
        within(panel).getByRole('img', { name: '1 of 2 pact slots available' })
      ).toBeInTheDocument();
    }
  },
};
