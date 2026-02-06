'use client';

import React, { useState } from 'react';
import { MagicItemRarity, MagicItemCategory } from '@/types/character';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/feedback/Modal';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Input } from '@/components/ui/forms/input';
import { Textarea } from '@/components/ui/forms/textarea';
import { SelectField, SelectItem } from '@/components/ui/forms/select';

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
}: ItemFormProps) {
  const [formData, setFormData] = useState<InventoryFormData>(initialData);
  const [tagInput, setTagInput] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [showCustomLocation, setShowCustomLocation] = useState(false);

  // Reset form when initialData changes
  React.useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      setTagInput('');
      setCustomLocation('');
      setShowCustomLocation(false);
    }
  }, [isOpen, initialData]);

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

    // If custom location is shown and has value, use it
    const finalData = {
      ...formData,
      location:
        showCustomLocation && customLocation.trim()
          ? customLocation.trim()
          : formData.location,
    };

    onSubmit(finalData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Item' : 'Add Item'}
      size="lg"
      closeOnBackdropClick={true}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section: Basic Information */}
        <div className="space-y-4">
          <h4 className="text-heading border-divider border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
            Basic Information
          </h4>

          <Input
            label="Name"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Rope (50 feet), Healing Potion"
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

            <Input
              label="Quantity"
              type="number"
              value={formData.quantity.toString()}
              onChange={e =>
                setFormData({
                  ...formData,
                  quantity: parseInt(e.target.value) || 1,
                })
              }
              min={1}
              required
            />
          </div>
        </div>

        {/* Section: Item Classification */}
        <div className="space-y-4">
          <h4 className="text-heading border-divider border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
            Item Classification
          </h4>

          <div className="grid grid-cols-2 gap-4">
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
                      value === 'none' ? undefined : (value as MagicItemRarity),
                  })
                }
              >
                <SelectItem value="none">None/Standard</SelectItem>
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
                <SelectItem value="none">Standard Item</SelectItem>
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
          <h4 className="text-heading border-divider border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
            Location
          </h4>

          <div className="space-y-3">
            <div>
              <label className="text-body mb-2 block text-sm font-medium">
                Where is this item stored?
              </label>
              <SelectField
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
                <SelectItem value="custom">Custom Location...</SelectItem>
              </SelectField>
            </div>

            {showCustomLocation && (
              <div className="flex items-center gap-2">
                <Input
                  value={customLocation}
                  onChange={e => setCustomLocation(e.target.value)}
                  placeholder="Enter custom location..."
                  className="flex-1"
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

        {/* Section: Item Details */}
        <div className="space-y-4">
          <h4 className="text-heading border-divider border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
            Item Details
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Weight (lbs)"
              type="number"
              step="0.1"
              value={formData.weight?.toString() || ''}
              onChange={e =>
                setFormData({
                  ...formData,
                  weight: e.target.value
                    ? parseFloat(e.target.value)
                    : undefined,
                })
              }
              placeholder="Per item"
              min={0}
            />

            <Input
              label="Value (cp)"
              type="number"
              value={formData.value?.toString() || ''}
              onChange={e =>
                setFormData({
                  ...formData,
                  value: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="Per item"
              min={0}
            />
          </div>

          <Textarea
            label="Description"
            value={formData.description}
            onChange={e =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={3}
            placeholder="Item description, properties, or notes..."
          />
        </div>

        {/* Section: Tags */}
        <div className="space-y-4">
          <h4 className="text-heading border-divider border-b-2 pb-2 text-sm font-bold tracking-wide uppercase">
            Tags
          </h4>

          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              placeholder="Add tag..."
              className="flex-1"
              onKeyPress={e =>
                e.key === 'Enter' && (e.preventDefault(), addTag())
              }
            />
            <Button
              type="button"
              onClick={addTag}
              variant="primary"
              size="md"
              className="from-accent-purple-bg-strong to-accent-violet-bg-strong hover:from-accent-purple-border-strong hover:to-accent-violet-border-strong bg-linear-to-r"
            >
              Add
            </Button>
          </div>

          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="primary"
                  size="md"
                  className="group"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(index)}
                    className="text-accent-purple-text-muted hover:text-accent-purple-text ml-1"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="border-divider flex justify-end gap-3 border-t-2 pt-4">
          <Button type="button" onClick={onClose} variant="outline" size="md">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!formData.name.trim()}
            className="from-accent-purple-bg-strong to-accent-violet-bg-strong hover:from-accent-purple-border-strong hover:to-accent-violet-border-strong bg-linear-to-r"
          >
            {isEditing ? 'Update' : 'Add'} Item
          </Button>
        </div>
      </form>
    </Modal>
  );
}
