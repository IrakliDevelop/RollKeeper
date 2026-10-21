import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { remountOnTheme } from '@/components/ui/foundations/remountOnTheme';
import { useComputedValue } from '@/components/ui/foundations/useComputedValue';
import { TYPE_SCALE_STEPS } from '@/utils/cn';

/**
 * The Felt and Brass type scale. Each `type-<step>` class sets the family,
 * size, line height and weight together. Headings are Vollkorn, body and UI
 * text Barlow, and the num-* steps Barlow Condensed with lining tabular
 * figures.
 */
const meta: Meta = {
  title: 'Foundations/Type scale',
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Literal class names: Tailwind only generates utilities it finds in source.
const STEPS: Record<
  (typeof TYPE_SCALE_STEPS)[number],
  { className: string; sample: string }
> = {
  title: { className: 'type-title', sample: 'Thorin Oakenshield' },
  heading: { className: 'type-heading', sample: 'Combat' },
  subheading: { className: 'type-subheading', sample: 'Hit dice' },
  'label-heading': {
    className: 'type-label-heading',
    sample: 'Saving throws',
  },
  body: {
    className: 'type-body',
    sample: 'You can spend one hit die at the end of a short rest.',
  },
  ui: { className: 'type-ui', sample: 'Add condition' },
  small: { className: 'type-small', sample: 'Last saved 2 minutes ago' },
  caption: { className: 'type-caption', sample: 'Proficiency bonus' },
  'num-xl': { className: 'type-num-xl', sample: '47 / 52' },
  'num-lg': { className: 'type-num-lg', sample: '18' },
  'num-md': { className: 'type-num-md', sample: '+5' },
};

// The size shown next to each step is read from the browser.
function TypeStep({ step }: { step: (typeof TYPE_SCALE_STEPS)[number] }) {
  const size = useComputedValue<HTMLElement>('font-size');
  return (
    <div className="flex flex-col gap-1 sm:contents">
      <dt className="type-caption text-muted">
        {STEPS[step].className}
        {size.value && ` · ${size.value}`}
      </dt>
      <dd
        ref={size.ref}
        className={`${STEPS[step].className} text-heading break-words`}
      >
        {STEPS[step].sample}
      </dd>
    </div>
  );
}

function TypeScale() {
  return (
    <dl className="grid grid-cols-1 items-baseline gap-x-6 gap-y-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
      {TYPE_SCALE_STEPS.map(step => (
        <TypeStep key={step} step={step} />
      ))}
    </dl>
  );
}

export const Scale: Story = {
  render: () => <TypeScale />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sizes: Record<string, string> = {
      title: '28px',
      heading: '22px',
      subheading: '18px',
      'label-heading': '16px',
      body: '15px',
      ui: '14px',
      small: '13px',
      caption: '12px',
      'num-xl': '34px',
      'num-lg': '26px',
      'num-md': '20px',
    };
    for (const [step, size] of Object.entries(sizes)) {
      const { className, sample } = STEPS[step as keyof typeof STEPS];
      await expect(getComputedStyle(canvas.getByText(sample)).fontSize).toBe(
        size
      );
      // The label shows the same measured size.
      await expect(
        await canvas.findByText(`${className} · ${size}`)
      ).toBeVisible();
    }
    const hp = canvas.getByText(STEPS['num-xl'].sample);
    await expect(getComputedStyle(hp).fontVariantNumeric).toBe(
      'lining-nums tabular-nums'
    );
    // The families are declared, not just named in the tokens.
    for (const font of [
      '700 28px Vollkorn',
      '400 15px Barlow',
      '600 34px "Barlow Condensed"',
    ]) {
      await expect(
        (await document.fonts.load(font)).length,
        font
      ).toBeGreaterThan(0);
    }
  },
};

export const ScaleDark: Story = {
  render: () => <TypeScale />,
  globals: { theme: 'dark' },
};
