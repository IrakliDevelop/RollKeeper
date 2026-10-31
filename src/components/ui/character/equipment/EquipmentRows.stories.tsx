import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import type { ArmorItem, MagicItem, Weapon } from '@/types/character';
import { Section } from '@/components/ui/layout/section';
import { ArmorRow } from './ArmorRow';
import { MagicItemRow } from './MagicItemRow';
import { WeaponRow } from './WeaponRow';

const timestamp = '2026-10-31T00:00:00.000Z';
const name =
  'A particularly long engraved inventory name that must wrap on a phone';
const weapon: Weapon = {
  id: 'long-weapon',
  name,
  category: 'martial',
  weaponType: ['melee'],
  damage: [{ dice: '1d8', type: 'slashing', label: 'Slash' }],
  enhancementBonus: 1,
  properties: [],
  isEquipped: true,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const magic: MagicItem = {
  id: 'long-magic',
  name,
  category: 'ring',
  rarity: 'very rare',
  description: 'A ring with a long history.',
  properties: [],
  isEquipped: true,
  requiresAttunement: true,
  isAttuned: true,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const armor: ArmorItem = {
  id: 'long-armor',
  name,
  category: 'heavy',
  type: 'plate',
  baseAC: 18,
  enhancementBonus: 1,
  isEquipped: true,
  stealthDisadvantage: false,
  createdAt: timestamp,
  updatedAt: timestamp,
};

function EquipmentRows() {
  return (
    <div className="space-y-5">
      <Section heading="Weapons" level={3}>
        <WeaponRow
          weapon={weapon}
          characterLevel={8}
          onEdit={fn()}
          onDelete={fn()}
          onToggleEquip={fn()}
        />
      </Section>
      <Section heading="Magic items" level={3}>
        <MagicItemRow
          item={magic}
          characterLevel={8}
          onEdit={fn()}
          onDelete={fn()}
          onToggleAttunement={fn()}
          onExpendCharge={fn()}
          onRestoreCharge={fn()}
        />
      </Section>
      <Section heading="Armor" level={3}>
        <ArmorRow
          armor={armor}
          onEdit={fn()}
          onDelete={fn()}
          onToggleEquip={fn()}
        />
      </Section>
    </div>
  );
}

const meta: Meta<typeof EquipmentRows> = {
  component: EquipmentRows,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const LongNames390: Story = {
  decorators: [
    Story => (
      <div style={{ width: 390 }}>
        <Story />
      </div>
    ),
  ],
};

export const LongNames430: Story = {
  decorators: [
    Story => (
      <div style={{ width: 430 }}>
        <Story />
      </div>
    ),
  ],
};

export const LongNames500Dark: Story = {
  globals: { theme: 'dark' },
  decorators: [
    Story => (
      <div style={{ width: 500 }}>
        <Story />
      </div>
    ),
  ],
};
