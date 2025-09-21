'use client';

import React, { useState } from 'react';
import {
  Weapon,
  MagicItem,
  MagicItemCategory,
  MagicItemRarity,
  WeaponCategory,
  WeaponType,
  DamageType,
  WeaponDamage,
} from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus, Edit2, Trash2, Sword, Wand2 } from 'lucide-react';
import { Modal } from '@/components/ui/feedback/Modal';
import DragDropList from '@/components/ui/layout/DragDropList';

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
  damage: WeaponDamage[]; // Updated to array of damage entries
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

const MAGIC_ITEM_CATEGORIES: MagicItemCategory[] = [
  'wondrous',
  'armor',
  'shield',
  'ring',
  'staff',
  'wand',
  'rod',
  'scroll',
  'potion',
  'artifact',
  'other',
];

const MAGIC_ITEM_RARITIES: MagicItemRarity[] = [
  'common',
  'uncommon',
  'rare',
  'very rare',
  'legendary',
  'artifact',
];

const WEAPON_CATEGORIES: WeaponCategory[] = [
  'simple',
  'martial',
  'magic',
  'artifact',
];
const WEAPON_TYPES: WeaponType[] = [
  'melee',
  'ranged',
  'finesse',
  'versatile',
  'light',
  'heavy',
  'reach',
  'thrown',
  'ammunition',
  'loading',
  'special',
];
const DAMAGE_TYPES: DamageType[] = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
];

