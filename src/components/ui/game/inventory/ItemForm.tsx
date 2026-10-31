'use client';

import React, { useState } from 'react';
import { MagicItemRarity, MagicItemCategory } from '@/types/character';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { CompactRichTextEditor } from '@/components/ui/forms/CompactRichTextEditor';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { ProcessedItem, ProcessedMagicItem } from '@/types/items';
import { ItemAutocomplete } from '@/components/ui/forms/ItemAutocomplete';
import { convertProcessedItemToFormData } from '@/utils/itemConversion';

const ITEM_CATEGORIES = [
  'weapon',
  'armor',
  'tool',
  'consumable',
  'treasure',
  'misc',
];

const ITEM_RARITIES: MagicItemRarity[] = [
  'common',
  'uncommon',
  'rare',
  'very rare',
  'legendary',
  'artifact',
];

const ITEM_TYPES: MagicItemCategory[] = [
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

export interface InventoryFormData {
  name: string;
  category: string;
  location: string;
  rarity?: MagicItemRarity;
  type?: MagicItemCategory;
  quantity: number;
  weight?: number;
  value?: number;
  description: string;
  tags: string[];
}

interface ItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InventoryFormData) => void;
  initialData?: InventoryFormData;
  availableLocations: string[];
  isEditing: boolean;
  databaseItems?: ProcessedItem[];
  databaseMagicItems?: ProcessedMagicItem[];
  itemsLoading?: boolean;
}

export const initialInventoryFormData: InventoryFormData = {
  name: '',
  category: 'misc',
  location: 'Backpack',
  rarity: undefined,
  type: undefined,
  quantity: 1,
  weight: undefined,
  value: undefined,
  description: '',
  tags: [],
};

