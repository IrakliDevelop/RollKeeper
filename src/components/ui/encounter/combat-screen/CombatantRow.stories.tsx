import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { CombatantRow } from './CombatantRow';
import type { EncounterEntity } from '@/types/encounter';

const monsterEntity: EncounterEntity = {
  id: 'goblin-1',
  type: 'monster',
  name: 'Goblin',
  initiative: 15,
  initiativeModifier: 2,
  currentHp: 7,
  maxHp: 7,
  tempHp: 0,
  armorClass: 15,
  conditions: [],
  chessPiece: 'pawn',
  color: '#ef4444',
};

const playerEntity: EncounterEntity = {
  id: 'player-1',
  type: 'player',
  name: 'Thorin Ironforge',
  initiative: 18,
  initiativeModifier: 2,
  currentHp: 35,
  maxHp: 44,
  tempHp: 5,
  armorClass: 18,
  conditions: [{ id: 'c1', name: 'Blessed', sourceSpell: 'Bless' }],
  playerDisposition: 'ally',
  inspirationCount: 1,
};

const lairEntity: EncounterEntity = {
  id: 'lair-1',
  type: 'lair',
  name: 'Lair of the Vampire',
  initiative: 20,
  initiativeModifier: 0,
  currentHp: 0,
  maxHp: 0,
  tempHp: 0,
  armorClass: 0,
  conditions: [],
  lairActions: [
    {
      id: 'la1',
      name: 'Summon Bats',
      description: 'Summons a swarm',
      usedThisRound: false,
    },
    {
      id: 'la2',
      name: 'Mist Step',
      description: 'Vampire mist moves',
      usedThisRound: true,
    },
  ],
};

const deadMonster: EncounterEntity = {
  ...monsterEntity,
  id: 'goblin-dead',
  name: 'Dead Goblin',
  currentHp: 0,
};

const conditionedMonster: EncounterEntity = {
  ...monsterEntity,
  id: 'goblin-conditions',
  name: 'Cursed Goblin',
  currentHp: 3,
  conditions: [
    { id: 'c1', name: 'Poisoned' },
    { id: 'c2', name: 'Frightened' },
    { id: 'c3', name: 'Prone' },
    { id: 'c4', name: 'Blinded' },
    { id: 'c5', name: 'Stunned' },
  ],
  concentrationSpell: 'Hold Person',
  hasUsedReaction: true,
};

const baseActions = {
  onUpdate: fn(),
  onRemove: fn(),
  onDamage: fn(),
  onHeal: fn(),
  onAddTempHp: fn(),
  onSetMaxHp: fn(),
  onAddCondition: fn(),
  onRemoveCondition: fn(),
  onSetConditionRounds: fn(),
  onUseAbility: fn(),
  onRestoreAbility: fn(),
  onUseLegendaryAction: fn(),
  onResetLegendaryActions: fn(),
  onSetConcentration: fn(),
  onUseLairAction: fn(),
  onSetInitiative: fn(),
  onLongRest: fn(),
  onViewPlayer: fn(),
  onViewNPC: fn(),
  onChangePlayerColor: fn(),
  onAdjustCounter: fn(),
};

const meta: Meta<typeof CombatantRow> = {
  component: CombatantRow,
  tags: ['autodocs'],
  args: {
    entity: monsterEntity,
    density: 'rail',
    isActive: false,
    isSelected: false,
    isOnDeck: false,
    hidePlayerHp: false,
    actions: baseActions,
    onSelect: fn(),
  },
  decorators: [
    Story => (
      <div style={{ maxWidth: 500, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// ── Rail density ──────────────────────────────────────────────
export const MonsterRailDefault: Story = {};

export const MonsterRailActive: Story = {
  args: { isActive: true },
};

export const MonsterRailSelected: Story = {
  args: { isSelected: true },
};

export const MonsterRailOnDeck: Story = {
  args: { isOnDeck: true },
};

export const MonsterRailDead: Story = {
  args: { entity: deadMonster },
};

export const MonsterRailConditions: Story = {
  args: { entity: conditionedMonster },
};

export const PlayerRailDefault: Story = {
  args: { entity: playerEntity },
};

export const PlayerRailActive: Story = {
  args: { entity: playerEntity, isActive: true },
};

export const PlayerRailSelected: Story = {
  args: { entity: playerEntity, isSelected: true },
};

export const PlayerRailOnDeck: Story = {
  args: { entity: playerEntity, isOnDeck: true },
};

export const PlayerRailHpHidden: Story = {
  args: { entity: playerEntity, hidePlayerHp: true },
};

export const PlayerRailCounter: Story = {
  args: {
    entity: playerEntity,
    counterLabel: 'Lay on Hands',
    counterValue: 15,
  },
};

export const LairRailDefault: Story = {
  args: { entity: lairEntity },
};

export const LairRailActive: Story = {
  args: { entity: lairEntity, isActive: true },
};

// ── Focus density ─────────────────────────────────────────────
export const MonsterFocusDefault: Story = {
  args: { density: 'focus' },
};

export const MonsterFocusActive: Story = {
  args: { density: 'focus', isActive: true },
};

export const MonsterFocusSelected: Story = {
  args: { density: 'focus', isSelected: true },
};

export const MonsterFocusOnDeck: Story = {
  args: { density: 'focus', isOnDeck: true },
};

export const PlayerFocusDefault: Story = {
  args: { density: 'focus', entity: playerEntity },
};

export const PlayerFocusActive: Story = {
  args: { density: 'focus', entity: playerEntity, isActive: true },
};

export const LairFocusDefault: Story = {
  args: { density: 'focus', entity: lairEntity },
};

// ── Dark theme ────────────────────────────────────────────────
export const MonsterRailDark: Story = {
  globals: { theme: 'dark' },
};

export const PlayerRailDark: Story = {
  args: { entity: playerEntity },
  globals: { theme: 'dark' },
};