const getRarityColor = (rarity: MagicItemRarity) => {
  switch (rarity) {
    case 'common':
      return 'text-gray-600 bg-gray-100';
    case 'uncommon':
      return 'text-green-600 bg-green-100';
    case 'rare':
      return 'text-blue-600 bg-blue-100';
    case 'very rare':
      return 'text-purple-600 bg-purple-100';
    case 'legendary':
      return 'text-orange-600 bg-orange-100';
    case 'artifact':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
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
  const [, setPropertyInput] = useState('');

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
    setPropertyInput('');
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

  const toggleWeaponType = (type: WeaponType) => {
    setWeaponForm(prev => ({
      ...prev,
      weaponType: prev.weaponType.includes(type)
        ? prev.weaponType.filter(t => t !== type)
        : [...prev.weaponType, type],
    }));
  };

  const handleCloseModal = () => {
    setShowMagicItemForm(false);
    setShowWeaponForm(false);
    setEditingMagicItem(null);
    setEditingWeapon(null);
    setMagicItemForm(initialMagicItemData);
    setWeaponForm(initialWeaponData);
    setPropertyInput('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseModal}
      title={`⚔️ Equipment & Magic Items (Attunement: ${totalAttuned}/${character.attunementSlots.max})`}
      size="full"
      closeOnBackdropClick={true}
    >

          {/* Show forms if active, otherwise show main content */}
          {showWeaponForm ? (
            <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-6">
              <div className="mx-auto max-w-2xl">
                <h3 className="mb-4 text-xl font-bold text-gray-800">
                  {editingWeapon ? 'Edit Weapon' : 'Add Weapon'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      type="text"
                      value={weaponForm.name}
                      onChange={e =>
                        setWeaponForm({ ...weaponForm, name: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Longsword, +1 Dagger"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Category
                      </label>
                      <select
                        value={weaponForm.category}
                        onChange={e =>
                          setWeaponForm({
                            ...weaponForm,
                            category: e.target.value as WeaponCategory,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      >
                        {WEAPON_CATEGORIES.map(category => (
                          <option
                            key={category}
                            value={category}
                            className="text-gray-900"
                          >
                            {category.charAt(0).toUpperCase() +
                              category.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Enhancement Bonus
                      </label>
                      <input
                        type="number"
                        value={weaponForm.enhancementBonus}
                        onChange={e =>
                          setWeaponForm({
                            ...weaponForm,
                            enhancementBonus: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="3"
                      />
                    </div>
                  </div>

                  {/* Multiple Damage Entries */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Damage Entries
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const newDamage: WeaponDamage = {
                            dice: '1d6',
                            type: 'fire',
                            label: 'Additional Damage',
                          };
                          setWeaponForm({
                            ...weaponForm,
                            damage: [...weaponForm.damage, newDamage],
                          });
                        }}
                        className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
                      >
                        <Plus size={14} className="mr-1 inline" />
                        Add Damage Type
                      </button>
                    </div>

                    {weaponForm.damage.map((damage, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-700">
                            {damage.label || `Damage ${index + 1}`}
                          </h4>
                          {weaponForm.damage.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newDamage = weaponForm.damage.filter(
                                  (_, i) => i !== index
                                );
                                setWeaponForm({
                                  ...weaponForm,
                                  damage: newDamage,
                                });
                              }}
                              className="text-red-600 transition-colors hover:text-red-800"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Label
                            </label>
                            <input
                              type="text"
                              value={damage.label || ''}
                              onChange={e => {
                                const newDamage = [...weaponForm.damage];
                                newDamage[index] = {
                                  ...damage,
                                  label: e.target.value,
                                };
                                setWeaponForm({
                                  ...weaponForm,
                                  damage: newDamage,
                                });
                              }}
                              className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., Fire Damage"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Dice
                            </label>
                            <input
                              type="text"
                              value={damage.dice}
                              onChange={e => {
                                const newDamage = [...weaponForm.damage];
                                newDamage[index] = {
                                  ...damage,
                                  dice: e.target.value,
                                };
                                setWeaponForm({
                                  ...weaponForm,
                                  damage: newDamage,
                                });
                              }}
                              className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                              placeholder="1d8"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Type
                            </label>
                            <select
                              value={damage.type}
                              onChange={e => {
                                const newDamage = [...weaponForm.damage];
                                newDamage[index] = {
                                  ...damage,
                                  type: e.target.value as DamageType,
                                };
                                setWeaponForm({
                                  ...weaponForm,
                                  damage: newDamage,
                                });
                              }}
                              className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                            >
                              {DAMAGE_TYPES.map(type => (
                                <option
                                  key={type}
                                  value={type}
                                  className="text-gray-900"
                                >
                                  {type.charAt(0).toUpperCase() + type.slice(1)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Versatile
                            </label>
                            <input
                              type="text"
                              value={damage.versatiledice || ''}
                              onChange={e => {
                                const newDamage = [...weaponForm.damage];
                                newDamage[index] = {
                                  ...damage,
                                  versatiledice: e.target.value || undefined,
                                };
                                setWeaponForm({
                                  ...weaponForm,
                                  damage: newDamage,
                                });
                              }}
                              className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                              placeholder="1d10"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Weapon Types
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {WEAPON_TYPES.map(type => (
                        <label
                          key={type}
                          className="flex items-center text-sm text-gray-800"
                        >
                          <input
                            type="checkbox"
                            checked={weaponForm.weaponType.includes(type)}
                            onChange={() => toggleWeaponType(type)}
                            className="mr-2 rounded"
                          />
                          <span className="text-gray-800 capitalize">
                            {type}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={weaponForm.description || ''}
                      onChange={e =>
                        setWeaponForm({
                          ...weaponForm,
                          description: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Special properties, abilities, or description..."
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={weaponForm.isEquipped}
                        onChange={e =>
                          setWeaponForm({
                            ...weaponForm,
                            isEquipped: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      <span className="text-sm text-gray-800">
                        Currently Equipped
                      </span>
                    </label>

                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={weaponForm.requiresAttunement || false}
                        onChange={e =>
                          setWeaponForm({
                            ...weaponForm,
                            requiresAttunement: e.target.checked,
                            isAttuned: e.target.checked
                              ? weaponForm.isAttuned
                              : false,
                          })
                        }
                        className="rounded"
                      />
                      <span className="text-sm text-gray-800">
                        Requires Attunement
                      </span>
                    </label>

                    {weaponForm.requiresAttunement && (
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={weaponForm.isAttuned || false}
                          onChange={e =>
                            setWeaponForm({
                              ...weaponForm,
                              isAttuned: e.target.checked,
                            })
                          }
                          className="rounded"
                        />
                        <span className="text-sm text-gray-800">
                          Currently Attuned
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
                  <button
                    onClick={() => {
                      setShowWeaponForm(false);
                      setEditingWeapon(null);
                      setWeaponForm(initialWeaponData);
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWeaponSubmit}
                    disabled={!weaponForm.name.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editingWeapon ? 'Update' : 'Add'} Weapon
                  </button>
                </div>
              </div>
            </div>
          ) : showMagicItemForm ? (
            <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-6">
              <div className="mx-auto max-w-2xl">
                <h3 className="mb-4 text-xl font-bold text-gray-800">
                  {editingMagicItem ? 'Edit Magic Item' : 'Add Magic Item'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      type="text"
                      value={magicItemForm.name}
                      onChange={e =>
                        setMagicItemForm({
                          ...magicItemForm,
                          name: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., Ring of Protection"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Category
                      </label>
                      <select
                        value={magicItemForm.category}
                        onChange={e =>
                          setMagicItemForm({
                            ...magicItemForm,
                            category: e.target.value as MagicItemCategory,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                      >
                        {MAGIC_ITEM_CATEGORIES.map(category => (
                          <option
                            key={category}
                            value={category}
                            className="text-gray-900"
                          >
                            {category.charAt(0).toUpperCase() +
                              category.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Rarity
                      </label>
                      <select
                        value={magicItemForm.rarity}
                        onChange={e =>
                          setMagicItemForm({
                            ...magicItemForm,
                            rarity: e.target.value as MagicItemRarity,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                      >
                        {MAGIC_ITEM_RARITIES.map(rarity => (
                          <option
                            key={rarity}
                            value={rarity}
                            className="text-gray-900"
                          >
                            {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={magicItemForm.description}
                      onChange={e =>
                        setMagicItemForm({
                          ...magicItemForm,
                          description: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                      rows={3}
                      placeholder="Describe the item's properties and abilities..."
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={magicItemForm.requiresAttunement}
                        onChange={e =>
                          setMagicItemForm({
                            ...magicItemForm,
                            requiresAttunement: e.target.checked,
                            isAttuned: e.target.checked
                              ? magicItemForm.isAttuned
                              : false,
                          })
                        }
                        className="rounded"
                      />
                      <span className="text-sm text-gray-800">
                        Requires Attunement
                      </span>
                    </label>

                    {magicItemForm.requiresAttunement && (
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={magicItemForm.isAttuned}
                          onChange={e =>
                            setMagicItemForm({
                              ...magicItemForm,
                              isAttuned: e.target.checked,
                            })
                          }
                          className="rounded"
                        />
                        <span className="text-sm text-gray-800">
                          Currently Attuned
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
                  <button
                    onClick={() => {
                      setShowMagicItemForm(false);
                      setEditingMagicItem(null);
                      setMagicItemForm(initialMagicItemData);
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMagicItemSubmit}
                    disabled={!magicItemForm.name.trim()}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editingMagicItem ? 'Update' : 'Add'} Item
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Main equipment view
            <div className="grid max-h-[calc(90vh-120px)] grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-2">
              {/* Weapons Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xl font-bold text-gray-800">
                    <Sword className="h-5 w-5" />
                    Weapons ({character.weapons.length})
                  </h3>
                  <button
                    onClick={() => setShowWeaponForm(true)}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                  >
                    <Plus size={16} />
                    Add Weapon
                  </button>
                </div>

                <div className="max-h-96 space-y-3 overflow-y-auto">
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
                        <div
                          className={`rounded-lg border p-4 transition-all ${
                            weapon.isEquipped
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <h4 className="font-semibold text-gray-800">
                                  {weapon.name}
                                </h4>
                                {weapon.enhancementBonus > 0 && (
                                  <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                                    +{weapon.enhancementBonus}
                                  </span>
                                )}
                                {weapon.requiresAttunement && (
                                  <span
                                    className={`rounded px-2 py-1 text-xs ${
                                      weapon.isAttuned
                                        ? 'bg-purple-100 text-purple-800'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {weapon.isAttuned
                                      ? 'Attuned'
                                      : 'Requires Attunement'}
                                  </span>
                                )}
                              </div>
                              <div className="mb-2 text-sm text-gray-600">
                                {(() => {
                                  if (Array.isArray(weapon.damage)) {
                                    // New format: array of damage entries
                                    return weapon.damage.length > 0
                                      ? weapon.damage.map((dmg, idx) => (
                                          <span key={idx}>
                                            {dmg.dice} {dmg.type}
                                            {dmg.label &&
                                              dmg.label !== 'Weapon Damage' &&
                                              ` (${dmg.label})`}
                                            {idx < weapon.damage.length - 1 &&
                                              ', '}
                                          </span>
                                        ))
                                      : 'No damage defined';
                                  } else {
                                    // Old format: single damage object
                                    const legacyDamage = weapon.damage as {
                                      dice: string;
                                      type: string;
                                      versatiledice?: string;
                                    };
                                    return legacyDamage &&
                                      legacyDamage.dice &&
                                      legacyDamage.type
                                      ? `${legacyDamage.dice} ${legacyDamage.type}`
                                      : 'No damage defined';
                                  }
                                })()}{' '}
                                • {weapon.category}
                              </div>
                              {weapon.description && (
                                <p className="text-sm text-gray-700">
                                  {weapon.description}
                                </p>
                              )}
                            </div>
                            <div className="ml-4 flex flex-col gap-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditWeapon(weapon)}
                                  className="p-1 text-gray-600 transition-colors hover:text-blue-600"
                                  title="Edit weapon"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => deleteWeapon(weapon.id)}
                                  className="p-1 text-gray-600 transition-colors hover:text-red-600"
                                  title="Delete weapon"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  equipWeapon(weapon.id, !weapon.isEquipped)
                                }
                                className={`rounded px-2 py-1 text-xs transition-colors ${
                                  weapon.isEquipped
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-gray-200 text-gray-700 hover:bg-blue-100'
                                }`}
                              >
                                {weapon.isEquipped ? 'Equipped' : 'Equip'}
                              </button>
                            </div>
                          </div>
                        </div>
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
                  <button
                    onClick={() => setShowMagicItemForm(true)}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
                  >
                    <Plus size={16} />
                    Add Magic Item
                  </button>
                </div>

                <div className="max-h-96 space-y-3 overflow-y-auto">
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
                        <div
                          className={`rounded-lg border p-4 transition-all ${
                            item.isEquipped
                              ? 'border-purple-300 bg-purple-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <h4 className="font-semibold text-gray-800">
                                  {item.name}
                                </h4>
                                <span
                                  className={`rounded px-2 py-1 text-xs ${getRarityColor(item.rarity)}`}
                                >
                                  {item.rarity}
                                </span>
                                {item.requiresAttunement && (
                                  <span
                                    className={`rounded px-2 py-1 text-xs ${
                                      item.isAttuned
                                        ? 'bg-purple-100 text-purple-800'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {item.isAttuned
                                      ? 'Attuned'
                                      : 'Requires Attunement'}
                                  </span>
                                )}
                              </div>
                              <div className="mb-2 text-sm text-gray-600">
                                {item.category} • {item.rarity}
                              </div>
                              <p className="mb-2 text-sm text-gray-700">
                                {item.description}
                              </p>
                              {item.charges && (
                                <div className="text-sm text-blue-600">
                                  Charges: {item.charges.current}/
                                  {item.charges.max}
                                </div>
                              )}
                            </div>
                            <div className="ml-4 flex flex-col gap-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditMagicItem(item)}
                                  className="p-1 text-gray-600 transition-colors hover:text-blue-600"
                                  title="Edit item"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => deleteMagicItem(item.id)}
                                  className="p-1 text-gray-600 transition-colors hover:text-red-600"
                                  title="Delete item"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              {item.requiresAttunement && (
                                <button
                                  onClick={() =>
                                    handleAttunement(item, !item.isAttuned)
                                  }
                                  className={`rounded px-2 py-1 text-xs transition-colors ${
                                    item.isAttuned
                                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                                      : 'bg-gray-200 text-gray-700 hover:bg-purple-100'
                                  }`}
                                >
                                  {item.isAttuned ? 'Unattune' : 'Attune'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
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