export function ItemForm({
  isOpen,
  onClose,
  onSubmit,
  initialData = initialInventoryFormData,
  availableLocations,
  isEditing,
  databaseItems = [],
  databaseMagicItems,
  itemsLoading = false,
}: ItemFormProps) {
  const [formData, setFormData] = useState<InventoryFormData>(initialData);
  const [tagInput, setTagInput] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [showCustomLocation, setShowCustomLocation] = useState(false);

  const initialDataSnapshot = JSON.stringify(initialData);

  React.useEffect(() => {
    if (!isOpen) return;
    setFormData(initialData);
    setTagInput('');
    setCustomLocation('');
    setShowCustomLocation(false);
  }, [isOpen, initialDataSnapshot]);

  const handleItemSelect = (item: ProcessedItem) => {
    setFormData(convertProcessedItemToFormData(item));
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalData = {
      ...formData,
      quantity: Math.max(1, formData.quantity),
      location:
        showCustomLocation && customLocation.trim()
          ? customLocation.trim()
          : formData.location,
    };

    onSubmit(finalData);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit item' : 'Add item'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Autocomplete Section */}
            {databaseItems.length > 0 && (
              <div className="border-divider min-w-0 border-t pt-4">
                <ItemAutocomplete
                  items={databaseItems}
                  magicItems={databaseMagicItems}
                  onSelect={handleItemSelect}
                  loading={itemsLoading}
                  placeholder="Search items"
                />
              </div>
            )}

            {/* Section: Basic information */}
            <div className="space-y-4">
              <h4 className="text-heading border-divider border-b pb-2 text-sm font-bold">
                Basic information
              </h4>

              <Input
                label="Name"
                value={formData.name}
                onChange={e =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Rope (50 feet)"
                required
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <div>
                  <label className="text-body mb-2 block text-sm font-medium">
                    Category
                  </label>
                  <SelectField
                    value={formData.category}
                    onValueChange={value =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    {ITEM_CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectField>
                </div>

                <NumberInput
                  label="Quantity"
                  value={formData.quantity}
                  onChange={v =>
                    setFormData({
                      ...formData,
                      quantity: v ?? 0,
                    })
                  }
                  min={1}
                  required
                />
              </div>
            </div>

            {/* Section: Classification */}
            <div className="space-y-4">
              <h4 className="text-heading border-divider border-b pb-2 text-sm font-bold">
                Classification
              </h4>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <div>
                  <label className="text-body mb-2 block text-sm font-medium">
                    Rarity
                  </label>
                  <SelectField
                    value={formData.rarity || 'none'}
                    onValueChange={value =>
                      setFormData({
                        ...formData,
                        rarity:
                          value === 'none'
                            ? undefined
                            : (value as MagicItemRarity),
                      })
                    }
                  >
                    <SelectItem value="none">None</SelectItem>
                    {ITEM_RARITIES.map(rarity => (
                      <SelectItem key={rarity} value={rarity}>
                        {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectField>
                </div>

                <div>
                  <label className="text-body mb-2 block text-sm font-medium">
                    Type
                  </label>
                  <SelectField
                    value={formData.type || 'none'}
                    onValueChange={value =>
                      setFormData({
                        ...formData,
                        type:
                          value === 'none'
                            ? undefined
                            : (value as MagicItemCategory),
                      })
                    }
                  >
                    <SelectItem value="none">Standard</SelectItem>
                    {ITEM_TYPES.map(type => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectField>
                </div>
              </div>
            </div>

            {/* Section: Location */}
            <div className="space-y-4">
              <h4 className="text-heading border-divider border-b pb-2 text-sm font-bold">
                Location
              </h4>

              <div className="space-y-3">
                <div>
                  <SelectField
                    triggerProps={{ 'aria-label': 'Location' }}
                    value={showCustomLocation ? 'custom' : formData.location}
                    onValueChange={value => {
                      if (value === 'custom') {
                        setShowCustomLocation(true);
                      } else {
                        setShowCustomLocation(false);
                        setFormData({ ...formData, location: value });
                      }
                    }}
                  >
                    {availableLocations.map(location => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom location…</SelectItem>
                  </SelectField>
                </div>

                {showCustomLocation && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={customLocation}
                      onChange={e => setCustomLocation(e.target.value)}
                      placeholder="Custom location"
                      wrapperClassName="min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        setShowCustomLocation(false);
                        setCustomLocation('');
                      }}
                      variant="outline"
                      size="md"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Section: Details */}
            <div className="space-y-4">
              <h4 className="text-heading border-divider border-b pb-2 text-sm font-bold">
                Details
              </h4>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <NumberInput
                  label="Weight (lb)"
                  integer={false}
                  allowEmpty
                  step="0.001"
                  value={formData.weight}
                  onChange={v =>
                    setFormData({
                      ...formData,
                      weight: v,
                    })
                  }
                  placeholder="Per item"
                  min={0}
                />

                <NumberInput
                  label="Value (cp)"
                  allowEmpty
                  value={formData.value}
                  onChange={v =>
                    setFormData({
                      ...formData,
                      value: v,
                    })
                  }
                  placeholder="Per item"
                  min={0}
                />
              </div>

              <div>
                <label className="text-body mb-2 block text-sm font-medium">
                  Description
                </label>
                <CompactRichTextEditor
                  content={formData.description}
                  onChange={value =>
                    setFormData({ ...formData, description: value })
                  }
                />
              </div>
            </div>

            {/* Section: Tags */}
            <div className="space-y-4">
              <h4 className="text-heading border-divider border-b pb-2 text-sm font-bold">
                Tags
              </h4>

              <div className="flex min-w-0 flex-wrap gap-2">
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  placeholder="Add a tag"
                  wrapperClassName="min-w-0 flex-[1_1_12rem]"
                  onKeyPress={e =>
                    e.key === 'Enter' && (e.preventDefault(), addTag())
                  }
                />
                <Button
                  type="button"
                  onClick={addTag}
                  variant="outline"
                  size="md"
                >
                  Add tag
                </Button>
              </div>

              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="neutral"
                      size="md"
                      className="group"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(index)}
                        aria-label={`Remove tag ${tag}`}
                        className="text-muted hover:bg-surface-hover hover:text-body ml-1 inline-flex min-h-6 min-w-6 items-center justify-center rounded-sm pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="bg-surface-raised border-divider sticky -bottom-6 -mb-6 flex justify-end gap-3 border-t-2 py-4">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                size="md"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!formData.name.trim()}
              >
                {isEditing ? 'Save item' : 'Add item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
