'use client';

import React, { useState, useEffect } from 'react';
import type { MagicItem } from '@/types/character';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/feedback/dialog';
import {
  MagicItemForm,
  type MagicItemFormData,
} from '@/components/ui/game/equipment/MagicItemForm';
import type { MagicItemChargeFormData } from '@/components/ui/game/equipment/MagicItemForm';
import { MagicItemAutocomplete } from '@/components/ui/forms/MagicItemAutocomplete';
import { useMagicItemsData } from '@/hooks/useMagicItemsData';
import { convertProcessedMagicItemToFormData } from '@/utils/magicItemConversion';
import type { ProcessedMagicItem } from '@/types/items';

interface MagicItemFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingItem: MagicItem | null;
  onSubmit: (data: MagicItemFormData, editingId: string | null) => void;
}

const initialData: MagicItemFormData = {
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

export function MagicItemFormDialog({
  open,
  onClose,
  editingItem,
  onSubmit,
}: MagicItemFormDialogProps) {
  const [formData, setFormData] = useState<MagicItemFormData>(initialData);
  const { items: magicItemsDb, loading: magicItemsLoading } =
    useMagicItemsData();

  useEffect(() => {
    if (!open) return;

    if (editingItem) {
      const chargesFormData: MagicItemChargeFormData[] = (
        editingItem.charges || []
      ).map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        maxCharges: c.maxCharges,
        usedCharges: c.usedCharges,
        restType: c.restType,
        scaleWithProficiency: c.scaleWithProficiency,
        proficiencyMultiplier: c.proficiencyMultiplier,
      }));

      setFormData({
        name: editingItem.name,
        category: editingItem.category,
        rarity: editingItem.rarity,
        description: editingItem.description,
        properties: editingItem.properties,
        requiresAttunement: editingItem.requiresAttunement,
        isAttuned: editingItem.isAttuned,
        isEquipped: editingItem.isEquipped,
        charges: chargesFormData,
        chargePool: editingItem.chargePool
          ? {
              maxCharges: editingItem.chargePool.maxCharges,
              usedCharges: editingItem.chargePool.usedCharges,
              rechargeType: editingItem.chargePool.rechargeType,
              rechargeAmount: editingItem.chargePool.rechargeAmount,
              abilities: editingItem.chargePool.abilities,
            }
          : undefined,
        bonusSpellAttack: editingItem.bonusSpellAttack,
        bonusSpellSaveDc: editingItem.bonusSpellSaveDc,
      });
    } else {
      setFormData(initialData);
    }
  }, [open, editingItem]);

  const handleDbSelect = (item: ProcessedMagicItem) => {
    const autoFilled = convertProcessedMagicItemToFormData(item);
    setFormData(prev => ({ ...prev, ...autoFilled }));
  };

  const handleSubmit = () => {
    onSubmit(formData, editingItem?.id ?? null);
    setFormData(initialData);
    onClose();
  };

  const handleCancel = () => {
    setFormData(initialData);
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
          <DialogTitle>
            {editingItem ? 'Edit Magic Item' : 'Add Magic Item'}
          </DialogTitle>
          <DialogDescription>
            {editingItem
              ? 'Update item details below.'
              : 'Search the database or fill in manually.'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <MagicItemForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isEditing={!!editingItem}
            autocompleteSlot={
              <MagicItemAutocomplete
                items={magicItemsDb}
                onSelect={handleDbSelect}
                loading={magicItemsLoading}
              />
            }
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
