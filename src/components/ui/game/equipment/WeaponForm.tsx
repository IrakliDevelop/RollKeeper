'use client';

import React from 'react';
import {
  WeaponCategory,
  WeaponType,
  DamageType,
  WeaponDamage,
} from '@/types/character';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Textarea } from '@/components/ui/forms/textarea';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Checkbox } from '@/components/ui/forms/checkbox';
import RichTextEditor from '@/components/ui/forms/RichTextEditor';

// Form data version of WeaponCharge (without requiring id for new entries)
export interface WeaponChargeFormData {
  id?: string;
  name: string;
  description?: string;
  maxCharges: number;
  usedCharges: number;
  restType: 'short' | 'long';
  scaleWithProficiency?: boolean;
  proficiencyMultiplier?: number;
}

export interface WeaponFormData {
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
  // Multiple weapon charges
  charges?: WeaponChargeFormData[];
}

interface WeaponFormProps {
  formData: WeaponFormData;
  setFormData: React.Dispatch<React.SetStateAction<WeaponFormData>>;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
}

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

// Helper to create a new charge entry
const createNewCharge = (): WeaponChargeFormData => ({
  name: '',
  description: '',
  maxCharges: 1,
  usedCharges: 0,
  restType: 'long',
  scaleWithProficiency: false,
  proficiencyMultiplier: 1,
});

