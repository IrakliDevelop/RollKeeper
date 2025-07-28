'use client';

import React, { useState } from 'react';
import { ArmorItem, ArmorCategory, ArmorType } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus, Edit2, Trash2, Shield, CheckCircle } from 'lucide-react';
import DragDropList from '@/components/ui/DragDropList';

const ARMOR_CATEGORIES: ArmorCategory[] = ['light', 'medium', 'heavy', 'shield'];
const ARMOR_TYPES: { [key in ArmorCategory]: ArmorType[] } = {
  light: ['padded', 'leather', 'studded-leather'],
  medium: ['hide', 'chain-shirt', 'scale-mail', 'breastplate', 'half-plate'],
  heavy: ['ring-mail', 'chain-mail', 'splint', 'plate'],
  shield: ['shield']
};

const ARMOR_STATS: { [key in ArmorType]: { baseAC: number; maxDex?: number; stealth: boolean; strength?: number } } = {
  'padded': { baseAC: 11, stealth: true },
  'leather': { baseAC: 11, stealth: false },
  'studded-leather': { baseAC: 12, stealth: false },
  'hide': { baseAC: 12, maxDex: 2, stealth: false },
  'chain-shirt': { baseAC: 13, maxDex: 2, stealth: false },
  'scale-mail': { baseAC: 14, maxDex: 2, stealth: true },
  'breastplate': { baseAC: 14, maxDex: 2, stealth: false },
  'half-plate': { baseAC: 15, maxDex: 2, stealth: true },
  'ring-mail': { baseAC: 14, stealth: true },
  'chain-mail': { baseAC: 16, strength: 13, stealth: true },
  'splint': { baseAC: 17, strength: 15, stealth: true },
  'plate': { baseAC: 18, strength: 15, stealth: true },
  'shield': { baseAC: 2, stealth: false },
  'custom': { baseAC: 10, stealth: false }
};

interface ArmorFormData {
  name: string;
  category: ArmorCategory;
  type: ArmorType;
  baseAC: number;
  maxDexBonus?: number;
  stealthDisadvantage: boolean;
  strengthRequirement?: number;
  enhancementBonus: number;
  isEquipped: boolean;
  requiresAttunement: boolean;
  isAttuned: boolean;
  description: string;
  weight?: number;
  value?: number;
}

const initialFormData: ArmorFormData = {
  name: '',
  category: 'light',
  type: 'leather',
  baseAC: 11,
  maxDexBonus: undefined,
  stealthDisadvantage: false,
  strengthRequirement: undefined,
  enhancementBonus: 0,
  isEquipped: false,
  requiresAttunement: false,
  isAttuned: false,
  description: '',
  weight: undefined,
  value: undefined,
};

