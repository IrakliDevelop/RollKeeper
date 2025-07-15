'use client';

import React, { useState } from 'react';
import { Weapon, WeaponCategory, WeaponType, DamageType } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus, Edit2, Trash2, Shield, Zap, Eye, Sword, Target } from 'lucide-react';
import { FancySelect } from '@/components/ui/FancySelect';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { 
  isWeaponProficient, 
  getWeaponAttackString, 
  getWeaponDamageString 
} from '@/utils/calculations';

// Constants for dropdowns
const WEAPON_CATEGORIES: WeaponCategory[] = ['simple', 'martial', 'magic', 'artifact'];
const WEAPON_TYPES: WeaponType[] = ['melee', 'ranged', 'finesse', 'versatile', 'light', 'heavy', 'reach', 'thrown', 'ammunition', 'loading', 'special'];
const DAMAGE_TYPES: DamageType[] = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];

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
}

const initialFormData: WeaponFormData = {
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
};

export const WeaponInventory: React.FC = () => {
  const { character, addWeapon, updateWeapon, deleteWeapon, equipWeapon } = useCharacterStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<WeaponFormData>(initialFormData);
  const [propertyInput, setPropertyInput] = useState('');
  const [viewingWeapon, setViewingWeapon] = useState<Weapon | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) return;

    const weaponData = {
      ...formData,
      properties: formData.properties.filter(p => p.trim()),
      range: formData.range?.normal ? {
        normal: formData.range.normal,
        long: formData.range.long
      } : undefined,
    };

    if (editingId) {
      updateWeapon(editingId, weaponData);
    } else {
      addWeapon(weaponData);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setIsFormOpen(false);
    setEditingId(null);
    setPropertyInput('');
  };

  const handleEdit = (weapon: Weapon) => {
    setFormData({
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
    });
    setEditingId(weapon.id);
    setIsFormOpen(true);
  };

  const addProperty = () => {
    if (propertyInput.trim() && !formData.properties.includes(propertyInput.trim())) {
      setFormData(prev => ({
        ...prev,
        properties: [...prev.properties, propertyInput.trim()]
      }));
      setPropertyInput('');
    }
  };

  const removeProperty = (index: number) => {
    setFormData(prev => ({
      ...prev,
      properties: prev.properties.filter((_, i) => i !== index)
    }));
  };

  const toggleWeaponType = (type: WeaponType) => {
    setFormData(prev => ({
      ...prev,
      weaponType: prev.weaponType.includes(type)
        ? prev.weaponType.filter(t => t !== type)
        : [...prev.weaponType, type]
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
          <span className="text-red-600">⚔️</span>
          Weapons & Magic Items
        </h3>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
        >
          <Plus size={16} />
          Add Weapon
        </button>
      </div>

      {/* Weapon List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {character.weapons.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <p>No weapons added yet</p>
            <p className="text-sm mt-1">Click &quot;Add Weapon&quot; to get started</p>
          </div>
        ) : (
          character.weapons.map((weapon) => {
            const isProficient = isWeaponProficient(character, weapon);
            const attackString = getWeaponAttackString(character, weapon);
            const damageString = getWeaponDamageString(character, weapon);
            const versatileDamageString = weapon.damage.versatiledice 
              ? getWeaponDamageString(character, weapon, true)
              : null;

            return (
              <div
                key={weapon.id}
                className={`p-3 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer ${
                  weapon.isEquipped
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 bg-gray-50 hover:border-blue-300'
                }`}
                onClick={() => setViewingWeapon(weapon)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-800">{weapon.name}</h4>
                      {weapon.enhancementBonus > 0 && (
                        <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded">
                          +{weapon.enhancementBonus}
                        </span>
                      )}
                      {weapon.manualProficiency !== undefined ? (
                        <span className={`text-xs px-2 py-1 rounded ${
                          weapon.manualProficiency
                            ? 'bg-green-200 text-green-800'
                            : 'bg-red-200 text-red-800'
                        }`}>
                          {weapon.manualProficiency ? 'Proficient (Manual)' : 'Not Proficient (Manual)'}
                        </span>
                      ) : !isProficient && (
                        <span className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded">
                          Not Proficient
                        </span>
                      )}
                      {weapon.isEquipped && (
                        <Shield size={16} className="text-green-600" />
                      )}
                      {(weapon.category === 'magic' || weapon.category === 'artifact') && (
                        <Zap size={16} className="text-purple-600" />
                      )}
                    </div>
                    
                    {/* D&D Attack and Damage Info */}
                    <div className="grid grid-cols-2 gap-4 mb-2">
                      <div className="flex items-center gap-1">
                        <Target size={14} className="text-red-600" />
                        <span className="text-sm font-medium text-gray-800">{attackString}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Sword size={14} className="text-blue-600" />
                        <span className="text-sm font-medium text-gray-800">{damageString}</span>
                      </div>
                    </div>

                    {versatileDamageString && (
                      <div className="text-xs text-purple-600 mb-1">
                        Versatile: {versatileDamageString}
                      </div>
                    )}

                    <div className="text-sm text-gray-600">
                      <span className="capitalize">{weapon.category}</span> •{' '}
                      <span className="capitalize">{weapon.weaponType.join(', ')}</span>
                    </div>
                    
                    {weapon.properties.length > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
                        {weapon.properties.join(', ')}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingWeapon(weapon);
                      }}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        equipWeapon(weapon.id, !weapon.isEquipped);
                      }}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        weapon.isEquipped
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                      }`}
                    >
                      {weapon.isEquipped ? 'Equipped' : 'Equip'}
                    </button>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(weapon);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteWeapon(weapon.id);
                        }}
                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Form Modal */}
      <ModalPortal isOpen={isFormOpen}>
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && resetForm()}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }}
        >
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-blue-200 transform animate-in zoom-in-95 fade-in-0 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-blue-600 text-xl">⚔️</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-800">
                  {editingId ? 'Edit Weapon' : 'Add New Weapon'}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Basic Info */}
                <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-blue-600">📝</span>
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Weapon Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                        placeholder="Longsword, Staff of Power, etc."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Category
                      </label>
                      <FancySelect
                        options={WEAPON_CATEGORIES.map(cat => ({
                          value: cat,
                          label: cat.charAt(0).toUpperCase() + cat.slice(1),
                          description: cat === 'simple' ? 'Basic weapons (clubs, daggers, etc.)' :
                                     cat === 'martial' ? 'Advanced weapons (swords, bows, etc.)' :
                                     cat === 'magic' ? 'Magical weapons with special properties' :
                                     'Legendary artifacts with unique powers'
                        }))}
                        value={formData.category}
                        onChange={(value) => setFormData(prev => ({ ...prev, category: value as WeaponCategory }))}
                        color="blue"
                      />
                    </div>
                  </div>
                </div>

                {/* Weapon Types */}
                <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-blue-600">🗡️</span>
                    Weapon Properties
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {WEAPON_TYPES.map(type => (
                      <label key={type} className="flex items-center text-sm text-gray-800 hover:bg-blue-50 p-2 rounded-lg transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.weaponType.includes(type)}
                          onChange={() => toggleWeaponType(type)}
                          className="mr-2 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="capitalize font-medium">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Damage */}
                <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-red-600">💥</span>
                    Damage Configuration
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Damage Dice
                      </label>
                      <input
                        type="text"
                        value={formData.damage.dice}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          damage: { ...prev.damage, dice: e.target.value }
                        }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                        placeholder="1d8, 2d6, etc."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Damage Type
                      </label>
                      <FancySelect
                        options={DAMAGE_TYPES.map(type => ({
                          value: type,
                          label: type.charAt(0).toUpperCase() + type.slice(1),
                          description: type === 'bludgeoning' ? 'Clubs, hammers, falling' :
                                     type === 'piercing' ? 'Arrows, spears, fangs' :
                                     type === 'slashing' ? 'Swords, axes, claws' :
                                     type === 'fire' ? 'Flames, lava, dragons' :
                                     type === 'cold' ? 'Ice, frost, winter' :
                                     type === 'lightning' ? 'Electricity, storms' :
                                     type === 'poison' ? 'Venom, toxins' :
                                     type === 'acid' ? 'Corrosive substances' :
                                     type === 'psychic' ? 'Mental attacks' :
                                     type === 'necrotic' ? 'Death energy' :
                                     type === 'radiant' ? 'Divine, holy light' :
                                     type === 'force' ? 'Pure magical energy' :
                                     'Sound, sonic attacks'
                        }))}
                        value={formData.damage.type}
                        onChange={(value) => setFormData(prev => ({
                          ...prev,
                          damage: { ...prev.damage, type: value as DamageType }
                        }))}
                        color="blue"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Versatile Dice (optional)
                      </label>
                      <input
                        type="text"
                        value={formData.damage.versatiledice || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          damage: { ...prev.damage, versatiledice: e.target.value || undefined }
                        }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                        placeholder="1d10, etc."
                      />
                    </div>
                  </div>
                </div>

                {/* Bonuses */}
                <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-yellow-600">✨</span>
                    Magical Bonuses
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Enhancement Bonus
                      </label>
                      <input
                        type="number"
                        value={formData.enhancementBonus}
                        onChange={(e) => setFormData(prev => ({ ...prev, enhancementBonus: parseInt(e.target.value) || 0 }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900"
                        min="0"
                        max="3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Extra Attack Bonus
                      </label>
                      <input
                        type="number"
                        value={formData.attackBonus || 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, attackBonus: parseInt(e.target.value) || 0 }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Extra Damage Bonus
                      </label>
                      <input
                        type="number"
                        value={formData.damageBonus || 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, damageBonus: parseInt(e.target.value) || 0 }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Range (for ranged weapons) */}
                <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-green-600">🎯</span>
                    Range (for ranged weapons)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Normal Range (ft)
                      </label>
                      <input
                        type="number"
                        value={formData.range?.normal || 5}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          range: { ...prev.range, normal: parseInt(e.target.value) || 5 }
                        }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900"
                        min="5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Long Range (ft)
                      </label>
                      <input
                        type="number"
                        value={formData.range?.long || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          range: { ...prev.range, long: parseInt(e.target.value) || undefined }
                        }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900"
                        min="5"
                      />
                    </div>
                  </div>
                </div>

                {/* Properties */}
                <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-purple-600">🔮</span>
                    Special Properties
                  </h4>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={propertyInput}
                      onChange={(e) => setPropertyInput(e.target.value)}
                      className="flex-1 p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                      placeholder="magical, silvered, returning, etc."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProperty())}
                    />
                    <button
                      type="button"
                      onClick={addProperty}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg font-semibold"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.properties.map((prop, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 rounded-full text-sm font-medium shadow-sm"
                      >
                        {prop}
                        <button
                          type="button"
                          onClick={() => removeProperty(index)}
                          className="text-blue-600 hover:text-blue-800 ml-1 font-bold text-lg leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-indigo-600">📜</span>
                    Description
                  </h4>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-500"
                    rows={3}
                    placeholder="Special abilities, lore, magical properties, etc."
                  />
                </div>

                {/* Equipped & Proficiency */}
                <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-green-600">⚔️</span>
                    Weapon Status
                  </h4>
                  <div className="space-y-3">
                    <label className="flex items-center text-sm font-semibold text-gray-800 hover:bg-blue-50 p-3 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.isEquipped}
                        onChange={(e) => setFormData(prev => ({ ...prev, isEquipped: e.target.checked }))}
                        className="mr-3 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="flex items-center gap-2">
                        <Shield size={18} className="text-green-600" />
                        Currently equipped
                      </span>
                    </label>

                    <div className="border-t border-gray-200 pt-3">
                      <div className="mb-2">
                        <span className="text-sm font-semibold text-gray-800">Proficiency Override</span>
                        <p className="text-xs text-gray-600">Override automatic proficiency calculation</p>
                      </div>
                      <div className="flex gap-3">
                        <label className="flex items-center text-sm text-gray-800 hover:bg-gray-50 p-2 rounded-lg transition-colors">
                          <input
                            type="radio"
                            name="proficiency"
                            checked={formData.manualProficiency === undefined}
                            onChange={() => setFormData(prev => ({ ...prev, manualProficiency: undefined }))}
                            className="mr-2 w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          Auto
                        </label>
                        <label className="flex items-center text-sm text-gray-800 hover:bg-green-50 p-2 rounded-lg transition-colors">
                          <input
                            type="radio"
                            name="proficiency"
                            checked={formData.manualProficiency === true}
                            onChange={() => setFormData(prev => ({ ...prev, manualProficiency: true }))}
                            className="mr-2 w-4 h-4 text-green-600 focus:ring-green-500"
                          />
                          Proficient
                        </label>
                        <label className="flex items-center text-sm text-gray-800 hover:bg-red-50 p-2 rounded-lg transition-colors">
                          <input
                            type="radio"
                            name="proficiency"
                            checked={formData.manualProficiency === false}
                            onChange={() => setFormData(prev => ({ ...prev, manualProficiency: false }))}
                            className="mr-2 w-4 h-4 text-red-600 focus:ring-red-500"
                          />
                          Not Proficient
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex gap-4 pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg font-semibold text-lg flex items-center justify-center gap-2"
                  >
                    <span className="text-xl">
                      {editingId ? '✏️' : '⚔️'}
                    </span>
                    {editingId ? 'Update Weapon' : 'Add Weapon'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-lg hover:from-gray-500 hover:to-gray-600 transition-all shadow-lg font-semibold text-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* Weapon Detail Modal */}
      <ModalPortal isOpen={!!viewingWeapon}>
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setViewingWeapon(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }}
        >
          {viewingWeapon && (
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-blue-200 transform animate-in zoom-in-95 fade-in-0 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <span className="text-blue-600 text-xl">⚔️</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">{viewingWeapon.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-800 capitalize">{viewingWeapon.category} weapon</span>
                      {viewingWeapon.enhancementBonus > 0 && (
                        <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded">
                          +{viewingWeapon.enhancementBonus}
                        </span>
                      )}
                      {viewingWeapon.isEquipped && (
                        <span className="text-xs px-2 py-1 bg-green-200 text-green-800 rounded flex items-center gap-1">
                          <Shield size={12} />
                          Equipped
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setViewingWeapon(null)}
                  className="text-gray-600 hover:text-gray-800 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Combat Stats */}
                <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-red-600">⚔️</span>
                    Combat Statistics
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-800">Attack Bonus</div>
                      <div className="text-lg font-bold text-red-600">
                        {getWeaponAttackString(character, viewingWeapon)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-800">Damage</div>
                      <div className="text-lg font-bold text-blue-600">
                        {getWeaponDamageString(character, viewingWeapon)}
                      </div>
                    </div>
                  </div>
                  {viewingWeapon.damage.versatiledice && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-sm text-gray-800">Versatile Damage</div>
                      <div className="text-lg font-bold text-purple-600">
                        {getWeaponDamageString(character, viewingWeapon, true)}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <span className={`text-sm px-2 py-1 rounded ${
                      isWeaponProficient(character, viewingWeapon)
                        ? 'bg-green-200 text-green-800'
                        : 'bg-red-200 text-red-800'
                    }`}>
                      {isWeaponProficient(character, viewingWeapon) ? 'Proficient' : 'Not Proficient'}
                      {viewingWeapon.manualProficiency !== undefined && ' (Manual Override)'}
                    </span>
                  </div>
                </div>

                {/* Properties */}
                <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-blue-600">🗡️</span>
                    Weapon Properties
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-800">Type: </span>
                      <span className="text-sm text-indigo-600 font-medium text-gray-800 capitalize">{viewingWeapon.weaponType.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-800">Damage Type: </span>
                      <span className="text-sm text-indigo-600 font-medium text-gray-800 capitalize">{viewingWeapon.damage.type}</span>
                    </div>
                    {viewingWeapon.range && (
                      <div>
                        <span className="text-sm text-gray-800">Range: </span>
                        <span className="text-sm text-indigo-600 font-medium text-gray-800">
                          {viewingWeapon.range.normal}ft
                          {viewingWeapon.range.long && ` / ${viewingWeapon.range.long}ft`}
                        </span>
                      </div>
                    )}
                    {viewingWeapon.properties.length > 0 && (
                      <div>
                        <span className="text-sm text-gray-800">Special Properties: </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {viewingWeapon.properties.map((prop, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                            >
                              {prop}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                {viewingWeapon.description && (
                  <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="text-indigo-600">📜</span>
                      Description
                    </h4>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">
                      {viewingWeapon.description}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => {
                    setViewingWeapon(null);
                    handleEdit(viewingWeapon);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Edit Weapon
                </button>
                <button
                  onClick={() => setViewingWeapon(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
      </ModalPortal>
    </div>
  );
}; 