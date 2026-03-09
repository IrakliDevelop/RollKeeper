'use client';

import React, { useState, useEffect } from 'react';
import type { ArmorItem, ArmorCategory, ArmorType } from '@/types/character';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/feedback/dialog-new';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Checkbox } from '@/components/ui/forms/checkbox';
import RichTextEditor from '@/components/ui/forms/RichTextEditor';
import { ArmorAutocomplete } from '@/components/ui/forms/ArmorAutocomplete';
import { useArmorDbData } from '@/hooks/useArmorDbData';
import { convertProcessedArmorToFormData } from '@/utils/armorConversion';
import type { ProcessedArmor } from '@/types/items';

export interface ArmorFormData {
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

interface ArmorFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingArmor: ArmorItem | null;
  onSubmit: (data: ArmorFormData, editingId: string | null) => void;
}

export function ArmorFormDialog({
  open,
  onClose,
  editingArmor,
  onSubmit,
}: ArmorFormDialogProps) {
  const [formData, setFormData] = useState<ArmorFormData>(initialFormData);
  const { items: armorDb, loading: armorDbLoading } = useArmorDbData();

  useEffect(() => {
    if (!open) return;
    if (editingArmor) {
      setFormData({
        name: editingArmor.name,
        category: editingArmor.category,
        type: editingArmor.type,
        baseAC: editingArmor.baseAC,
        maxDexBonus: editingArmor.maxDexBonus,
        stealthDisadvantage: editingArmor.stealthDisadvantage,
        strengthRequirement: editingArmor.strengthRequirement,
        enhancementBonus: editingArmor.enhancementBonus,
        isEquipped: editingArmor.isEquipped,
        requiresAttunement: editingArmor.requiresAttunement || false,
        isAttuned: editingArmor.isAttuned || false,
        description: editingArmor.description || '',
        weight: editingArmor.weight,
        value: editingArmor.value,
      });
    } else {
      setFormData(initialFormData);
    }
  }, [open, editingArmor]);

  const handleTypeChange = (type: ArmorType) => {
    const stats = ARMOR_STATS[type];
    if (!stats) return;
    setFormData(prev => ({
      ...prev,
      type,
      baseAC: stats.baseAC,
      maxDexBonus: stats.maxDex,
      stealthDisadvantage: stats.stealth || false,
      strengthRequirement: stats.strength,
    }));
  };

  const handleDbSelect = (item: ProcessedArmor) => {
    const autoFilled = convertProcessedArmorToFormData(item);
    setFormData(prev => ({ ...prev, ...autoFilled }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit(
      { ...formData, name: formData.name.trim() },
      editingArmor?.id ?? null
    );
    setFormData(initialFormData);
    onClose();
  };

  const handleCancel = () => {
    setFormData(initialFormData);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!o) handleCancel();
      }}
    >
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{editingArmor ? 'Edit Armor' : 'Add Armor'}</DialogTitle>
          <DialogDescription>
            {editingArmor
              ? 'Update armor details below.'
              : 'Search the database or fill in manually.'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            {!editingArmor && (
              <div className="space-y-4">
                <ArmorAutocomplete
                  items={armorDb}
                  onSelect={handleDbSelect}
                  loading={armorDbLoading}
                />
              </div>
            )}

            <div className="space-y-4">
              <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
                Basic Information
              </h4>
              <Input
                label="Name"
                value={formData.name}
                onChange={e =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Chain Mail, Leather Armor +1"
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-body mb-2 block text-sm font-medium">
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
                    {ARMOR_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectField>
                </div>
                <div>
                  <label className="text-body mb-2 block text-sm font-medium">
                    Type
                  </label>
                  <SelectField
                    value={formData.type}
                    onValueChange={value =>
                      handleTypeChange(value as ArmorType)
                    }
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

            <div className="space-y-4">
              <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
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
                  min={0}
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

            <div className="space-y-4">
              <h4 className="border-divider text-heading border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
                Description
              </h4>
              <div>
                <label className="text-body mb-2 block text-sm font-medium">
                  Special Properties
                </label>
                <RichTextEditor
                  content={formData.description}
                  onChange={content =>
                    setFormData(prev => ({ ...prev, description: content }))
                  }
                  placeholder="Special properties, abilities, or description..."
                />
              </div>
            </div>

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
                  <span className="text-body text-sm font-medium">
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
                  <span className="text-body text-sm font-medium">
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
                  <span className="text-body text-sm font-medium">
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
                    <span className="text-body text-sm font-medium">
                      Attuned
                    </span>
                  </label>
                )}
              </div>
            </div>

            <div className="border-divider flex justify-end gap-3 border-t-2 pt-4">
              <Button
                type="button"
                onClick={handleCancel}
                variant="outline"
                size="md"
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="md">
                {editingArmor ? 'Update' : 'Add'} Armor
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
