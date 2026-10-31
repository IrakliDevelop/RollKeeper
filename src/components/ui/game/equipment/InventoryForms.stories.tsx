import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ItemForm, initialInventoryFormData } from '../inventory/ItemForm';
import { MagicItemForm, type MagicItemFormData } from './MagicItemForm';
import { WeaponForm, type WeaponFormData } from './WeaponForm';

const pool = {
  maxCharges: 7,
  usedCharges: 2,
  rechargeType: 'dawn' as const,
  abilities: [{ id: 'light', name: 'Light', cost: 1 }],
};

const initialWeapon: WeaponFormData = {
  name: 'Moonlit Blade',
  category: 'magic',
  weaponType: ['melee', 'finesse'],
  damage: [
    { dice: '1d8', type: 'slashing', label: 'Blade' },
    { dice: '1d4', type: 'radiant', label: 'Moonlight' },
  ],
  enhancementBonus: 1,
  properties: [],
  isEquipped: true,
  charges: [{ name: 'Gleam', maxCharges: 3, usedCharges: 1, restType: 'dawn' }],
  chargePool: pool,
};

const initialMagic: MagicItemFormData = {
  name: 'Moonstone of Returning',
  category: 'wondrous',
  rarity: 'very rare',
  description: '',
  properties: [],
  requiresAttunement: true,
  isAttuned: false,
  charges: [
    { name: 'Return', maxCharges: 3, usedCharges: 1, restType: 'dawn' },
  ],
  chargePool: pool,
};

function InventoryFormsPreview({
  kind,
}: {
  kind: 'weapon' | 'magic' | 'item';
}) {
  const [weapon, setWeapon] = useState(initialWeapon);
  const [magic, setMagic] = useState(initialMagic);
  if (kind === 'weapon') {
    return (
      <div style={{ width: 390 }}>
        <WeaponForm
          formData={weapon}
          setFormData={setWeapon}
          onSubmit={fn()}
          onCancel={fn()}
          isEditing
        />
      </div>
    );
  }
  if (kind === 'magic') {
    return (
      <div style={{ width: 390 }}>
        <MagicItemForm
          formData={magic}
          setFormData={setMagic}
          onSubmit={fn()}
          onCancel={fn()}
          isEditing
        />
      </div>
    );
  }
  return (
    <ItemForm
      isOpen
      onClose={fn()}
      onSubmit={fn()}
      initialData={{
        ...initialInventoryFormData,
        name: 'A particularly long inventory item name',
        tags: ['quest', 'utility'],
      }}
      availableLocations={['Backpack', 'Saddlebags']}
      isEditing
    />
  );
}

const meta: Meta<typeof InventoryFormsPreview> = {
  component: InventoryFormsPreview,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const PopulatedWeapon390: Story = { args: { kind: 'weapon' } };
export const PopulatedMagic390: Story = { args: { kind: 'magic' } };
export const PopulatedItem390: Story = { args: { kind: 'item' } };
