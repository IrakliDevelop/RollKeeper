import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { EntityCard } from './EntityCard';
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
};

const currentTurnEntity: EncounterEntity = {
  ...monsterEntity,
  id: 'ogre-1',
  name: 'Ogre',
  currentHp: 45,
  maxHp: 59,
  armorClass: 11,
  conditions: [
    { id: 'c2', name: 'Frightened', sourceEntity: 'Thorin Ironforge' },
  ],
};

const meta: Meta<typeof EntityCard> = {
  component: EntityCard,
  tags: ['autodocs'],
  args: {
    entity: monsterEntity,
    isCurrentTurn: false,
    onUpdate: fn(),
    onRemove: fn(),
    onDamage: fn(),
    onHeal: fn(),
    onAddCondition: fn(),
    onRemoveCondition: fn(),
    onUseAbility: fn(),
    onRestoreAbility: fn(),
    onUseLegendaryAction: fn(),
    onResetLegendaryActions: fn(),
    onSetConcentration: fn(),
    onSetInitiative: fn(),
    onAdjustCounter: fn(),
    onViewPlayer: fn(),
    onViewNPC: fn(),
    onChangePlayerColor: fn(),
  },
  decorators: [
    Story => (
      <div style={{ maxWidth: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Monster: Story = {};

export const MonsterDark: Story = {
  globals: { theme: 'dark' },
};

export const Player: Story = {
  args: { entity: playerEntity },
};

export const PlayerDark: Story = {
  ...Player,
  globals: { theme: 'dark' },
};

export const CurrentTurn: Story = {
  args: { entity: currentTurnEntity, isCurrentTurn: true },
};

export const CurrentTurnDark: Story = {
  ...CurrentTurn,
  globals: { theme: 'dark' },
};
