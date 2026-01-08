'use client';

import React from 'react';
import { MagicItemCategory, MagicItemRarity } from '@/types/character';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Textarea } from '@/components/ui/forms/textarea';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Checkbox } from '@/components/ui/forms/checkbox';

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

interface MagicItemFormProps {
  formData: MagicItemFormData;
  setFormData: React.Dispatch<React.SetStateAction<MagicItemFormData>>;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
}

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

export function MagicItemForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isEditing,
}: MagicItemFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section: Basic Information */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-b-2 border-gray-200 pb-2">
          Basic Information
        </h4>

        <Input
          label="Name"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Ring of Protection"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Category
            </label>
            <SelectField
              value={formData.category}
              onValueChange={value =>
                setFormData({
                  ...formData,
                  category: value as MagicItemCategory,
                })
              }
            >
              {MAGIC_ITEM_CATEGORIES.map(category => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </SelectItem>
              ))}
            </SelectField>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Rarity
            </label>
            <SelectField
              value={formData.rarity}
              onValueChange={value =>
                setFormData({
                  ...formData,
                  rarity: value as MagicItemRarity,
                })
              }
            >
              {MAGIC_ITEM_RARITIES.map(rarity => (
                <SelectItem key={rarity} value={rarity}>
                  {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                </SelectItem>
              ))}
            </SelectField>
          </div>
        </div>
      </div>

      {/* Section: Description */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-b-2 border-gray-200 pb-2">
          Description
        </h4>

        <Textarea
          label="Item Properties"
          value={formData.description}
          onChange={e =>
            setFormData({
              ...formData,
              description: e.target.value,
            })
          }
          rows={3}
          placeholder="Describe the item's properties and abilities..."
        />
      </div>

      {/* Section: Properties */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-b-2 border-gray-200 pb-2">
          Properties
        </h4>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
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
            <label className="flex items-center gap-2 cursor-pointer">
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
                Currently Attuned
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t-2 border-gray-200">
        <Button type="button" onClick={onCancel} variant="outline" size="md">
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!formData.name.trim()}
          className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
        >
          {isEditing ? 'Update' : 'Add'} Item
        </Button>
      </div>
    </form>
  );
}

