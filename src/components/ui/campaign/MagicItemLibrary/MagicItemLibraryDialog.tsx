'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Input } from '@/components/ui/forms/input';
import {
  MagicItemForm,
  type MagicItemFormData,
} from '@/components/ui/game/equipment/MagicItemForm';
import { useItemsData } from '@/hooks/useItemsData';
import { useMagicItemsData } from '@/hooks/useMagicItemsData';
import { convertProcessedMagicItemToFormData } from '@/utils/magicItemConversion';
import type { MagicItem } from '@/types/character';
import type { CustomMagicItem } from '@/types/magicItemLibrary';
import {
  AllItemsAutocomplete,
  type CompendiumItem,
} from './AllItemsAutocomplete';

const EMPTY_FORM: MagicItemFormData = {
  name: '',
  category: 'wondrous',
  rarity: 'common',
  description: '',
  properties: [],
  requiresAttunement: false,
  isAttuned: false,
  isEquipped: false,
  charges: [],
};

function makeIds(
  form: MagicItemFormData
): Omit<MagicItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    ...form,
    charges: form.charges
      ?.filter(charge => charge.name.trim())
      .map(charge => ({
        ...charge,
        id: charge.id ?? `charge-${crypto.randomUUID()}`,
      })),
    chargePool: form.chargePool
      ? {
          ...form.chargePool,
          abilities: form.chargePool.abilities.map(ability => ({
            ...ability,
            id: ability.id ?? `ability-${crypto.randomUUID()}`,
          })),
        }
      : undefined,
  };
}

export function MagicItemLibraryDialog({
  open,
  onOpenChange,
  item,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CustomMagicItem | null;
  onSave: (
    data: Omit<
      CustomMagicItem,
      'id' | 'campaignCode' | 'createdAt' | 'updatedAt'
    >
  ) => void;
}) {
  const [form, setForm] = useState<MagicItemFormData>(EMPTY_FORM);
  const [tagsText, setTagsText] = useState('');
  const [group, setGroup] = useState('');
  const [sourceItemId, setSourceItemId] = useState<string | undefined>();
  const mundane = useItemsData();
  const magic = useMagicItemsData();

  useEffect(() => {
    if (!open) return;
    setForm(
      item
        ? {
            name: item.name,
            category: item.category,
            rarity: item.rarity,
            description: item.description,
            properties: item.properties,
            requiresAttunement: item.requiresAttunement,
            isAttuned: false,
            isEquipped: false,
            charges: item.charges,
            chargePool: item.chargePool,
            bonusSpellAttack: item.bonusSpellAttack,
            bonusSpellSaveDc: item.bonusSpellSaveDc,
          }
        : EMPTY_FORM
    );
    setTagsText(item?.tags.join(', ') ?? '');
    setGroup(item?.group ?? '');
    setSourceItemId(item?.sourceItemId);
  }, [item, open]);

  const handleCompendiumSelect = (selection: CompendiumItem) => {
    setSourceItemId(selection.item.id);
    if (selection.kind === 'magic') {
      setForm({
        ...EMPTY_FORM,
        ...convertProcessedMagicItemToFormData(selection.item),
      });
      return;
    }
    const category =
      selection.item.rawType === 'R'
        ? 'ring'
        : selection.item.rawType === 'P'
          ? 'potion'
          : selection.item.category.toLowerCase().includes('armor')
            ? 'armor'
            : 'other';
    setForm({
      ...EMPTY_FORM,
      name: selection.item.name,
      category,
      description: selection.item.description,
      properties: selection.item.properties ?? [],
    });
    setTagsText(selection.item.tags.join(', '));
  };

  const handleSubmit = () => {
    const tags = [
      ...new Set(
        tagsText
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean)
      ),
    ];
    onSave({
      ...makeIds(form),
      tags,
      group: group.trim() || undefined,
      sourceItemId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? 'Edit Custom Magic Item' : 'Create Custom Magic Item'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Group (optional)"
              value={group}
              onChange={event => setGroup(event.target.value)}
              placeholder="e.g., Feywild rewards"
            />
            <Input
              label="Tags (comma separated)"
              value={tagsText}
              onChange={event => setTagsText(event.target.value)}
              placeholder="quest, utility, level 5"
            />
          </div>
          <MagicItemForm
            formData={form}
            setFormData={setForm}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isEditing={!!item}
            autocompleteSlot={
              <AllItemsAutocomplete
                mundaneItems={mundane.items}
                magicItems={magic.items}
                loading={mundane.loading || magic.loading}
                onSelect={handleCompendiumSelect}
              />
            }
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
