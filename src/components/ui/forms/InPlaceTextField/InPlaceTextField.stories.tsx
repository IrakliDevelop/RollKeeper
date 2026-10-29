import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { InPlaceTextField } from '.';

const meta = {
  title: 'Forms/InPlaceTextField',
  component: InPlaceTextField,
  args: {
    value: 'Thalia Vane',
    label: 'Character name',
    editing: true,
    onCommit: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <h2 className="type-heading text-heading">
        <InPlaceTextField {...args} value={value} onCommit={setValue} />
      </h2>
    );
  },
} satisfies Meta<typeof InPlaceTextField>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Edit: Story = {
  play: async ({ canvasElement }) => {
    const field = within(canvasElement).getByRole('textbox');
    await userEvent.clear(field);
    await userEvent.type(field, 'Brin');
    await userEvent.keyboard('{Escape}');
    await expect(field).toHaveValue('Thalia Vane');
    await userEvent.clear(field);
    await userEvent.type(field, 'Brin{Enter}');
    await expect(field).toHaveValue('Brin');
  },
};
export const Play: Story = { args: { editing: false } };

export const WideCharacters: Story = {
  args: { value: 'WWWWWWWWWW' },
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const field = within(canvasElement).getByRole(
      'textbox'
    ) as HTMLInputElement;
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = getComputedStyle(field).font;
    await expect(
      field.getBoundingClientRect().width + 1
    ).toBeGreaterThanOrEqual(context.measureText(field.value).width);
  },
};
