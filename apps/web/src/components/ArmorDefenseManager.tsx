'use client';

import React, { useState } from 'react';
import { ArmorItem, ArmorCategory, ArmorType } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus, Edit2, Trash2, Shield, CheckCircle } from 'lucide-react';
import { Modal } from '@/components/ui/feedback/Modal';
import DragDropList from '@/components/ui/layout/DragDropList';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Input } from '@/components/ui/forms/input';
import { Textarea } from '@/components/ui/forms/textarea';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Checkbox } from '@/components/ui/forms/checkbox';

const ARMOR_CATEGORIES: ArmorCategory[] = [
  'light',
  'medium',
  'heavy',
  'shield',
];
const ARMOR_TYPES: { [key in ArmorCategory]: ArmorType[] } = {
  light: ['padded', 'leather', 'studded-leather'],
  medium: ['hide', 'chain-shirt', 'scale-mail', 'breastplate', 'half-plate'],
  heavy: ['ring-mail', 'chain-mail', 'splint', 'plate'],
  shield: ['shield'],
};

const ARMOR_STATS: {
  [key in ArmorType]: {
    baseAC: number;
    maxDex?: number;
    stealth: boolean;
    strength?: number;
  };
} = {
  padded: { baseAC: 11, stealth: true },
  leather: { baseAC: 11, stealth: false },
  'studded-leather': { baseAC: 12, stealth: false },
  hide: { baseAC: 12, maxDex: 2, stealth: false },
  'chain-shirt': { baseAC: 13, maxDex: 2, stealth: false },
  'scale-mail': { baseAC: 14, maxDex: 2, stealth: true },
  breastplate: { baseAC: 14, maxDex: 2, stealth: false },
  'half-plate': { baseAC: 15, maxDex: 2, stealth: true },
  'ring-mail': { baseAC: 14, stealth: true },
  'chain-mail': { baseAC: 16, strength: 13, stealth: true },
  splint: { baseAC: 17, strength: 15, stealth: true },
  plate: { baseAC: 18, strength: 15, stealth: true },
  shield: { baseAC: 2, stealth: false },
  custom: { baseAC: 10, stealth: false },
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
    reorderArmorItems,
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
  const handleReorderEquippedArmor = (
    sourceIndex: number,
    destinationIndex: number
  ) => {
    const sourceArmorId = equippedArmor[sourceIndex].id;
    const destinationArmorId = equippedArmor[destinationIndex].id;

    const sourceGlobalIndex = character.armorItems.findIndex(
      item => item.id === sourceArmorId
    );
    const destinationGlobalIndex = character.armorItems.findIndex(
      item => item.id === destinationArmorId
    );

    if (sourceGlobalIndex !== -1 && destinationGlobalIndex !== -1) {
      reorderArmorItems(sourceGlobalIndex, destinationGlobalIndex);
    }
  };

  const handleReorderUnequippedArmor = (
    sourceIndex: number,
    destinationIndex: number
  ) => {
    const sourceArmorId = unequippedArmor[sourceIndex].id;
    const destinationArmorId = unequippedArmor[destinationIndex].id;

    const sourceGlobalIndex = character.armorItems.findIndex(
      item => item.id === sourceArmorId
    );
    const destinationGlobalIndex = character.armorItems.findIndex(
      item => item.id === destinationArmorId
    );

    if (sourceGlobalIndex !== -1 && destinationGlobalIndex !== -1) {
      reorderArmorItems(sourceGlobalIndex, destinationGlobalIndex);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Button */}
      <div className="flex items-center justify-end">
        <Button
          onClick={() => setShowForm(true)}
          variant="primary"
          size="sm"
          leftIcon={<Plus size={16} />}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
        >
          Add Armor
        </Button>
      </div>

      {/* Equipped Armor */}
      {equippedArmor.length > 0 && (
        <div>
          <h4 className="text-md mb-3 flex items-center gap-2 font-semibold text-blue-800">
            <CheckCircle size={16} className="text-green-600" />
            Equipped Armor
          </h4>
          <DragDropList
            items={equippedArmor}
            onReorder={handleReorderEquippedArmor}
            keyExtractor={armor => armor.id}
            className="space-y-3"
            showDragHandle={true}
            dragHandlePosition="left"
            renderItem={armor => (
              <ArmorCard
                armor={armor}
                onEdit={handleEdit}
                onDelete={() => deleteArmorItem(armor.id)}
                onToggleEquip={() =>
                  equipArmorItem(armor.id, !armor.isEquipped)
                }
                equipped={true}
              />
            )}
          />
        </div>
      )}

      {/* Unequipped Armor */}
      {unequippedArmor.length > 0 && (
        <div>
          <h4 className="text-md mb-3 font-semibold text-gray-700">
            Available Armor ({unequippedArmor.length})
          </h4>
          <DragDropList
            items={unequippedArmor}
            onReorder={handleReorderUnequippedArmor}
            keyExtractor={armor => armor.id}
            className="space-y-3"
            showDragHandle={true}
            dragHandlePosition="left"
            renderItem={armor => (
              <ArmorCard
                armor={armor}
                onEdit={handleEdit}
                onDelete={() => deleteArmorItem(armor.id)}
                onToggleEquip={() =>
                  equipArmorItem(armor.id, !armor.isEquipped)
                }
                equipped={false}
              />
            )}
          />
        </div>
      )}

      {/* Empty State */}
      {character.armorItems.length === 0 && (
        <div className="py-8 text-center text-gray-500">
          <Shield className="mx-auto mb-2 h-12 w-12 text-gray-300" />
          <p className="font-medium">No armor items added yet</p>
          <p className="mt-1 text-sm">
            Add armor pieces to manage your AC and defenses
          </p>
        </div>
      )}

      {/* Add/Edit Form */}
      <Modal
        isOpen={showForm}
        onClose={resetForm}
        title={editingId ? 'Edit Armor' : 'Add Armor'}
        size="lg"
        closeOnBackdropClick={true}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section: Basic Information */}
          <div className="space-y-4">
            <h4 className="border-b-2 border-gray-200 pb-2 text-sm font-bold tracking-wide text-gray-800 uppercase">
              Basic Information
            </h4>

            <Input
              label="Name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Chain Mail, Leather Armor +1"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Category
                </label>
                <SelectField
                  value={formData.category}
                  onValueChange={value => {
                    const category = value as ArmorCategory;
                    const firstType = ARMOR_TYPES[category][0];
                    setFormData({ ...formData, category });
                    handleTypeChange(firstType);
                  }}
                >
                  {ARMOR_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectField>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Type
                </label>
                <SelectField
                  value={formData.type}
                  onValueChange={value => handleTypeChange(value as ArmorType)}
                >
                  {ARMOR_TYPES[formData.category].map(type => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() +
                        type.slice(1).replace('-', ' ')}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectField>
              </div>
            </div>
          </div>

          {/* Section: Armor Stats */}
          <div className="space-y-4">
            <h4 className="border-b-2 border-gray-200 pb-2 text-sm font-bold tracking-wide text-gray-800 uppercase">
              Armor Stats
            </h4>

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Base AC"
                type="number"
                value={formData.baseAC.toString()}
                onChange={e =>
                  setFormData({
                    ...formData,
                    baseAC: parseInt(e.target.value) || 10,
                  })
                }
                min={10}
                max={30}
              />

              <Input
                label="Max Dex Bonus"
                type="number"
                value={formData.maxDexBonus?.toString() || ''}
                onChange={e =>
                  setFormData({
                    ...formData,
                    maxDexBonus: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
                placeholder="Unlimited"
                min={0}
                max={10}
              />

              <Input
                label="Enhancement"
                type="number"
                value={formData.enhancementBonus.toString()}
                onChange={e =>
                  setFormData({
                    ...formData,
                    enhancementBonus: parseInt(e.target.value) || 0,
                  })
                }
                min={0}
                max={3}
              />
            </div>
          </div>

          {/* Section: Description */}
          <div className="space-y-4">
            <h4 className="border-b-2 border-gray-200 pb-2 text-sm font-bold tracking-wide text-gray-800 uppercase">
              Description
            </h4>

            <Textarea
              label="Special Properties"
              value={formData.description}
              onChange={e =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              placeholder="Special properties, abilities, or description..."
            />
          </div>

          {/* Section: Properties */}
          <div className="space-y-4">
            <h4 className="border-b-2 border-gray-200 pb-2 text-sm font-bold tracking-wide text-gray-800 uppercase">
              Properties
            </h4>

            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={formData.isEquipped}
                  onCheckedChange={checked =>
                    setFormData({ ...formData, isEquipped: checked as boolean })
                  }
                />
                <span className="text-sm font-medium text-gray-800">
                  Currently Equipped
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={formData.stealthDisadvantage}
                  onCheckedChange={checked =>
                    setFormData({
                      ...formData,
                      stealthDisadvantage: checked as boolean,
                    })
                  }
                />
                <span className="text-sm font-medium text-gray-800">
                  Stealth Disadvantage
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={formData.requiresAttunement}
                  onCheckedChange={checked =>
                    setFormData({
                      ...formData,
                      requiresAttunement: checked as boolean,
                      isAttuned: checked ? formData.isAttuned : false,
                    })
                  }
                />
                <span className="text-sm font-medium text-gray-800">
                  Requires Attunement
                </span>
              </label>

              {formData.requiresAttunement && (
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={formData.isAttuned}
                    onCheckedChange={checked =>
                      setFormData({
                        ...formData,
                        isAttuned: checked as boolean,
                      })
                    }
                  />
                  <span className="text-sm font-medium text-gray-800">
                    Attuned
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 border-t-2 border-gray-200 pt-4">
            <Button
              type="button"
              onClick={resetForm}
              variant="outline"
              size="md"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            >
              {editingId ? 'Update' : 'Add'} Armor
            </Button>
          </div>
        </form>
      </Modal>
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

function ArmorCard({
  armor,
  onEdit,
  onDelete,
  onToggleEquip,
  equipped,
}: ArmorCardProps) {
  const totalAC = armor.baseAC + armor.enhancementBonus;

  return (
    <div
      className={`rounded-lg border-2 p-4 transition-all hover:shadow-md ${
        equipped
          ? 'bg-surface-raised border-green-300'
          : 'bg-surface-raised border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-gray-800">{armor.name}</h4>
            {armor.enhancementBonus > 0 && (
              <Badge variant="warning" size="sm">
                +{armor.enhancementBonus}
              </Badge>
            )}
            {armor.requiresAttunement && (
              <Badge
                variant={armor.isAttuned ? 'primary' : 'secondary'}
                size="sm"
              >
                {armor.isAttuned ? 'Attuned' : 'Requires Attunement'}
              </Badge>
            )}
          </div>

          <div className="mb-2 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">AC {totalAC}</span> •{' '}
            {armor.category} armor
            {armor.maxDexBonus !== undefined && (
              <span> • Max Dex +{armor.maxDexBonus}</span>
            )}
          </div>

          {armor.stealthDisadvantage && (
            <Badge variant="danger" size="sm" className="mb-2">
              ⚠️ Stealth Disadvantage
            </Badge>
          )}

          {armor.description && (
            <p className="mt-2 text-sm text-gray-700">{armor.description}</p>
          )}
        </div>

        <div className="ml-4 flex flex-col gap-2">
          <div className="flex gap-1">
            <Button
              onClick={() => onEdit(armor)}
              variant="ghost"
              size="xs"
              title="Edit armor"
              className="text-blue-600 hover:bg-blue-50 hover:text-blue-800"
            >
              <Edit2 size={16} />
            </Button>
            <Button
              onClick={onDelete}
              variant="ghost"
              size="xs"
              title="Delete armor"
              className="text-red-600 hover:bg-red-50 hover:text-red-800"
            >
              <Trash2 size={16} />
            </Button>
          </div>
          <Button
            onClick={onToggleEquip}
            variant={equipped ? 'success' : 'outline'}
            size="sm"
            className={
              equipped ? '' : 'hover:border-green-300 hover:bg-green-50'
            }
          >
            {equipped ? 'Equipped' : 'Equip'}
          </Button>
        </div>
      </div>
    </div>
  );
}
