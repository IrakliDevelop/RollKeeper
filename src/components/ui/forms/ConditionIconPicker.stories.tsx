import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { ConditionIconPicker } from './ConditionIconPicker';
import type { ConditionIconName } from '@/utils/conditionIconRegistry';

function PickerDemo({ initial }: { initial: ConditionIconName }) {
  const [icon, setIcon] = useState<ConditionIconName>(initial);
  return (
    <div className="bg-surface text-body flex items-center gap-3 p-8">
      <ConditionIconPicker value={icon} onChange={setIcon} />
      <span className="text-muted text-sm">Selected: {icon}</span>
    </div>
  );
}

const meta: Meta<typeof PickerDemo> = {
  title: 'Forms/ConditionIconPicker',
  component: PickerDemo,
  parameters: { layout: 'centered' },
  args: { initial: 'skull' },
};

export default meta;
type Story = StoryObj<typeof PickerDemo>;

/** The grid fits the popover: no sideways scrolling, no overlapping cells. */
async function expectGridFits(grid: HTMLElement, minCell: number) {
  await expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth);
  const cells = within(grid).getAllByRole('button');
  const [first, second] = cells.map(cell => cell.getBoundingClientRect());
  await expect(first.width).toBeGreaterThanOrEqual(minCell);
  await expect(second.left).toBeGreaterThanOrEqual(first.right);
}

async function checkGrid(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const page = within(document.body);
  await userEvent.click(canvas.getByRole('button', { name: /Condition icon/ }));
  const grid = await page.findByRole('group', { name: 'Icons' });
  await expectGridFits(grid, 36);

  // A classic scrollbar (Windows, Linux) takes about 15px from the grid.
  // Storybook's headless browser hides scrollbars, so take the width away.
  grid.style.width = `${grid.clientWidth - 15}px`;
  try {
    await expectGridFits(grid, 36);
  } finally {
    grid.style.width = '';
  }

  const restore = emulateCoarsePointer();
  try {
    await expectGridFits(grid, 44);
  } finally {
    restore();
  }

  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(page.queryByRole('group')).toBeNull());
}

export const Light: Story = {
  play: ({ canvasElement }) => checkGrid(canvasElement),
};

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: ({ canvasElement }) => checkGrid(canvasElement),
};
