import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StatBlockEntriesEditor } from './StatBlockEntriesEditor';

const meta = {
  title: 'Encounter/StatBlockEntriesEditor',
  component: StatBlockEntriesEditor,
  args: {
    title: 'Actions',
    entries: [
      { name: 'Scimitar', text: 'Melee: +4 to hit, 1d6+2 slashing.' },
      { name: 'Fire Breath (Recharge 5-6)', text: 'Cone of fire.', uses: 1 },
    ],
    onChange: fn(),
  },
} satisfies Meta<typeof StatBlockEntriesEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EditName: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const nameInput = canvas.getByDisplayValue('Scimitar');
    await userEvent.type(nameInput, '!');
    await expect(args.onChange).toHaveBeenLastCalledWith([
      { name: 'Scimitar!', text: 'Melee: +4 to hit, 1d6+2 slashing.' },
      { name: 'Fire Breath (Recharge 5-6)', text: 'Cone of fire.', uses: 1 },
    ]);
  },
};

export const AddEntry: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: /add actions entry/i })
    );
    await expect(args.onChange).toHaveBeenLastCalledWith([
      { name: 'Scimitar', text: 'Melee: +4 to hit, 1d6+2 slashing.' },
      { name: 'Fire Breath (Recharge 5-6)', text: 'Cone of fire.', uses: 1 },
      { name: '', text: '' },
    ]);
  },
};

export const DeleteEntry: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const deleteButtons = canvas.getAllByRole('button', {
      name: /delete entry/i,
    });
    await userEvent.click(deleteButtons[0]);
    await expect(args.onChange).toHaveBeenLastCalledWith([
      { name: 'Fire Breath (Recharge 5-6)', text: 'Cone of fire.', uses: 1 },
    ]);
  },
};

export const Empty: Story = {
  args: { entries: [] },
};