export function WeaponForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isEditing,
}: WeaponFormProps) {
  const toggleWeaponType = (type: WeaponType) => {
    setFormData(prev => ({
      ...prev,
      weaponType: prev.weaponType.includes(type)
        ? prev.weaponType.filter(t => t !== type)
        : [...prev.weaponType, type],
    }));
  };

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
    updates: Partial<WeaponChargeFormData>
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
        <h4 className="border-b-2 border-gray-200 pb-2 text-sm font-bold tracking-wide text-gray-800 uppercase">
          Basic Information
        </h4>

        <Input
          label="Name"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Longsword, +1 Dagger"
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
                  category: value as WeaponCategory,
                })
              }
            >
              {WEAPON_CATEGORIES.map(category => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </SelectItem>
              ))}
            </SelectField>
          </div>

          <Input
            label="Enhancement Bonus"
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

      {/* Section: Damage */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b-2 border-gray-200 pb-2">
          <h4 className="text-sm font-bold tracking-wide text-gray-800 uppercase">
            Damage Entries
          </h4>
          <Button
            type="button"
            onClick={() => {
              const newDamage: WeaponDamage = {
                dice: '1d6',
                type: 'fire',
                label: 'Additional Damage',
              };
              setFormData({
                ...formData,
                damage: [...formData.damage, newDamage],
              });
            }}
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
          >
            Add Damage Type
          </Button>
        </div>

        {formData.damage.map((damage, index) => (
          <div
            key={index}
            className="rounded-lg border-2 border-gray-200 bg-white p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h5 className="text-sm font-semibold text-gray-700">
                {damage.label || `Damage ${index + 1}`}
              </h5>
              {formData.damage.length > 1 && (
                <Button
                  type="button"
                  onClick={() => {
                    const newDamage = formData.damage.filter(
                      (_, i) => i !== index
                    );
                    setFormData({
                      ...formData,
                      damage: newDamage,
                    });
                  }}
                  variant="ghost"
                  size="xs"
                  className="text-red-600 hover:bg-red-50 hover:text-red-800"
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3">
              <Input
                label="Label"
                value={damage.label || ''}
                onChange={e => {
                  const newDamage = [...formData.damage];
                  newDamage[index] = {
                    ...damage,
                    label: e.target.value,
                  };
                  setFormData({
                    ...formData,
                    damage: newDamage,
                  });
                }}
                placeholder="e.g., Fire Damage"
                className="text-sm"
              />

              <Input
                label="Dice"
                value={damage.dice}
                onChange={e => {
                  const newDamage = [...formData.damage];
                  newDamage[index] = {
                    ...damage,
                    dice: e.target.value,
                  };
                  setFormData({
                    ...formData,
                    damage: newDamage,
                  });
                }}
                placeholder="1d8"
                className="text-sm"
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Type
                </label>
                <SelectField
                  value={damage.type}
                  onValueChange={value => {
                    const newDamage = [...formData.damage];
                    newDamage[index] = {
                      ...damage,
                      type: value as DamageType,
                    };
                    setFormData({
                      ...formData,
                      damage: newDamage,
                    });
                  }}
                >
                  {DAMAGE_TYPES.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectField>
              </div>

              <Input
                label="Versatile"
                value={damage.versatiledice || ''}
                onChange={e => {
                  const newDamage = [...formData.damage];
                  newDamage[index] = {
                    ...damage,
                    versatiledice: e.target.value || undefined,
                  };
                  setFormData({
                    ...formData,
                    damage: newDamage,
                  });
                }}
                placeholder="1d10"
                className="text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Section: Weapon Types */}
      <div className="space-y-4">
        <h4 className="border-b-2 border-gray-200 pb-2 text-sm font-bold tracking-wide text-gray-800 uppercase">
          Weapon Types
        </h4>

        <div className="grid grid-cols-3 gap-3">
          {WEAPON_TYPES.map(type => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2"
            >
              <Checkbox
                checked={formData.weaponType.includes(type)}
                onCheckedChange={() => toggleWeaponType(type)}
              />
              <span className="text-sm font-medium text-gray-800 capitalize">
                {type}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Section: Description */}
      <div className="space-y-4">
        <h4 className="border-b-2 border-gray-200 pb-2 text-sm font-bold tracking-wide text-gray-800 uppercase">
          Description
        </h4>

        <Textarea
          label="Special Properties"
          value={formData.description || ''}
          onChange={e =>
            setFormData({
              ...formData,
              description: e.target.value,
            })
          }
          rows={3}
          placeholder="Special properties, abilities, or description..."
        />
      </div>

      {/* Section: Charges */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b-2 border-gray-200 pb-2">
          <h4 className="flex items-center gap-2 text-sm font-bold tracking-wide text-gray-800 uppercase">
            <Sparkles size={16} className="text-indigo-600" />
            Charges & Abilities (Optional)
          </h4>
          <Button
            type="button"
            onClick={addCharge}
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            Add Charge Ability
          </Button>
        </div>

        {!formData.charges || formData.charges.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No charge abilities configured. Add charge abilities for magic
            weapons that can cast spells or activate special powers a limited
            number of times.
          </p>
        ) : (
          <div className="space-y-4">
            {formData.charges.map((charge, index) => (
              <div
                key={index}
                className="rounded-lg border-2 border-indigo-200 bg-indigo-50/50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h5 className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
                    <Sparkles size={14} />
                    {charge.name || `Charge Ability ${index + 1}`}
                  </h5>
                  <Button
                    type="button"
                    onClick={() => removeCharge(index)}
                    variant="ghost"
                    size="xs"
                    className="text-red-600 hover:bg-red-50 hover:text-red-800"
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
                    placeholder="e.g., Cast Fireball, Divine Smite"
                    className="text-sm"
                  />
                </div>

                {/* Description with WYSIWYG */}
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
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
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Recharges On
                    </label>
                    <SelectField
                      value={charge.restType}
                      onValueChange={value =>
                        updateCharge(index, {
                          restType: value as 'short' | 'long',
                        })
                      }
                    >
                      <SelectItem value="short">Short Rest</SelectItem>
                      <SelectItem value="long">Long Rest</SelectItem>
                    </SelectField>
                  </div>
                </div>

                {/* Proficiency Scaling */}
                <div className="border-t border-indigo-200 pt-3">
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
                    <span className="text-sm font-medium text-gray-800">
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
        <h4 className="border-b-2 border-gray-200 pb-2 text-sm font-bold tracking-wide text-gray-800 uppercase">
          Properties
        </h4>

        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={formData.isEquipped}
              onCheckedChange={checked =>
                setFormData({
                  ...formData,
                  isEquipped: checked as boolean,
                })
              }
            />
            <span className="text-sm font-medium text-gray-800">
              Currently Equipped
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={formData.requiresAttunement || false}
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
                checked={formData.isAttuned || false}
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
      <div className="flex justify-end gap-3 border-t-2 border-gray-200 pt-4">
        <Button type="button" onClick={onCancel} variant="outline" size="md">
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!formData.name.trim()}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
        >
          {isEditing ? 'Update' : 'Add'} Weapon
        </Button>
      </div>
    </form>
  );
}
