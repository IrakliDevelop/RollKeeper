import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { DiceSetEditor } from './DiceSetEditor';
import { DEFAULT_DICE_SET } from '@/utils/diceSet';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';

function Harness() {
  const [value, setValue] = useState(DEFAULT_DICE_SET);
  return (
    <main className="mx-auto max-w-7xl p-4">
      <h1 className="type-heading text-heading mb-6">Configure dice</h1>
      <DiceSetEditor value={value} onChange={setValue} />
    </main>
  );
}
const meta: Meta<typeof Harness> = {
  title: 'Game/Dice configuration',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
    viewport: {
      options: {
        desktop: {
          name: 'Desktop',
          styles: { width: '1280px', height: '1000px' },
        },
        ipad: { name: 'iPad', styles: { width: '820px', height: '1180px' } },
        phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof meta>;
async function exercise(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(() =>
    expect(
      canvas.getByRole('status', { name: 'Preview roll result' }).textContent
    ).toContain('1d20')
  );
  await userEvent.click(canvas.getByRole('button', { name: /Oak Wood grain/ }));
  const size = canvas.getByRole('slider', { name: 'Dice size' });
  await userEvent.click(size);
  await userEvent.keyboard('{ArrowRight}');
  await userEvent.click(canvas.getByText('Advanced dice settings'));
  await userEvent.clear(canvas.getByLabelText('Face labels'));
  await userEvent.type(
    canvas.getByLabelText('Face labels'),
    'I, II, III, IV, V, VI'
  );
  await userEvent.click(
    canvas.getByRole('button', { name: 'Apply face labels' })
  );
  await expect(canvas.getByLabelText('Face labels')).toHaveValue(
    'I, II, III, IV, V, VI'
  );
  await userEvent.click(canvas.getByRole('button', { name: 'Roll preview' }));
  await waitFor(
    () =>
      expect(
        canvas.getByRole('button', { name: 'Roll preview' })
      ).toBeEnabled(),
    { timeout: 15000 }
  );
  await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
    window.innerWidth
  );
}
export const Desktop: Story = {
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => exercise(canvasElement),
};
export const Dark: Story = {
  ...Desktop,
  globals: { ...Desktop.globals, theme: 'dark' },
};
export const Ipad: Story = {
  globals: { viewport: { value: 'ipad', isRotated: false } },
  beforeEach: () => emulateCoarsePointer(),
  play: async ({ canvasElement }) => {
    await exercise(canvasElement);
    const buttons = within(canvasElement)
      .getByRole('group', { name: 'Dice presets' })
      .querySelectorAll('button');
    for (const button of buttons)
      await expect(
        button.getBoundingClientRect().height
      ).toBeGreaterThanOrEqual(44);
  },
};
export const Phone: Story = {
  ...Ipad,
  globals: { viewport: { value: 'phone', isRotated: false } },
};
