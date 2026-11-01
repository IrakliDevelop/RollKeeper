import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { Checkbox } from './checkbox';

/**
 * Felt and Brass checkbox: a brass fill with an on-brass mark when checked,
 * an input-border outline when not. The variants are deprecated aliases. On
 * touch the hit area grows to 44px while the box keeps its size.
 */
const meta: Meta<typeof Checkbox> = {
  title: 'Forms/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// WCAG 1.4.3 exempts text of inactive controls, but axe can't tell a
// dimmed label from body text, so the disabled story skips that one rule.
const DISABLED_A11Y = {
  a11y: {
    test: 'error',
    config: { rules: [{ id: 'color-contrast', enabled: false }] },
  },
} as const;

function CheckboxStates() {
  const [prepared, setPrepared] = useState(false);
  return (
    <div className="space-y-4">
      <Checkbox
        label="Prepared"
        description="Counts against your prepared spells"
        checked={prepared}
        onCheckedChange={setPrepared}
      />
      <Checkbox label="Jack of all trades" size="sm" checked />
      <Checkbox label="Some spells prepared" checked="indeterminate" />
    </div>
  );
}

export const States: Story = {
  render: () => <CheckboxStates />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const prepared = canvas.getByRole('checkbox', { name: 'Prepared' });

    prepared.focus();
    await userEvent.keyboard(' ');
    await expect(prepared).toHaveAttribute('data-state', 'checked');
    await expect(getComputedStyle(prepared).outlineStyle).toBe('solid');
    await expect(getComputedStyle(prepared).borderTopLeftRadius).toBe('4px');
  },
};

export const StatesDark: Story = {
  render: () => <CheckboxStates />,
  globals: { theme: 'dark' },
};

export const Disabled: Story = {
  render: () => (
    <div className="space-y-4">
      <Checkbox label="Granted by class" checked disabled />
      <Checkbox label="Not available" disabled />
    </div>
  ),
  parameters: DISABLED_A11Y,
};

export const DisabledDark: Story = {
  ...Disabled,
  globals: { theme: 'dark' },
};

/**
 * A stacked list as in the filter panels, with one described row. On touch
 * every row is at least 44px and holds its control's 44px hit area, so a tap
 * never lands on a neighbour; the described row keeps its control at the top,
 * beside the label. The play function copies the coarse-pointer rules in,
 * since the test browser has a fine pointer.
 */
export const StackedOnTouch: Story = {
  render: () => (
    <div className="w-64 space-y-2">
      <Checkbox label="Fighter" />
      <Checkbox label="Rogue" />
      <Checkbox
        label="Wizard"
        description="Prepares spells from a spellbook after a long rest, and can copy new spells into it"
      />
      <Checkbox label="Cleric" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const restore = emulateCoarsePointer();
    try {
      const controls = canvas.getAllByRole('checkbox');
      for (const control of controls) {
        const box = control.getBoundingClientRect();
        const row = control.parentElement!.getBoundingClientRect();
        const centre = box.top + box.height / 2;
        await expect(row.height).toBeGreaterThanOrEqual(44);
        // The 44px hit area stays inside the row (1px for rounding).
        await expect(centre - 22).toBeGreaterThanOrEqual(row.top - 1);
        await expect(centre + 22).toBeLessThanOrEqual(row.bottom + 1);
      }
      // The described row keeps its control beside the label, not centred
      // on the description.
      const described = controls[2].getBoundingClientRect();
      const describedRow = controls[2].parentElement!.getBoundingClientRect();
      await expect(described.top - describedRow.top).toBeLessThanOrEqual(16);
    } finally {
      restore();
    }
  },
};