export default function ArmorDefenseManager() {
  const { 
    character, 
    addArmorItem, 
    updateArmorItem, 
    deleteArmorItem, 
    equipArmorItem,
    reorderArmorItems
  } = useCharacterStore();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ArmorFormData>(initialFormData);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) return;

    const armorData = {
      ...formData,
      name: formData.name.trim(),
    };

    if (editingId) {
      updateArmorItem(editingId, armorData);
      setEditingId(null);
    } else {
      addArmorItem(armorData);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (armor: ArmorItem) => {
    setFormData({
      name: armor.name,
      category: armor.category,
      type: armor.type,
      baseAC: armor.baseAC,
      maxDexBonus: armor.maxDexBonus,
      stealthDisadvantage: armor.stealthDisadvantage,
      strengthRequirement: armor.strengthRequirement,
      enhancementBonus: armor.enhancementBonus,
      isEquipped: armor.isEquipped,
      requiresAttunement: armor.requiresAttunement || false,
      isAttuned: armor.isAttuned || false,
      description: armor.description || '',
      weight: armor.weight,
      value: armor.value,
    });
    setEditingId(armor.id);
    setShowForm(true);
  };

  const handleTypeChange = (type: ArmorType) => {
    const stats = ARMOR_STATS[type];
    setFormData(prev => ({
      ...prev,
      type,
      baseAC: stats.baseAC,
      maxDexBonus: stats.maxDex,
      stealthDisadvantage: stats.stealth || false,
      strengthRequirement: stats.strength,
    }));
  };

  const equippedArmor = character.armorItems.filter(item => item.isEquipped);
  const unequippedArmor = character.armorItems.filter(item => !item.isEquipped);

  // Custom reorder handlers for equipped and unequipped armor
  const handleReorderEquippedArmor = (sourceIndex: number, destinationIndex: number) => {
    const sourceArmorId = equippedArmor[sourceIndex].id;
    const destinationArmorId = equippedArmor[destinationIndex].id;
    
    const sourceGlobalIndex = character.armorItems.findIndex(item => item.id === sourceArmorId);
    const destinationGlobalIndex = character.armorItems.findIndex(item => item.id === destinationArmorId);
    
    if (sourceGlobalIndex !== -1 && destinationGlobalIndex !== -1) {
      reorderArmorItems(sourceGlobalIndex, destinationGlobalIndex);
    }
  };

  const handleReorderUnequippedArmor = (sourceIndex: number, destinationIndex: number) => {
    const sourceArmorId = unequippedArmor[sourceIndex].id;
    const destinationArmorId = unequippedArmor[destinationIndex].id;
    
    const sourceGlobalIndex = character.armorItems.findIndex(item => item.id === sourceArmorId);
    const destinationGlobalIndex = character.armorItems.findIndex(item => item.id === destinationArmorId);
    
    if (sourceGlobalIndex !== -1 && destinationGlobalIndex !== -1) {
      reorderArmorItems(sourceGlobalIndex, destinationGlobalIndex);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
          <span className="text-blue-600">🛡️</span>
          Armor & Defense ({character.armorItems.length})
        </h3>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Add Armor
        </button>
      </div>

      {/* Equipped Armor */}
      {equippedArmor.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            Equipped Armor
          </h4>
          <DragDropList
            items={equippedArmor}
            onReorder={handleReorderEquippedArmor}
            keyExtractor={(armor) => armor.id}
            className="space-y-3"
            showDragHandle={true}
            dragHandlePosition="left"
            renderItem={(armor, index, isDragging) => (
              <ArmorCard 
                armor={armor}
                onEdit={handleEdit}
                onDelete={() => deleteArmorItem(armor.id)}
                onToggleEquip={() => equipArmorItem(armor.id, !armor.isEquipped)}
                equipped={true}
              />
            )}
          />
        </div>
      )}

      {/* Unequipped Armor */}
      {unequippedArmor.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-700 mb-3">
            Available Armor ({unequippedArmor.length})
          </h4>
          <DragDropList
            items={unequippedArmor}
            onReorder={handleReorderUnequippedArmor}
            keyExtractor={(armor) => armor.id}
            className="space-y-3"
            showDragHandle={true}
            dragHandlePosition="left"
            renderItem={(armor, index, isDragging) => (
              <ArmorCard 
                armor={armor}
                onEdit={handleEdit}
                onDelete={() => deleteArmorItem(armor.id)}
                onToggleEquip={() => equipArmorItem(armor.id, !armor.isEquipped)}
                equipped={false}
              />
            )}
          />
        </div>
      )}

      {/* Empty State */}
      {character.armorItems.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Shield className="mx-auto h-12 w-12 text-gray-300 mb-2" />
          <p className="font-medium">No armor items added yet</p>
          <p className="text-sm mt-1">Add armor pieces to manage your AC and defenses</p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {editingId ? 'Edit Armor' : 'Add Armor'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    placeholder="e.g., Chain Mail, Leather Armor +1"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        const category = e.target.value as ArmorCategory;
                        const firstType = ARMOR_TYPES[category][0];
                        setFormData({ ...formData, category });
                        handleTypeChange(firstType);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    >
                      {ARMOR_CATEGORIES.map(category => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleTypeChange(e.target.value as ArmorType)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    >
                      {ARMOR_TYPES[formData.category].map(type => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                        </option>
                      ))}
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Base AC</label>
                    <input
                      type="number"
                      value={formData.baseAC}
                      onChange={(e) => setFormData({ ...formData, baseAC: parseInt(e.target.value) || 10 })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                      min="10"
                      max="30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Dex Bonus</label>
                    <input
                      type="number"
                      value={formData.maxDexBonus || ''}
                      onChange={(e) => setFormData({ ...formData, maxDexBonus: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                      placeholder="Unlimited"
                      min="0"
                      max="10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enhancement</label>
                    <input
                      type="number"
                      value={formData.enhancementBonus}
                      onChange={(e) => setFormData({ ...formData, enhancementBonus: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                      min="0"
                      max="3"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    rows={3}
                    placeholder="Special properties, abilities, or description..."
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isEquipped}
                      onChange={(e) => setFormData({ ...formData, isEquipped: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-800">Currently Equipped</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.stealthDisadvantage}
                      onChange={(e) => setFormData({ ...formData, stealthDisadvantage: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-800">Stealth Disadvantage</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.requiresAttunement}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        requiresAttunement: e.target.checked,
                        isAttuned: e.target.checked ? formData.isAttuned : false
                      })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-800">Requires Attunement</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingId ? 'Update' : 'Add'} Armor
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ArmorCardProps {
  armor: ArmorItem;
  onEdit: (armor: ArmorItem) => void;
  onDelete: () => void;
  onToggleEquip: () => void;
  equipped: boolean;
}

function ArmorCard({ armor, onEdit, onDelete, onToggleEquip, equipped }: ArmorCardProps) {
  const totalAC = armor.baseAC + armor.enhancementBonus;
  
  return (
    <div className={`p-4 border rounded-lg transition-all ${
      equipped 
        ? 'border-green-300 bg-green-50' 
        : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-800">{armor.name}</h4>
            {armor.enhancementBonus > 0 && (
              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                +{armor.enhancementBonus}
              </span>
            )}
            {armor.requiresAttunement && (
              <span className={`text-xs px-2 py-1 rounded ${
                armor.isAttuned ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
              }`}>
                {armor.isAttuned ? 'Attuned' : 'Requires Attunement'}
              </span>
            )}
          </div>
          
          <div className="text-sm text-gray-600 mb-2">
            <span className="font-medium">AC {totalAC}</span> • {armor.category} armor
            {armor.maxDexBonus !== undefined && (
              <span> • Max Dex +{armor.maxDexBonus}</span>
            )}
          </div>
          
          {armor.stealthDisadvantage && (
            <div className="text-xs text-red-600 mb-1">
              ⚠️ Stealth Disadvantage
            </div>
          )}
          
          {armor.description && (
            <p className="text-sm text-gray-700">{armor.description}</p>
          )}
        </div>
        
        <div className="flex flex-col gap-2 ml-4">
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(armor)}
              className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
              title="Edit armor"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={onDelete}
              className="p-1 text-gray-600 hover:text-red-600 transition-colors"
              title="Delete armor"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <button
            onClick={onToggleEquip}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              equipped
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-green-100'
            }`}
          >
            {equipped ? 'Equipped' : 'Equip'}
          </button>
        </div>
      </div>
    </div>
  );
} 