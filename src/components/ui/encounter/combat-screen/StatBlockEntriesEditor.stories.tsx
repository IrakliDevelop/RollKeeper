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

// Real-world sample copied from an actual zombie stat block render
// (produced by `parseReferences` / `formatReferenceHtml`).
const ZOMBIE_HTML =
  '<span class="inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20" title="Melee Weapon Attack:">⚔️ Melee Weapon Attack:</span> <span class="inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/20" title="+3">🎯 +3</span> to hit, reach 5 ft., one target. 4 (<span class="inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors bg-red-600/10 text-red-400 border border-red-600/20 hover:bg-red-600/20" title="1d6 + 1">💥 1d6 + 1</span>) bludgeoning damage.';

const ZOMBIE_PLAIN =
  'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. 4 (1d6 + 1) bludgeoning damage.';

export const HtmlEntry: Story = {
  args: {
    entries: [{ name: 'Bite', text: ZOMBIE_HTML }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('Actions entry text');
    await expect(textarea).toHaveValue(ZOMBIE_PLAIN);
  },
};

export const AttackQuickEdit: Story = {
  args: {
    entries: [
      { name: 'Claw', text: 'Melee: +4 to hit, 1d6+2 slashing damage.' },
    ],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const toHitInput = canvas.getByLabelText('Actions entry to hit');
    await userEvent.clear(toHitInput);
    await userEvent.type(toHitInput, '+7');
    await userEvent.tab();
    await expect(args.onChange).toHaveBeenLastCalledWith([
      {
        name: 'Claw',
        text: 'Melee: +7 to hit, 1d6+2 slashing damage.',
      },
    ]);
  },
};
