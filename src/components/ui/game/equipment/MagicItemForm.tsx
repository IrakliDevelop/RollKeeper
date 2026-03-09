'use client';

import React from 'react';
import { MagicItemCategory, MagicItemRarity } from '@/types/character';
import { Plus, Trash2, Sparkles, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Checkbox } from '@/components/ui/forms/checkbox';
import RichTextEditor from '@/components/ui/forms/RichTextEditor';
import { Badge } from '@/components/ui/layout/badge';

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

import type { ChargePoolFormData } from '@/utils/magicItemConversion';

export interface MagicItemFormData {
  name: string;
  category: MagicItemCategory;
  rarity: MagicItemRarity;
  description: string;
  properties: string[];
  requiresAttunement: boolean;
  isAttuned: boolean;
  isEquipped?: boolean;
  charges?: MagicItemChargeFormData[];
  chargePool?: ChargePoolFormData;
  bonusSpellAttack?: number;
  bonusSpellSaveDc?: number;
}

interface MagicItemFormProps {
  formData: MagicItemFormData;
  setFormData: React.Dispatch<React.SetStateAction<MagicItemFormData>>;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
  autocompleteSlot?: React.ReactNode;
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
  autocompleteSlot,
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

  const updatePoolAbility = (
    index: number,
    updates: Partial<{ name: string; cost: number; description: string }>
  ) => {
    if (!formData.chargePool) return;
    setFormData(prev => ({
      ...prev,
      chargePool: prev.chargePool
        ? {
            ...prev.chargePool,
            abilities: prev.chargePool.abilities.map((a, i) =>
              i === index ? { ...a, ...updates } : a
            ),
          }
        : undefined,
    }));
  };

  const removePoolAbility = (index: number) => {
    if (!formData.chargePool) return;
    setFormData(prev => ({
      ...prev,
      chargePool: prev.chargePool
        ? {
            ...prev.chargePool,
            abilities: prev.chargePool.abilities.filter((_, i) => i !== index),
          }
        : undefined,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Autocomplete search (when not editing) */}
      {!isEditing && autocompleteSlot && (
        <div className="space-y-4">{autocompleteSlot}</div>
      )}

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

        <div>
          <label className="text-body mb-1 block text-sm font-medium">
            Item Properties
          </label>
          <RichTextEditor
            content={formData.description}
            onChange={(content: string) =>
              setFormData({
                ...formData,
                description: content,
              })
            }
            placeholder="Describe the item's properties and abilities..."
            minHeight="120px"
          />
        </div>
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

      {/* Section: Charge Pool (from item database) */}
      {formData.chargePool && (
        <div className="space-y-4">
          <div className="border-divider flex items-center justify-between border-b-2 pb-2">
            <h4 className="text-heading flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
              <Zap size={16} className="text-accent-amber-text" />
              Shared Charge Pool
            </h4>
          </div>

          <div className="border-accent-amber-border bg-accent-amber-bg rounded-lg border p-4">
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Input
                label="Max Charges"
                type="number"
                min={0}
                value={formData.chargePool.maxCharges.toString()}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    chargePool: prev.chargePool
                      ? {
                          ...prev.chargePool,
                          maxCharges: parseInt(e.target.value) || 0,
                        }
                      : undefined,
                  }))
                }
              />
              <div>
                <label className="text-body mb-2 block text-sm font-medium">
                  Recharges
                </label>
                <SelectField
                  value={formData.chargePool.rechargeType}
                  onValueChange={value =>
                    setFormData(prev => ({
                      ...prev,
                      chargePool: prev.chargePool
                        ? {
                            ...prev.chargePool,
                            rechargeType:
                              value as typeof prev.chargePool.rechargeType,
                          }
                        : undefined,
                    }))
                  }
                >
                  <SelectItem value="dawn">At Dawn</SelectItem>
                  <SelectItem value="dusk">At Dusk</SelectItem>
                  <SelectItem value="short">Short Rest</SelectItem>
                  <SelectItem value="long">Long Rest</SelectItem>
                  <SelectItem value="midnight">Midnight</SelectItem>
                  <SelectItem value="special">Special</SelectItem>
                </SelectField>
              </div>
              <Input
                label="Recharge Amount"
                value={formData.chargePool.rechargeAmount || ''}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    chargePool: prev.chargePool
                      ? {
                          ...prev.chargePool,
                          rechargeAmount: e.target.value || undefined,
                        }
                      : undefined,
                  }))
                }
                placeholder="e.g., 1d6+4"
              />
            </div>

            {formData.chargePool.abilities.length > 0 && (
              <div className="space-y-2">
                <p className="text-body text-xs font-semibold uppercase">
                  Abilities
                </p>
                {formData.chargePool.abilities.map((ability, idx) => (
                  <div
                    key={ability.id || idx}
                    className="bg-surface-raised flex items-center gap-3 rounded-lg px-3 py-2"
                  >
                    <Badge
                      variant={ability.cost === 0 ? 'success' : 'warning'}
                      size="sm"
                    >
                      {ability.cost === 0
                        ? ability.description === 'Ritual only'
                          ? 'Ritual'
                          : 'Free'
                        : `${ability.cost} charge${ability.cost !== 1 ? 's' : ''}`}
                    </Badge>
                    <Input
                      value={ability.name}
                      onChange={e =>
                        updatePoolAbility(idx, { name: e.target.value })
                      }
                      className="flex-1 text-sm"
                      wrapperClassName="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removePoolAbility(idx)}
                      className="text-muted hover:text-accent-red-text shrink-0 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section: Spell Bonuses */}
      {(formData.bonusSpellAttack !== undefined ||
        formData.bonusSpellSaveDc !== undefined ||
        formData.chargePool) && (
        <div className="space-y-4">
          <h4 className="border-divider text-heading flex items-center gap-2 border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
            <Shield size={16} className="text-accent-indigo-text" />
            Spell Bonuses
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Bonus to Spell Attack"
              type="number"
              min={0}
              max={5}
              value={(formData.bonusSpellAttack ?? '').toString()}
              onChange={e => {
                const val = e.target.value
                  ? parseInt(e.target.value)
                  : undefined;
                setFormData(prev => ({
                  ...prev,
                  bonusSpellAttack: val,
                }));
              }}
              placeholder="+0"
              helperText="Added to spell attack rolls"
            />
            <Input
              label="Bonus to Spell Save DC"
              type="number"
              min={0}
              max={5}
              value={(formData.bonusSpellSaveDc ?? '').toString()}
              onChange={e => {
                const val = e.target.value
                  ? parseInt(e.target.value)
                  : undefined;
                setFormData(prev => ({
                  ...prev,
                  bonusSpellSaveDc: val,
                }));
              }}
              placeholder="+0"
              helperText="Added to spell save DC"
            />
          </div>
        </div>
      )}

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
