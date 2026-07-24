import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StatBlockEditor } from './StatBlockEditor';
import { createMonsterEditDraft } from './monsterEditDraft';
import type { MonsterEditDraft } from './monsterEditDraft';
import type { ProcessedMonster } from '@/types/bestiary';

const goblin: ProcessedMonster = {
  id: 'mon-goblin',
  name: 'Goblin',
  size: ['S'],
  type: 'humanoid',
  alignment: 'neutral evil',
  ac: '15',
  hp: '7 (2d6)',
  speed: '30 ft.',
  str: 8,
  dex: 14,
  con: 10,
  int: 10,
  wis: 8,
  cha: 8,
  saves: '',
  skills: 'Stealth +6',
  resistances: '',
  immunities: '',
  vulnerabilities: '',
  senses: 'darkvision 60 ft.',
  passivePerception: 9,
  languages: 'Common, Goblin',
  cr: '1/4',
  traits: [{ name: 'Nimble Escape', text: 'Disengage as bonus action.' }],
  actions: [{ name: 'Scimitar', text: 'Melee: +4 to hit.' }],
  source: 'MM',
  page: 166,
  acValue: 15,
  hpAverage: 7,
  hpFormula: '2d6',
  legendaryActionCount: 0,
  conditionImmunities: [],
};

function StatefulEditor({
  onBack,
  onResetSpy,
}: {
  onBack: () => void;
  onResetSpy: () => void;
}) {
  const [draft, setDraft] = useState<MonsterEditDraft>(() =>
    createMonsterEditDraft(goblin)
  );
  return (
    <StatBlockEditor
      monsterName="Goblin"
      draft={draft}
      onDraftChange={setDraft}
      onReset={() => {
        onResetSpy();
        setDraft(createMonsterEditDraft(goblin));
      }}
      onBack={onBack}
    />
  );
}

const meta = {
  title: 'Encounter/AddCombatantDialog/StatBlockEditor',
  component: StatefulEditor,
  args: { onBack: fn(), onResetSpy: fn() },
} satisfies Meta<typeof StatefulEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DexEditUpdatesInitiative: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dexInput = canvas.getByLabelText('dex score');
    await userEvent.clear(dexInput);
    await userEvent.type(dexInput, '20');
    const initInput = canvas.getByLabelText('Initiative modifier');
    await expect(initInput).toHaveValue('5');
  },
};

export const ManualInitiativeStopsFollowing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const initInput = canvas.getByLabelText('Initiative modifier');
    await userEvent.clear(initInput);
    await userEvent.type(initInput, '7');
    const dexInput = canvas.getByLabelText('dex score');
    await userEvent.clear(dexInput);
    await userEvent.type(dexInput, '20');
    await expect(initInput).toHaveValue('7');
  },
};

export const ActionsTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: /actions & traits/i })
    );
    await expect(canvas.getByDisplayValue('Scimitar')).toBeInTheDocument();
    await expect(canvas.getByDisplayValue('Nimble Escape')).toBeInTheDocument();
  },
};
