import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { Switch } from './switch';

/**
 * Felt and Brass switch: a brass track with an on-brass thumb when on, an
 * input-border track when off. The variants are deprecated aliases. On
 * touch the hit area grows to 44px while the switch keeps its size.
 */
const meta: Meta<typeof Switch> = {
  title: 'Forms/Switch',
  component: Switch,
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

function SwitchStates() {
  const [concentrating, setConcentrating] = useState(true);
  return (
    <div className="space-y-4">
      <Switch
        label="Concentrating"
        description="Shown on the encounter tracker"
        checked={concentrating}
        onCheckedChange={setConcentrating}
      />
      <Switch label="Show hidden monsters" />
      <Switch label="Inspiration" size="sm" defaultChecked />
    </div>
  );
}

export const States: Story = {
  render: () => <SwitchStates />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hidden = canvas.getByRole('switch', { name: 'Show hidden monsters' });
    const offTrack = getComputedStyle(hidden).backgroundColor;

    hidden.focus();
    await userEvent.keyboard(' ');
    await expect(hidden).toHaveAttribute('data-state', 'checked');
    // Uncontrolled switches colour from data-state too (after the 120ms
    // colour transition).
    await waitFor(() =>
      expect(getComputedStyle(hidden).backgroundColor).not.toBe(offTrack)
    );
    await expect(getComputedStyle(hidden).outlineStyle).toBe('solid');

    await userEvent.keyboard('{Enter}');
    await expect(hidden).toHaveAttribute('data-state', 'unchecked');
  },
};

export const StatesDark: Story = {
  render: () => <SwitchStates />,
  globals: { theme: 'dark' },
};

export const Disabled: Story = {
  render: () => (
    <div className="space-y-4">
      <Switch label="Locked by DM" checked disabled />
      <Switch label="Locked off" disabled />
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
      <Switch label="Show hidden monsters" />
      <Switch label="Show HP" />
      <Switch
        label="Show conditions"
        description="Players see every condition on every creature, including ones the DM adds"
      />
      <Switch label="Show initiative" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const restore = emulateCoarsePointer();
    try {
      const controls = canvas.getAllByRole('switch');
      for (const control of controls) {
        const box = control.getBoundingClientRect();
        const row = control.closest('label')!.getBoundingClientRect();
        const centre = box.top + box.height / 2;
        await expect(row.height).toBeGreaterThanOrEqual(44);
        // The 44px hit area stays inside the row (1px for rounding).
        await expect(centre - 22).toBeGreaterThanOrEqual(row.top - 1);
        await expect(centre + 22).toBeLessThanOrEqual(row.bottom + 1);
      }
      // The described row keeps its control beside the label, not centred
      // on the description.
      const described = controls[2].getBoundingClientRect();
      const describedRow = controls[2]
        .closest('label')!
        .getBoundingClientRect();
      await expect(described.top - describedRow.top).toBeLessThanOrEqual(16);
    } finally {
      restore();
    }
  },
};
