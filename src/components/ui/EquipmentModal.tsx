'use client';

import React, { useState } from 'react';
import { Weapon, MagicItem, MagicItemCategory, MagicItemRarity, WeaponCategory, WeaponType, DamageType } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus, Edit2, Trash2, Shield, Zap, Eye, Sword, Target, Star, Wand2, X } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { FancySelect } from '@/components/ui/FancySelect';

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
  damage: {
    dice: string;
    type: DamageType;
    versatiledice?: string;
  };
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
  damage: {
    dice: '1d6',
    type: 'bludgeoning',
  },
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
  'wondrous', 'armor', 'shield', 'ring', 'staff', 'wand', 'rod', 'scroll', 'potion', 'artifact', 'other'
];

const MAGIC_ITEM_RARITIES: MagicItemRarity[] = [
  'common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'
];

const WEAPON_CATEGORIES: WeaponCategory[] = ['simple', 'martial', 'magic', 'artifact'];
const WEAPON_TYPES: WeaponType[] = ['melee', 'ranged', 'finesse', 'versatile', 'light', 'heavy', 'reach', 'thrown', 'ammunition', 'loading', 'special'];
const DAMAGE_TYPES: DamageType[] = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];

const getRarityColor = (rarity: MagicItemRarity) => {
  switch (rarity) {
    case 'common': return 'text-gray-600 bg-gray-100';
    case 'uncommon': return 'text-green-600 bg-green-100';
    case 'rare': return 'text-blue-600 bg-blue-100';
    case 'very rare': return 'text-purple-600 bg-purple-100';
    case 'legendary': return 'text-orange-600 bg-orange-100';
    case 'artifact': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

export default function EquipmentModal({ isOpen, onClose }: EquipmentModalProps) {
  const { 
    character, 
    addMagicItem, 
    updateMagicItem, 
    deleteMagicItem, 
    attuneMagicItem,
    addWeapon,
    updateWeapon,
    deleteWeapon,
    equipWeapon 
  } = useCharacterStore();
  
  const [showMagicItemForm, setShowMagicItemForm] = useState(false);
  const [showWeaponForm, setShowWeaponForm] = useState(false);
  const [editingMagicItem, setEditingMagicItem] = useState<MagicItem | null>(null);
  const [editingWeapon, setEditingWeapon] = useState<Weapon | null>(null);
  const [magicItemForm, setMagicItemForm] = useState<MagicItemFormData>(initialMagicItemData);
  const [weaponForm, setWeaponForm] = useState<WeaponFormData>(initialWeaponData);
  const [propertyInput, setPropertyInput] = useState('');

  // Calculate attunement usage
  const attunedItems = character.magicItems.filter(item => item.isAttuned).length;
  const weaponsRequiringAttunement = character.weapons.filter(weapon => weapon.isAttuned).length;
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
      range: weaponForm.range?.normal ? {
        normal: weaponForm.range.normal,
        long: weaponForm.range.long
      } : undefined,
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
    setWeaponForm({
      name: weapon.name,
      category: weapon.category,
      weaponType: weapon.weaponType,
      damage: weapon.damage,
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
      alert(`Cannot attune to more items. Maximum attunement slots: ${character.attunementSlots.max}`);
      return;
    }
    attuneMagicItem(item.id, shouldAttune);
  };

  const addProperty = () => {
    if (propertyInput.trim() && !weaponForm.properties.includes(propertyInput.trim())) {
      setWeaponForm(prev => ({
        ...prev,
        properties: [...prev.properties, propertyInput.trim()]
      }));
      setPropertyInput('');
    }
  };

  const removeProperty = (index: number) => {
    setWeaponForm(prev => ({
      ...prev,
      properties: prev.properties.filter((_, i) => i !== index)
    }));
  };

  const toggleWeaponType = (type: WeaponType) => {
    setWeaponForm(prev => ({
      ...prev,
      weaponType: prev.weaponType.includes(type)
        ? prev.weaponType.filter(t => t !== type)
        : [...prev.weaponType, type]
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
    <ModalPortal isOpen={isOpen}>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && handleCloseModal()}
      >
        <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              ⚔️ Equipment & Magic Items
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Attunement:</span> {totalAttuned}/{character.attunementSlots.max}
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Show forms if active, otherwise show main content */}
          {showWeaponForm ? (
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="max-w-2xl mx-auto">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  {editingWeapon ? 'Edit Weapon' : 'Add Weapon'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={weaponForm.name}
                      onChange={(e) => setWeaponForm({ ...weaponForm, name: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                      placeholder="e.g., Longsword, +1 Dagger"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={weaponForm.category}
                        onChange={(e) => setWeaponForm({ ...weaponForm, category: e.target.value as WeaponCategory })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                      >
                        {WEAPON_CATEGORIES.map(category => (
                          <option key={category} value={category} className="text-gray-900">
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enhancement Bonus</label>
                      <input
                        type="number"
                        value={weaponForm.enhancementBonus}
                        onChange={(e) => setWeaponForm({ ...weaponForm, enhancementBonus: parseInt(e.target.value) || 0 })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                        min="0"
                        max="3"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Damage Dice</label>
                      <input
                        type="text"
                        value={weaponForm.damage.dice}
                        onChange={(e) => setWeaponForm({ 
                          ...weaponForm, 
                          damage: { ...weaponForm.damage, dice: e.target.value }
                        })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                        placeholder="1d8"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Damage Type</label>
                      <select
                        value={weaponForm.damage.type}
                        onChange={(e) => setWeaponForm({ 
                          ...weaponForm, 
                          damage: { ...weaponForm.damage, type: e.target.value as DamageType }
                        })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                      >
                        {DAMAGE_TYPES.map(type => (
                          <option key={type} value={type} className="text-gray-900">
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Versatile Dice</label>
                      <input
                        type="text"
                        value={weaponForm.damage.versatiledice || ''}
                        onChange={(e) => setWeaponForm({ 
                          ...weaponForm, 
                          damage: { ...weaponForm.damage, versatiledice: e.target.value || undefined }
                        })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                        placeholder="1d10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Weapon Types</label>
                    <div className="grid grid-cols-3 gap-2">
                      {WEAPON_TYPES.map(type => (
                        <label key={type} className="flex items-center text-sm text-gray-800">
                          <input
                            type="checkbox"
                            checked={weaponForm.weaponType.includes(type)}
                            onChange={() => toggleWeaponType(type)}
                            className="mr-2 rounded"
                          />
                          <span className="capitalize text-gray-800">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={weaponForm.description || ''}
                      onChange={(e) => setWeaponForm({ ...weaponForm, description: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                      rows={3}
                      placeholder="Special properties, abilities, or description..."
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={weaponForm.isEquipped}
                        onChange={(e) => setWeaponForm({ ...weaponForm, isEquipped: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-800">Currently Equipped</span>
                    </label>

                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={weaponForm.requiresAttunement || false}
                        onChange={(e) => setWeaponForm({ 
                          ...weaponForm, 
                          requiresAttunement: e.target.checked,
                          isAttuned: e.target.checked ? weaponForm.isAttuned : false
                        })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-800">Requires Attunement</span>
                    </label>

                    {weaponForm.requiresAttunement && (
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={weaponForm.isAttuned || false}
                          onChange={(e) => setWeaponForm({ ...weaponForm, isAttuned: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-800">Currently Attuned</span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowWeaponForm(false);
                      setEditingWeapon(null);
                      setWeaponForm(initialWeaponData);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWeaponSubmit}
                    disabled={!weaponForm.name.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {editingWeapon ? 'Update' : 'Add'} Weapon
                  </button>
                </div>
              </div>
            </div>
          ) : showMagicItemForm ? (
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="max-w-2xl mx-auto">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  {editingMagicItem ? 'Edit Magic Item' : 'Add Magic Item'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={magicItemForm.name}
                      onChange={(e) => setMagicItemForm({ ...magicItemForm, name: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                      placeholder="e.g., Ring of Protection"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={magicItemForm.category}
                        onChange={(e) => setMagicItemForm({ ...magicItemForm, category: e.target.value as MagicItemCategory })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                      >
                        {MAGIC_ITEM_CATEGORIES.map(category => (
                          <option key={category} value={category} className="text-gray-900">
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rarity</label>
                      <select
                        value={magicItemForm.rarity}
                        onChange={(e) => setMagicItemForm({ ...magicItemForm, rarity: e.target.value as MagicItemRarity })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                      >
                        {MAGIC_ITEM_RARITIES.map(rarity => (
                          <option key={rarity} value={rarity} className="text-gray-900">
                            {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={magicItemForm.description}
                      onChange={(e) => setMagicItemForm({ ...magicItemForm, description: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                      rows={3}
                      placeholder="Describe the item's properties and abilities..."
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={magicItemForm.requiresAttunement}
                        onChange={(e) => setMagicItemForm({ 
                          ...magicItemForm, 
                          requiresAttunement: e.target.checked,
                          isAttuned: e.target.checked ? magicItemForm.isAttuned : false
                        })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-800">Requires Attunement</span>
                    </label>

                    {magicItemForm.requiresAttunement && (
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={magicItemForm.isAttuned}
                          onChange={(e) => setMagicItemForm({ ...magicItemForm, isAttuned: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-800">Currently Attuned</span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowMagicItemForm(false);
                      setEditingMagicItem(null);
                      setMagicItemForm(initialMagicItemData);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMagicItemSubmit}
                    disabled={!magicItemForm.name.trim()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {editingMagicItem ? 'Update' : 'Add'} Item
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Main equipment view
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Weapons Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Sword className="h-5 w-5" />
                    Weapons ({character.weapons.length})
                  </h3>
                  <button
                    onClick={() => setShowWeaponForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={16} />
                    Add Weapon
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {character.weapons.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Sword className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                      <p>No weapons added yet</p>
                    </div>
                  ) : (
                    character.weapons.map((weapon) => (
                      <div
                        key={weapon.id}
                        className={`p-4 border rounded-lg transition-all ${
                          weapon.isEquipped 
                            ? 'border-blue-300 bg-blue-50' 
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-800">{weapon.name}</h4>
                              {weapon.enhancementBonus > 0 && (
                                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                  +{weapon.enhancementBonus}
                                </span>
                              )}
                              {weapon.requiresAttunement && (
                                <span className={`text-xs px-2 py-1 rounded ${
                                  weapon.isAttuned ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {weapon.isAttuned ? 'Attuned' : 'Requires Attunement'}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              {weapon.damage.dice} {weapon.damage.type} • {weapon.category}
                            </div>
                            {weapon.description && (
                              <p className="text-sm text-gray-700">{weapon.description}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditWeapon(weapon)}
                                className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                                title="Edit weapon"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => deleteWeapon(weapon.id)}
                                className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                                title="Delete weapon"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <button
                              onClick={() => equipWeapon(weapon.id, !weapon.isEquipped)}
                              className={`px-2 py-1 text-xs rounded transition-colors ${
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
                    ))
                  )}
                </div>
              </div>

              {/* Magic Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    Magic Items ({character.magicItems.length})
                  </h3>
                  <button
                    onClick={() => setShowMagicItemForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus size={16} />
                    Add Magic Item
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {character.magicItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Wand2 className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                      <p>No magic items added yet</p>
                    </div>
                  ) : (
                    character.magicItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 border rounded-lg transition-all ${
                          item.isEquipped 
                            ? 'border-purple-300 bg-purple-50' 
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-800">{item.name}</h4>
                              <span className={`text-xs px-2 py-1 rounded ${getRarityColor(item.rarity)}`}>
                                {item.rarity}
                              </span>
                              {item.requiresAttunement && (
                                <span className={`text-xs px-2 py-1 rounded ${
                                  item.isAttuned ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {item.isAttuned ? 'Attuned' : 'Requires Attunement'}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              {item.category} • {item.rarity}
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{item.description}</p>
                            {item.charges && (
                              <div className="text-sm text-blue-600">
                                Charges: {item.charges.current}/{item.charges.max}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditMagicItem(item)}
                                className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                                title="Edit item"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => deleteMagicItem(item.id)}
                                className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                                title="Delete item"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            {item.requiresAttunement && (
                              <button
                                onClick={() => handleAttunement(item, !item.isAttuned)}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
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
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
} 