import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Autocomplete } from './Autocomplete';

/**
 * The option list floats on surface-elevated with a 1px divider, the 6px
 * object radius and the overlay shadow. The chosen option shows a brass
 * check; options take the brass focus outline from the keyboard.
 */
const meta: Meta<typeof Autocomplete> = {
  title: 'Forms/Autocomplete',
  component: Autocomplete,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const COLOURS = {
  paper: {
    elevated: 'rgb(251, 251, 248)',
    ring: 'rgb(160, 123, 44)',
    check: 'rgb(122, 91, 23)',
  },
  felt: {
    elevated: 'rgb(31, 43, 37)',
    ring: 'rgb(200, 161, 75)',
    check: 'rgb(200, 161, 75)',
  },
};

function WeaponPicker() {
  const [value, setValue] = useState('longsword');
  return (
    <div className="w-72">
      <p className="text-body mb-1 text-sm">Weapon</p>
      <Autocomplete
        options={[
          { value: 'dagger', label: 'Dagger' },
          { value: 'longsword', label: 'Longsword' },
          { value: 'shortbow', label: 'Shortbow' },
        ]}
        value={value}
        onChange={setValue}
        placeholder="Search weapons"
      />
    </div>
  );
}

async function checkList(
  canvasElement: HTMLElement,
  theme: keyof typeof COLOURS
) {
  const colours = COLOURS[theme];
  const canvas = within(canvasElement);

  await userEvent.click(canvas.getByRole('textbox'));
  const list = canvas.getByRole('list').parentElement!;
  const style = getComputedStyle(list);
  await expect(style.borderTopLeftRadius).toBe('6px');
  await expect(style.borderTopWidth).toBe('1px');
  await expect(style.boxShadow).not.toBe('none');
  await waitFor(() =>
    expect(getComputedStyle(list).backgroundColor).toBe(colours.elevated)
  );

  const chosen = canvas.getByRole('button', { name: 'Longsword' });
  await expect(getComputedStyle(chosen.querySelector('svg')!).color).toBe(
    colours.check
  );
  await expect(getComputedStyle(chosen).backgroundColor).toBe(
    'rgba(0, 0, 0, 0)'
  );

  // Tab past the chevron to the first option: brass outline inside the row.
  await userEvent.tab();
  await expect(
    canvas.getByRole('button', { name: 'Show options' })
  ).toHaveFocus();
  await userEvent.tab();
  const dagger = canvas.getByRole('button', { name: 'Dagger' });
  await expect(dagger).toHaveFocus();
  await waitFor(() => {
    const outline = getComputedStyle(dagger);
    expect(outline.outlineStyle).toBe('solid');
    expect(outline.outlineWidth).toBe('2px');
    expect(outline.outlineColor).toBe(colours.ring);
  });

  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(canvas.queryByRole('list')).toBeNull());
  await expect(canvas.getByRole('textbox')).toHaveValue('Dagger');
}

export const Keyboard: Story = {
  render: () => <WeaponPicker />,
  play: ({ canvasElement }) => checkList(canvasElement, 'paper'),
};

export const KeyboardDark: Story = {
  render: () => <WeaponPicker />,
  globals: { theme: 'dark' },
  play: ({ canvasElement }) => checkList(canvasElement, 'felt'),
};
