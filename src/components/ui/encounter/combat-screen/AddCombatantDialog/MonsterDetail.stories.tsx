import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';

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
