'use client';

import React from 'react';
import {
  WeaponCategory,
  WeaponType,
  DamageType,
  WeaponDamage,
  AbilityName,
} from '@/types/character';
import { Plus, Trash2, Sparkles, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Checkbox } from '@/components/ui/forms/checkbox';
import RichTextEditor from '@/components/ui/forms/RichTextEditor';
import { Badge } from '@/components/ui/layout/badge';
import type { ChargePoolFormData } from '@/utils/magicItemConversion';

// Form data version of WeaponCharge (without requiring id for new entries)
export interface WeaponChargeFormData {
  id?: string;
  name: string;
  description?: string;
  maxCharges: number;
  usedCharges: number;
  restType: 'short' | 'long' | 'dawn';
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
  abilityOverride?: AbilityName;
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
  charges?: WeaponChargeFormData[];
  chargePool?: ChargePoolFormData;
  bonusSpellAttack?: number;
  bonusSpellSaveDc?: number;
  weight?: number;
  value?: number;
}

interface WeaponFormProps {
  formData: WeaponFormData;
  setFormData: React.Dispatch<React.SetStateAction<WeaponFormData>>;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
  autocompleteSlot?: React.ReactNode;
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
  autocompleteSlot,
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
          placeholder="e.g., Longsword, +1 Dagger"
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
          <Input
            label="Weight (lb)"
            type="number"
            value={(formData.weight ?? '').toString()}
            onChange={e =>
              setFormData({
                ...formData,
                weight: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            min={0}
            step={0.1}
          />
          <Input
            label="Value (cp)"
            type="number"
            value={(formData.value ?? '').toString()}
            onChange={e =>
              setFormData({
                ...formData,
                value: e.target.value ? parseInt(e.target.value) : undefined,
              })
            }
            min={0}
          />
        </div>
      </div>

      {/* Section: Damage */}
      <div className="space-y-4">
        <div className="border-divider flex items-center justify-between border-b-2 pb-2">
          <h4 className="text-heading text-sm font-bold tracking-wide uppercase">
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
            className="bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
          >
            Add Damage Type
          </Button>
        </div>

        {formData.damage.map((damage, index) => (
          <div
            key={index}
            className="border-divider bg-surface-raised rounded-lg border-2 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h5 className="text-body text-sm font-semibold">
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
                  className="text-accent-red-text-muted hover:bg-accent-red-bg hover:text-accent-red-text"
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
                <label className="text-body mb-2 block text-sm font-medium">
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
        <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
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
              <span className="text-heading text-sm font-medium capitalize">
                {type}
              </span>
            </label>
          ))}
        </div>

        {/* Ability Override */}
        <div>
          <label className="text-body mb-2 block text-sm font-medium">
            Ability Score Override
          </label>
          <SelectField
            value={formData.abilityOverride || 'default'}
            onValueChange={value =>
              setFormData({
                ...formData,
                abilityOverride:
                  value === 'default' ? undefined : (value as AbilityName),
              })
            }
          >
            <SelectItem value="default">
              Default (STR / DEX / Finesse)
            </SelectItem>
            <SelectItem value="strength">Strength</SelectItem>
            <SelectItem value="dexterity">Dexterity</SelectItem>
            <SelectItem value="constitution">Constitution</SelectItem>
            <SelectItem value="intelligence">Intelligence</SelectItem>
            <SelectItem value="wisdom">Wisdom</SelectItem>
            <SelectItem value="charisma">Charisma</SelectItem>
          </SelectField>
          <p className="text-muted mt-1 text-xs">
            Override for features like Pact of the Blade (CHA) or Bladesinging
            (INT)
          </p>
        </div>
      </div>

      {/* Section: Description */}
      <div className="space-y-4">
        <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
          Description
        </h4>

        <div>
          <label className="text-body mb-2 block text-sm font-medium">
            Special Properties
          </label>
          <RichTextEditor
            content={formData.description || ''}
            onChange={content =>
              setFormData(prev => ({ ...prev, description: content }))
            }
            placeholder="Special properties, abilities, or description..."
          />
        </div>
      </div>

      {/* Section: Charges */}
      <div className="space-y-4">
        <div className="border-divider flex items-center justify-between border-b-2 pb-2">
          <h4 className="text-heading flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
            <Sparkles size={16} className="text-accent-indigo-text-muted" />
            Charges & Abilities (Optional)
          </h4>
          <Button
            type="button"
            onClick={addCharge}
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            className="bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            Add Charge Ability
          </Button>
        </div>

        {!formData.charges || formData.charges.length === 0 ? (
          <p className="text-muted text-sm italic">
            No charge abilities configured. Add charge abilities for magic
            weapons that can cast spells or activate special powers a limited
            number of times.
          </p>
        ) : (
          <div className="space-y-4">
            {formData.charges.map((charge, index) => (
              <div
                key={index}
                className="border-accent-indigo-border bg-accent-indigo-bg rounded-lg border-2 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h5 className="text-accent-indigo-text-muted flex items-center gap-2 text-sm font-semibold">
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
                    placeholder="e.g., Cast Fireball, Divine Smite"
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
                <div className="border-accent-indigo-border border-t pt-3">
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

      {/* Section: Charge Pool (from weapon database) */}
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
                        setFormData(prev => ({
                          ...prev,
                          chargePool: prev.chargePool
                            ? {
                                ...prev.chargePool,
                                abilities: prev.chargePool.abilities.map(
                                  (a, i) =>
                                    i === idx
                                      ? { ...a, name: e.target.value }
                                      : a
                                ),
                              }
                            : undefined,
                        }))
                      }
                      className="flex-1 text-sm"
                      wrapperClassName="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormData(prev => ({
                          ...prev,
                          chargePool: prev.chargePool
                            ? {
                                ...prev.chargePool,
                                abilities: prev.chargePool.abilities.filter(
                                  (_, i) => i !== idx
                                ),
                              }
                            : undefined,
                        }))
                      }
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
                setFormData(prev => ({ ...prev, bonusSpellAttack: val }));
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
                setFormData(prev => ({ ...prev, bonusSpellSaveDc: val }));
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
              checked={formData.isEquipped}
              onCheckedChange={checked =>
                setFormData({
                  ...formData,
                  isEquipped: checked as boolean,
                })
              }
            />
            <span className="text-heading text-sm font-medium">
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
            <span className="text-heading text-sm font-medium">
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
          className="bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
        >
          {isEditing ? 'Update' : 'Add'} Weapon
        </Button>
      </div>
    </form>
  );
}
