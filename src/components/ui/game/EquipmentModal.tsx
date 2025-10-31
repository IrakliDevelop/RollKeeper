'use client';

import React, { useState } from 'react';
import {
  Weapon,
  MagicItem,
  WeaponCategory,
  WeaponType,
  DamageType,
  WeaponDamage,
  MagicItemCategory,
  MagicItemRarity,
} from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus, Sword, Wand2 } from 'lucide-react';
import { Modal } from '@/components/ui/feedback/Modal';
import DragDropList from '@/components/ui/layout/DragDropList';
import { Button } from '@/components/ui/forms/button';
import {
  WeaponCard,
  MagicItemCard,
  WeaponForm,
  MagicItemForm,
} from './equipment';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MagicItemFormData {
  name: string;
  category: MagicItemCategory;
  rarity: MagicItemRarity;
  description: string;
  properties: string[];
  requiresAttunement: boolean;
  isAttuned: boolean;
  isEquipped?: boolean;
  charges?: {
    current: number;
    max: number;
    rechargeRule?: string;
  };
}

interface WeaponFormData {
  name: string;
  category: WeaponCategory;
  weaponType: WeaponType[];
  damage: WeaponDamage[];
  enhancementBonus: number;
  attackBonus?: number;
  damageBonus?: number;
  properties: string[];
  description?: string;
  range?: {
    normal?: number;
    long?: number;
  };
  isEquipped: boolean;
  manualProficiency?: boolean;
  requiresAttunement?: boolean;
  isAttuned?: boolean;
}

const initialMagicItemData: MagicItemFormData = {
  name: '',
  category: 'wondrous',
  rarity: 'common',
  description: '',
  properties: [],
  requiresAttunement: false,
  isAttuned: false,
  isEquipped: false,
};

const initialWeaponData: WeaponFormData = {
  name: '',
  category: 'simple',
  weaponType: ['melee'],
  damage: [
    {
      dice: '1d6',
      type: 'bludgeoning',
      label: 'Weapon Damage',
    },
  ],
  enhancementBonus: 0,
  attackBonus: 0,
  damageBonus: 0,
  properties: [],
  description: '',
  range: {
    normal: 5,
  },
  isEquipped: false,
  manualProficiency: undefined,
  requiresAttunement: false,
  isAttuned: false,
};

