import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn, screen } from 'storybook/test';
import { AddCombatantDialog } from './index';
import type { CampaignNPC } from '@/types/encounter';

const campaignPlayers = [
  {
    id: 'p1',
    name: 'Thorin Ironforge',
    class: 'Fighter',
    level: 8,
    armorClass: 18,
    currentHp: 65,
    maxHp: 80,
    dexterity: 12,
  },
  {
    id: 'p2',
    name: 'Lyra Moonwhisper',
    class: 'Wizard',
    level: 8,
    armorClass: 13,
    currentHp: 30,
    maxHp: 42,
    dexterity: 16,
  },
  {
    id: 'p3',
    name: 'Brother Aldric',
    class: 'Cleric',
    level: 8,
    armorClass: 16,
    currentHp: 55,
    maxHp: 60,
    dexterity: 10,
  },
];

const playerColors: Record<string, string> = {
  p1: '#3b82f6',
  p2: '#8b5cf6',
  p3: '#10b981',
};

const npcs: CampaignNPC[] = [
  {
    id: 'npc1',
    campaignCode: 'DEMO',
    name: 'Innkeeper Brennan',
    armorClass: '11',
    maxHp: 22,
    speed: '30 ft.',
    description: 'A stout dwarf who runs the Rusty Flagon.',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'npc2',
    campaignCode: 'DEMO',
    name: 'Captain Halvard',
    armorClass: '16',
    maxHp: 52,
    speed: '30 ft.',
    description: 'City guard captain, loyal to the Duke.',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
];

const sharedProps = {
  open: true,
  onOpenChange: fn(),
  onAddEntity: fn(),
  campaignCode: 'DEMO',
  npcs,
  playerColors,
};

const meta: Meta<typeof AddCombatantDialog> = {
  title: 'Encounter/AddCombatantDialog',
  component: AddCombatantDialog,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof AddCombatantDialog>;

export const PlayerTab: Story = {
  name: 'Tab: Player',
  args: {
    ...sharedProps,
    campaignPlayers,
  },
  play: async () => {
    // Dialog content renders in a Radix portal (outside canvasElement),
    // so query the whole document via `screen`.
    screen.getByRole('button', { name: /player/i }).click();
  },
};

export const NpcTab: Story = {
  name: 'Tab: NPC',
  args: {
    ...sharedProps,
    campaignPlayers: [],
  },
  play: async () => {
    screen.getByRole('button', { name: /npc/i }).click();
  },
};

export const MonsterTab: Story = {
  name: 'Tab: Monster (search)',
  args: {
    ...sharedProps,
    campaignPlayers: [],
  },
  // Monster tab is the default; no play needed
};

export const CustomTab: Story = {
  name: 'Tab: Custom',
  args: {
    ...sharedProps,
    campaignPlayers: [],
  },
  play: async () => {
    screen.getByRole('button', { name: /custom/i }).click();
  },
};
