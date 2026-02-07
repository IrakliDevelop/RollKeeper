'use client';

import React from 'react';
import { MagicItemCategory, MagicItemRarity } from '@/types/character';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Textarea } from '@/components/ui/forms/textarea';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Checkbox } from '@/components/ui/forms/checkbox';
import RichTextEditor from '@/components/ui/forms/RichTextEditor';

// Form data version of MagicItemCharge (without requiring id for new entries)
export interface MagicItemChargeFormData {
  id?: string;
  name: string;
  description?: string;
  maxCharges: number;
  usedCharges: number;
  restType: 'short' | 'long' | 'dawn';
  scaleWithProficiency?: boolean;
  proficiencyMultiplier?: number;
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
  // Multiple charges
  charges?: MagicItemChargeFormData[];
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

// Helper to create a new charge entry
const createNewCharge = (): MagicItemChargeFormData => ({
  name: '',
  description: '',
  maxCharges: 1,
  usedCharges: 0,
  restType: 'dawn',
  scaleWithProficiency: false,
  proficiencyMultiplier: 1,
});

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

  const addCharge = () => {
    setFormData(prev => ({
      ...prev,
      charges: [...(prev.charges || []), createNewCharge()],
    }));
  };

  const removeCharge = (index: number) => {
    setFormData(prev => ({
      ...prev,
      charges: (prev.charges || []).filter((_, i) => i !== index),
    }));
  };

  const updateCharge = (
    index: number,
    updates: Partial<MagicItemChargeFormData>
  ) => {
    setFormData(prev => ({
      ...prev,
      charges: (prev.charges || []).map((charge, i) =>
        i === index ? { ...charge, ...updates } : charge
      ),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section: Basic Information */}
      <div className="space-y-4">
        <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
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
            <label className="text-body mb-2 block text-sm font-medium">
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
            <label className="text-body mb-2 block text-sm font-medium">
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
        <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
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

      {/* Section: Charges */}
      <div className="space-y-4">
        <div className="border-divider flex items-center justify-between border-b-2 pb-2">
          <h4 className="text-heading flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
            <Sparkles size={16} className="text-accent-purple-text-muted" />
            Charges & Abilities (Optional)
          </h4>
          <Button
            type="button"
            onClick={addCharge}
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            className="bg-linear-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
          >
            Add Charge Ability
          </Button>
        </div>

        {!formData.charges || formData.charges.length === 0 ? (
          <p className="text-muted text-sm italic">
            No charge abilities configured. Add charge abilities for magic items
            that can cast spells or activate special powers a limited number of
            times.
          </p>
        ) : (
          <div className="space-y-4">
            {formData.charges.map((charge, index) => (
              <div
                key={index}
                className="border-accent-purple-border bg-accent-purple-bg rounded-lg border-2 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h5 className="text-accent-purple-text-muted flex items-center gap-2 text-sm font-semibold">
                    <Sparkles size={14} />
                    {charge.name || `Charge Ability ${index + 1}`}
                  </h5>
                  <Button
                    type="button"
                    onClick={() => removeCharge(index)}
                    variant="ghost"
                    size="xs"
                    className="text-accent-red-text-muted hover:bg-accent-red-bg hover:text-accent-red-text"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>

                {/* Ability Name */}
                <div className="mb-3">
                  <Input
                    label="Ability Name"
                    value={charge.name}
                    onChange={e =>
                      updateCharge(index, { name: e.target.value })
                    }
                    placeholder="e.g., Cast Fireball, Teleport"
                    className="text-sm"
                  />
                </div>

                {/* Description with WYSIWYG */}
                <div className="mb-3">
                  <label className="text-body mb-1 block text-sm font-medium">
                    Description (Optional)
                  </label>
                  <RichTextEditor
                    content={charge.description || ''}
                    onChange={(content: string) =>
                      updateCharge(index, { description: content })
                    }
                    placeholder="Describe what this ability does, spell level, effects, etc."
                    minHeight="80px"
                  />
                </div>

                {/* Max Charges and Rest Type */}
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <Input
                    label="Max Charges"
                    type="number"
                    min={1}
                    value={charge.maxCharges.toString()}
                    onChange={e =>
                      updateCharge(index, {
                        maxCharges: parseInt(e.target.value) || 1,
                      })
                    }
                    helperText="Total charges when fully recharged"
                  />
                  <div>
                    <label className="text-body mb-2 block text-sm font-medium">
                      Recharges On
                    </label>
                    <SelectField
                      value={charge.restType}
                      onValueChange={value =>
                        updateCharge(index, {
                          restType: value as 'short' | 'long' | 'dawn',
                        })
                      }
                    >
                      <SelectItem value="dawn">At Dawn</SelectItem>
                      <SelectItem value="short">Short Rest</SelectItem>
                      <SelectItem value="long">Long Rest</SelectItem>
                    </SelectField>
                  </div>
                </div>

                {/* Proficiency Scaling */}
                <div className="border-accent-purple-border border-t pt-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={charge.scaleWithProficiency || false}
                      onCheckedChange={checked =>
                        updateCharge(index, {
                          scaleWithProficiency: checked as boolean,
                          proficiencyMultiplier: checked
                            ? charge.proficiencyMultiplier || 1
                            : undefined,
                        })
                      }
                    />
                    <span className="text-heading text-sm font-medium">
                      Scale with proficiency bonus
                    </span>
                  </label>

                  {charge.scaleWithProficiency && (
                    <div className="mt-2 pl-6">
                      <Input
                        label="Proficiency Multiplier"
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={(charge.proficiencyMultiplier || 1).toString()}
                        onChange={e =>
                          updateCharge(index, {
                            proficiencyMultiplier:
                              parseFloat(e.target.value) || 1,
                          })
                        }
                        helperText="Max charges = proficiency bonus × multiplier"
                        wrapperClassName="w-48"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: Properties */}
      <div className="space-y-4">
        <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
          Properties
        </h4>

        <div className="flex flex-wrap gap-4">
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
            <span className="text-heading text-sm font-medium">
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
              <span className="text-heading text-sm font-medium">
                Currently Attuned
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="border-divider flex justify-end gap-3 border-t-2 pt-4">
        <Button type="button" onClick={onCancel} variant="outline" size="md">
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!formData.name.trim()}
          className="bg-linear-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
        >
          {isEditing ? 'Update' : 'Add'} Item
        </Button>
      </div>
    </form>
  );
}
