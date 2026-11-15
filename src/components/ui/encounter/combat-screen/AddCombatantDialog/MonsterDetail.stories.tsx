import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';

import { MonsterDetail } from './MonsterDetail';

import type { ProcessedMonster } from '@/types/bestiary';

function makeMonster(
  overrides: Partial<ProcessedMonster> = {}
): ProcessedMonster {
  return {
    id: 'mon-zombie',
    name: 'Zombie',
    size: ['M'],
    type: 'undead',
    alignment: 'neutral evil',
    ac: '8',
    hp: '15 (2d8+6)',
    speed: '20 ft.',
    str: 13,
    dex: 6,
    con: 16,
    int: 3,
    wis: 6,
    cha: 5,
    saves: 'WIS +0',
    skills: '',
    resistances: '',
    immunities: 'poison',
    vulnerabilities: '',
    senses: 'darkvision 60 ft., passive Perception 8',
    passivePerception: 8,
    languages: 'None',
    cr: '1/4',
    source: 'XMM',
    page: 1,
    acValue: 8,
    hpAverage: 15,
    hpFormula: '2d8+6',
    legendaryActionCount: 0,
    conditionImmunities: ['poisoned'],
    ...overrides,
  };
}

const noop = () => {};

const meta: Meta<typeof MonsterDetail> = {
  title: 'Encounter/AddCombatantDialog/MonsterDetail',
  component: MonsterDetail,
  args: {
    hp: '15',
    onHpChange: noop,
    ac: '8',
    onAcChange: noop,
    count: 1,
    onCountChange: noop,
    hideName: false,
    onHideNameChange: noop,
    playerAlias: '',
    onPlayerAliasChange: noop,
    disposition: 'enemy',
    onDispositionChange: noop,
    onBack: noop,
    onEditStatBlock: noop,
    hasEdits: false,
  },
};

export default meta;
type Story = StoryObj<typeof MonsterDetail>;

export const WithTokenPreview: Story = {
  args: {
    selected: makeMonster({ hasToken: true, tokenSource: 'XMM' }),
  },
  play: async ({ canvasElement }) => {
    const img = canvasElement.querySelector('img');
    await expect(img).not.toBeNull();
    await expect(img!.getAttribute('src')).toBe(
      '/api/bestiary/token/XMM/Zombie'
    );
  },
};

export const WithoutToken: Story = {
  args: {
    selected: makeMonster({ hasToken: false }),
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('img')).toBeNull();
  },
};

const THREE_ACTIONS = [
  { name: 'Slam', text: 'Melee: +3 to hit.' },
  { name: 'Bite', text: 'Melee: +3 to hit.' },
  { name: 'Claw', text: 'Melee: +3 to hit.' },
];

/** Ability labels read as written, the footer counts actions, the name is a level-4 heading. */
export const AbilityLabels: Story = {
  args: {
    selected: makeMonster({ actions: THREE_ACTIONS }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
      await expect(
        getComputedStyle(canvas.getByText(label)).textTransform
      ).toBe('none');
    }
    await expect(
      canvas.getByText('HP formula 2d8+6 · 3 actions')
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { level: 4, name: 'Zombie' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: /edit stat block/i })
    ).toHaveAttribute('data-variant', 'secondary');
  },
};

export const OneAction: Story = {
  args: {
    selected: makeMonster({ actions: THREE_ACTIONS.slice(0, 1) }),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('HP formula 2d8+6 · 1 action')
    ).toBeInTheDocument();
  },
};

export const Dark: Story = {
  args: AbilityLabels.args,
  globals: { theme: 'dark' },
};
