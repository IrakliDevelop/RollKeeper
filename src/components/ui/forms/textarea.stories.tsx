import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { Textarea } from './textarea';

/**
 * Textarea shares the Input chrome: a surface-inset well, 1px input-border,
 * 4px radius and a brass focus outline. Errors add a blood border and blood
 * helper text.
 */
const meta: Meta<typeof Textarea> = {
  title: 'Forms/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
  decorators: [
    Story => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

function TextareaStates() {
  const [motto, setMotto] = useState('Stand fast, strike true');
  return (
    <div className="space-y-4">
      <Textarea
        label="Session notes"
        placeholder="Met the Red Hand at the bridge."
      />
      <Textarea
        label="Motto"
        value={motto}
        onChange={event => setMotto(event.target.value)}
        maxLength={24}
        showCharacterCount
      />
      <Textarea label="Backstory" error="Backstory is required" />
      <Textarea label="Retired notes" defaultValue="Archived" disabled />
    </div>
  );
}

export const States: Story = {
  render: () => <TextareaStates />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const backstory = canvas.getByLabelText('Backstory');
    await expect(backstory).toHaveAttribute('aria-invalid', 'true');
    await expect(backstory).toHaveAccessibleDescription(
      'Backstory is required'
    );
  },
};

export const StatesDark: Story = {
  render: () => <TextareaStates />,
  globals: { theme: 'dark' },
};

export const CoarsePointer: Story = {
  render: () => <Textarea label="Session notes" />,
  play: async ({ canvasElement }) => {
    const notes = within(canvasElement).getByLabelText('Session notes');
    const height = () => notes.getBoundingClientRect().height;

    await expect(height()).toBeGreaterThanOrEqual(80);
    const restore = emulateCoarsePointer();
    try {
      await expect(height()).toBeGreaterThanOrEqual(80);
    } finally {
      restore();
    }
  },
};
