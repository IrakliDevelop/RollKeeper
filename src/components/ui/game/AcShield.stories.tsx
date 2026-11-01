import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { remountOnTheme } from '@/components/ui/foundations/remountOnTheme';
import { AcShield } from './AcShield';

/**
 * Armor class in a brass shield outline, the one icon-shaped container in
 * the design system. The vitals strip places it with an "AC" caption.
 */
const meta: Meta = {
  title: 'Game/AC shield',
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

const VALUES = [9, 16, 21] as const;

const THEMES = [
  { theme: 'light', label: 'Paper (light)' },
  { theme: 'dark', label: 'Felt (dark)' },
] as const;

function ShieldPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {THEMES.map(({ theme, label }) => (
        <section
          key={theme}
          data-theme={theme}
          className="bg-background border-divider space-y-4 rounded-md border p-4"
        >
          <h2 className="type-heading text-heading">{label}</h2>
          <ul className="flex gap-6">
            {VALUES.map(value => (
              <li key={value} className="flex flex-col items-center gap-1">
                <AcShield value={value} />
                <span className="type-caption text-muted">AC</span>
              </li>
            ))}
          </ul>
          {/* Reference swatches the play test compares against. */}
          <span
            hidden
            data-probe="brass"
            style={{ color: 'var(--brass-border)' }}
          />
          <span
            hidden
            data-probe="heading"
            style={{ color: 'var(--heading)' }}
          />
        </section>
      ))}
    </div>
  );
}

export const Shield: Story = {
  render: () => <ShieldPage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const { label } of THEMES) {
      const panel = canvas
        .getByRole('heading', { name: label })
        .closest<HTMLElement>('[data-theme]')!;
      const probe = (name: string) =>
        getComputedStyle(panel.querySelector(`[data-probe="${name}"]`)!).color;
      for (const shield of Array.from(
        panel.querySelectorAll<HTMLElement>('[data-ac-shield]')
      )) {
        const outline = getComputedStyle(shield.querySelector('svg')!);
        await expect(outline.stroke).toBe(probe('brass'));
        await expect(outline.fill).toBe('none');
        const stroke = getComputedStyle(shield.querySelector('path')!);
        await expect(stroke.strokeWidth).toBe('1.75px');
        const number = shield.querySelector('span')!;
        const style = getComputedStyle(number);
        await expect(style.color).toBe(probe('heading'));
        await expect(style.fontSize).toBe('26px');
        await expect(style.fontFamily).toMatch(/Barlow Condensed/);
        // The shield is 48×52 and the number sits inside its box.
        const box = shield.getBoundingClientRect();
        await expect(box.width).toBe(48);
        await expect(box.height).toBe(52);
        const text = number.getBoundingClientRect();
        await expect(text.left).toBeGreaterThan(box.left);
        await expect(text.right).toBeLessThan(box.right);
        await expect(text.top).toBeGreaterThan(box.top);
        await expect(text.bottom).toBeLessThan(box.bottom);
      }
    }
  },
};
