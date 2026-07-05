import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { CombatTurnBar } from './CombatTurnBar';
import type { Encounter, EncounterEntity } from '@/types/encounter';

const goblin: EncounterEntity = {
  id: 'e1',
  type: 'monster',
  name: 'Goblin Warboss',
  initiative: 15,
  initiativeModifier: 2,
  currentHp: 21,
  maxHp: 21,
  tempHp: 0,
  armorClass: 17,
  conditions: [],
  chessPiece: 'king',
  color: '#ef4444',
};

const thorin: EncounterEntity = {
  id: 'e2',
  type: 'player',
  name: 'Thorin Ironforge',
  initiative: 18,
  initiativeModifier: 3,
  currentHp: 35,
  maxHp: 44,
  tempHp: 5,
  armorClass: 18,
  conditions: [],
  playerDisposition: 'ally',
};

const preCombatEncounter: Encounter = {
  id: 'enc-1',
  name: 'Crypt of the Vampire',
  entities: [],
  currentTurn: 0,
  round: 1,
  isActive: false,
  sortOrder: 'initiative',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const preCombatWithEntities: Encounter = {
  ...preCombatEncounter,
  entities: [goblin, thorin],
};

const activeEncounter: Encounter = {
  ...preCombatWithEntities,
  isActive: true,
  currentTurn: 0,
  round: 3,
};

const baseActions = {
  onToggleHidePlayerHp: fn(),
  onStartCombat: fn(),
  onEndCombat: fn(),
  onNextTurn: fn(),
  onPrevTurn: fn(),
  onRollAllInitiatives: fn(),
};

const meta: Meta<typeof CombatTurnBar> = {
  component: CombatTurnBar,
  tags: ['autodocs'],
  args: {
    ...baseActions,
    encounter: preCombatEncounter,
    layout: 'rail',
    hidePlayerHp: false,
  },
  decorators: [
    Story => (
      <div style={{ maxWidth: 900 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// ── Pre-combat ────────────────────────────────────────────────

export const PreCombatEmptyRail: Story = {
  name: 'Pre-combat / Rail (empty)',
  args: { encounter: preCombatEncounter, layout: 'rail' },
};

export const PreCombatReadyRail: Story = {
  name: 'Pre-combat / Rail (with entities)',
  args: { encounter: preCombatWithEntities, layout: 'rail' },
};

export const PreCombatEmptyFocus: Story = {
  name: 'Pre-combat / Focus (empty)',
  args: { encounter: preCombatEncounter, layout: 'focus' },
};

export const PreCombatReadyFocus: Story = {
  name: 'Pre-combat / Focus (with entities)',
  args: { encounter: preCombatWithEntities, layout: 'focus' },
};

// ── Active combat ─────────────────────────────────────────────

export const ActiveRail: Story = {
  name: 'Active / Rail',
  args: { encounter: activeEncounter, layout: 'rail' },
};

export const ActiveRailHpHidden: Story = {
  name: 'Active / Rail (HP hidden)',
  args: { encounter: activeEncounter, layout: 'rail', hidePlayerHp: true },
};

export const ActiveFocus: Story = {
  name: 'Active / Focus',
  args: { encounter: activeEncounter, layout: 'focus' },
};

// ── Dark theme ────────────────────────────────────────────────

export const ActiveRailDark: Story = {
  name: 'Active / Rail (dark)',
  args: { encounter: activeEncounter, layout: 'rail' },
  globals: { theme: 'dark' },
};

export const ActiveFocusDark: Story = {
  name: 'Active / Focus (dark)',
  args: { encounter: activeEncounter, layout: 'focus' },
  globals: { theme: 'dark' },
};
