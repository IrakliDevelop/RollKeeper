import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { RadioGroupField, RadioGroupItem } from './radio-group';

/**
 * Felt and Brass radio group: the chosen radio fills brass with an on-brass
 * dot. A card option takes a brass edge when chosen. On touch the hit area
 * grows to 44px while the radio keeps its size.
 */
const meta: Meta<typeof RadioGroupField> = {
  title: 'Forms/RadioGroup',
  component: RadioGroupField,
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

function RadioStates() {
  return (
    <div className="w-80 space-y-6">
      <RadioGroupField
        label="Rest"
        defaultValue="short"
        helperText="Long rests restore all hit points"
        aria-label="Rest"
      >
        <RadioGroupItem value="short" label="Short rest" />
        <RadioGroupItem value="long" label="Long rest" />
      </RadioGroupField>
      <RadioGroupField label="Lodging" defaultValue="camp" aria-label="Lodging">
        <RadioGroupItem
          value="camp"
          label="Roadside camp"
          description="Free, but someone keeps watch"
          variant="card"
        />
        <RadioGroupItem
          value="inn"
          label="Inn"
          description="Costs gold, safe sleep"
          variant="card"
        />
      </RadioGroupField>
    </div>
  );
}

export const States: Story = {
  render: () => <RadioStates />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const short = canvas.getByRole('radio', { name: 'Short rest' });
    const long = canvas.getByRole('radio', { name: 'Long rest' });

    short.focus();
    // Radix moves roving focus in a timeout and selects only while an arrow
    // key is down, so hold the key until the next radio is chosen.
    await userEvent.keyboard('{ArrowDown>}');
    await waitFor(() => expect(long).toHaveAttribute('data-state', 'checked'));
    await userEvent.keyboard('{/ArrowDown}');
    await expect(long).toHaveFocus();
    await expect(getComputedStyle(long).outlineStyle).toBe('solid');

    const camp = canvas.getByText('Roadside camp').closest('label')!;
    const inn = canvas.getByText('Inn').closest('label')!;
    await waitFor(() =>
      expect(getComputedStyle(inn).borderTopColor).not.toBe(
        getComputedStyle(camp).borderTopColor
      )
    );
  },
};

export const StatesDark: Story = {
  render: () => <RadioStates />,
  globals: { theme: 'dark' },
};

export const Disabled: Story = {
  render: () => (
    <RadioGroupField
      label="Rest"
      defaultValue="short"
      aria-label="Rest"
      disabled
    >
      <RadioGroupItem value="short" label="Short rest" />
      <RadioGroupItem value="long" label="Long rest" />
    </RadioGroupField>
  ),
  parameters: DISABLED_A11Y,
};

export const DisabledDark: Story = {
  ...Disabled,
  globals: { theme: 'dark' },
};