export default function EquipmentModal({
  isOpen,
  onClose,
}: EquipmentModalProps) {
  const {
    character,
    addMagicItem,
    updateMagicItem,
    deleteMagicItem,
    attuneMagicItem,
    reorderMagicItems,
    addWeapon,
    updateWeapon,
    deleteWeapon,
    equipWeapon,
    reorderWeapons,
  } = useCharacterStore();

  const [showMagicItemForm, setShowMagicItemForm] = useState(false);
  const [showWeaponForm, setShowWeaponForm] = useState(false);
  const [editingMagicItem, setEditingMagicItem] = useState<MagicItem | null>(
    null
  );
  const [editingWeapon, setEditingWeapon] = useState<Weapon | null>(null);
  const [magicItemForm, setMagicItemForm] =
    useState<MagicItemFormData>(initialMagicItemData);
  const [weaponForm, setWeaponForm] =
    useState<WeaponFormData>(initialWeaponData);

  // Calculate attunement usage
  const attunedItems = character.magicItems.filter(
    item => item.isAttuned
  ).length;
  const weaponsRequiringAttunement = character.weapons.filter(
    weapon => weapon.isAttuned
  ).length;
  const totalAttuned = attunedItems + weaponsRequiringAttunement;

  const handleMagicItemSubmit = () => {
    if (!magicItemForm.name.trim()) return;

    if (editingMagicItem) {
      updateMagicItem(editingMagicItem.id, magicItemForm);
      setEditingMagicItem(null);
    } else {
      addMagicItem(magicItemForm);
    }

    setMagicItemForm(initialMagicItemData);
    setShowMagicItemForm(false);
  };

  const handleWeaponSubmit = () => {
    if (!weaponForm.name.trim()) return;

    const weaponData = {
      ...weaponForm,
      properties: weaponForm.properties.filter(p => p.trim()),
      range: weaponForm.range?.normal
        ? {
            normal: weaponForm.range.normal,
            long: weaponForm.range.long,
          }
        : undefined,
    };

    if (editingWeapon) {
      updateWeapon(editingWeapon.id, weaponData);
      setEditingWeapon(null);
    } else {
      addWeapon(weaponData);
    }

    setWeaponForm(initialWeaponData);
    setShowWeaponForm(false);
  };

  const handleEditMagicItem = (item: MagicItem) => {
    setMagicItemForm({
      name: item.name,
      category: item.category,
      rarity: item.rarity,
      description: item.description,
      properties: item.properties,
      requiresAttunement: item.requiresAttunement,
      isAttuned: item.isAttuned,
      isEquipped: item.isEquipped,
      charges: item.charges,
    });
    setEditingMagicItem(item);
    setShowMagicItemForm(true);
  };

  const handleEditWeapon = (weapon: Weapon) => {
    // Migrate old damage format to new array format if needed
    let damageArray: WeaponDamage[];
    if (Array.isArray(weapon.damage)) {
      damageArray = weapon.damage;
    } else if (weapon.legacyDamage && weapon.legacyDamage.dice) {
      // Use legacy damage if available
      damageArray = [
        {
          dice: weapon.legacyDamage.dice,
          type: weapon.legacyDamage.type as DamageType,
          versatiledice: weapon.legacyDamage.versatiledice,
          label: 'Weapon Damage',
        },
      ];
    } else {
      // Fallback: create default damage entry
      damageArray = [
        {
          dice: '1d6',
          type: 'bludgeoning',
          label: 'Weapon Damage',
        },
      ];
    }

    setWeaponForm({
      name: weapon.name,
      category: weapon.category,
      weaponType: weapon.weaponType,
      damage: damageArray,
      enhancementBonus: weapon.enhancementBonus,
      attackBonus: weapon.attackBonus || 0,
      damageBonus: weapon.damageBonus || 0,
      properties: weapon.properties,
      description: weapon.description || '',
      range: weapon.range || { normal: 5 },
      isEquipped: weapon.isEquipped,
      manualProficiency: weapon.manualProficiency,
      requiresAttunement: weapon.requiresAttunement || false,
      isAttuned: weapon.isAttuned || false,
    });
    setEditingWeapon(weapon);
    setShowWeaponForm(true);
  };

  const handleAttunement = (item: MagicItem, shouldAttune: boolean) => {
    if (shouldAttune && totalAttuned >= character.attunementSlots.max) {
      alert(
        `Cannot attune to more items. Maximum attunement slots: ${character.attunementSlots.max}`
      );
      return;
    }
    attuneMagicItem(item.id, shouldAttune);
  };

  const handleCloseModal = () => {
    setShowMagicItemForm(false);
    setShowWeaponForm(false);
    setEditingMagicItem(null);
    setEditingWeapon(null);
    setMagicItemForm(initialMagicItemData);
    setWeaponForm(initialWeaponData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseModal}
      title={`⚔️ Equipment & Magic Items (Attunement: ${totalAttuned}/${character.attunementSlots.max})`}
      size="xl"
      closeOnBackdropClick={true}
    >
      {/* Show forms if active, otherwise show main content */}
      {showWeaponForm ? (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800">
            {editingWeapon ? 'Edit Weapon' : 'Add Weapon'}
          </h3>

          <WeaponForm
            formData={weaponForm}
            setFormData={setWeaponForm}
            onSubmit={handleWeaponSubmit}
            onCancel={() => {
              setShowWeaponForm(false);
              setEditingWeapon(null);
              setWeaponForm(initialWeaponData);
            }}
            isEditing={!!editingWeapon}
          />
        </div>
      ) : showMagicItemForm ? (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800">
            {editingMagicItem ? 'Edit Magic Item' : 'Add Magic Item'}
          </h3>

          <MagicItemForm
            formData={magicItemForm}
            setFormData={setMagicItemForm}
            onSubmit={handleMagicItemSubmit}
            onCancel={() => {
              setShowMagicItemForm(false);
              setEditingMagicItem(null);
              setMagicItemForm(initialMagicItemData);
            }}
            isEditing={!!editingMagicItem}
          />
        </div>
      ) : (
        // Main equipment view
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Weapons Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xl font-bold text-gray-800">
                <Sword className="h-5 w-5" />
                Weapons ({character.weapons.length})
              </h3>
              <Button
                onClick={() => setShowWeaponForm(true)}
                variant="primary"
                size="md"
                leftIcon={<Plus size={16} />}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                Add Weapon
              </Button>
            </div>

            <div className="space-y-3">
              {character.weapons.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <Sword className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                  <p>No weapons added yet</p>
                </div>
              ) : (
                <DragDropList
                  items={character.weapons}
                  onReorder={reorderWeapons}
                  keyExtractor={weapon => weapon.id}
                  className="space-y-3"
                  showDragHandle={true}
                  dragHandlePosition="left"
                  renderItem={weapon => (
                    <WeaponCard
                      weapon={weapon}
                      onEdit={handleEditWeapon}
                      onDelete={deleteWeapon}
                      onToggleEquip={equipWeapon}
                    />
                  )}
                />
              )}
            </div>
          </div>

          {/* Magic Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xl font-bold text-gray-800">
                <Wand2 className="h-5 w-5" />
                Magic Items ({character.magicItems.length})
              </h3>
              <Button
                onClick={() => setShowMagicItemForm(true)}
                variant="primary"
                size="md"
                leftIcon={<Plus size={16} />}
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
              >
                Add Magic Item
              </Button>
            </div>

            <div className="space-y-3">
              {character.magicItems.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <Wand2 className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                  <p>No magic items added yet</p>
                </div>
              ) : (
                <DragDropList
                  items={character.magicItems}
                  onReorder={reorderMagicItems}
                  keyExtractor={item => item.id}
                  className="space-y-3"
                  showDragHandle={true}
                  dragHandlePosition="left"
                  renderItem={item => (
                    <MagicItemCard
                      item={item}
                      onEdit={handleEditMagicItem}
                      onDelete={deleteMagicItem}
                      onToggleAttunement={handleAttunement}
                    />
                  )}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
