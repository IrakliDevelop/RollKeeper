'use client';

import React, { useState, useEffect } from 'react';
import type { Weapon, WeaponDamage, DamageType } from '@/types/character';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/feedback/dialog';
import {
  WeaponForm,
  type WeaponFormData,
} from '@/components/ui/game/equipment/WeaponForm';
import type { WeaponChargeFormData } from '@/components/ui/game/equipment/WeaponForm';
import { WeaponAutocomplete } from '@/components/ui/forms/WeaponAutocomplete';
import { useWeaponsDbData } from '@/hooks/useWeaponsDbData';
import { convertProcessedWeaponToFormData } from '@/utils/weaponConversion';
import type { ProcessedWeapon } from '@/types/items';

interface WeaponFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingWeapon: Weapon | null;
  onSubmit: (data: WeaponFormData, editingId: string | null) => void;
}

const initialWeaponData: WeaponFormData = {
  name: '',
  category: 'simple',
  weaponType: ['melee'],
  damage: [{ dice: '1d6', type: 'bludgeoning', label: 'Weapon Damage' }],
  enhancementBonus: 0,
  attackBonus: 0,
  damageBonus: 0,
  properties: [],
  description: '',
  range: { normal: 5 },
  isEquipped: false,
  manualProficiency: undefined,
  requiresAttunement: false,
  isAttuned: false,
  charges: [],
};

export function WeaponFormDialog({
  open,
  onClose,
  editingWeapon,
  onSubmit,
}: WeaponFormDialogProps) {
  const [formData, setFormData] = useState<WeaponFormData>(initialWeaponData);
  const { items: weaponsDb, loading: weaponsLoading } = useWeaponsDbData();

  useEffect(() => {
    if (!open) return;

    if (editingWeapon) {
      let damageArray: WeaponDamage[];
      if (Array.isArray(editingWeapon.damage)) {
        damageArray = editingWeapon.damage;
      } else if (editingWeapon.legacyDamage?.dice) {
        damageArray = [
          {
            dice: editingWeapon.legacyDamage.dice,
            type: editingWeapon.legacyDamage.type as DamageType,
            versatiledice: editingWeapon.legacyDamage.versatiledice,
            label: 'Weapon Damage',
          },
        ];
      } else {
        damageArray = [
          { dice: '1d6', type: 'bludgeoning', label: 'Weapon Damage' },
        ];
      }

      const chargesFormData: WeaponChargeFormData[] = (
        editingWeapon.charges || []
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

      const chargePoolData = editingWeapon.chargePool
        ? {
            maxCharges: editingWeapon.chargePool.maxCharges,
            usedCharges: editingWeapon.chargePool.usedCharges,
            rechargeType: editingWeapon.chargePool.rechargeType,
            rechargeAmount: editingWeapon.chargePool.rechargeAmount,
            abilities: editingWeapon.chargePool.abilities,
          }
        : undefined;

      setFormData({
        name: editingWeapon.name,
        category: editingWeapon.category,
        weaponType: editingWeapon.weaponType,
        damage: damageArray,
        enhancementBonus: editingWeapon.enhancementBonus,
        attackBonus: editingWeapon.attackBonus || 0,
        damageBonus: editingWeapon.damageBonus || 0,
        properties: editingWeapon.properties,
        description: editingWeapon.description || '',
        range: editingWeapon.range || { normal: 5 },
        isEquipped: editingWeapon.isEquipped,
        manualProficiency: editingWeapon.manualProficiency,
        requiresAttunement: editingWeapon.requiresAttunement || false,
        isAttuned: editingWeapon.isAttuned || false,
        charges: chargesFormData,
        chargePool: chargePoolData,
        bonusSpellAttack: editingWeapon.bonusSpellAttack,
        bonusSpellSaveDc: editingWeapon.bonusSpellSaveDc,
      });
    } else {
      setFormData(initialWeaponData);
    }
  }, [open, editingWeapon]);

  const handleWeaponDbSelect = (item: ProcessedWeapon) => {
    const autoFilled = convertProcessedWeaponToFormData(item);
    setFormData(prev => ({ ...prev, ...autoFilled }));
  };

  const handleSubmit = () => {
    onSubmit(formData, editingWeapon?.id ?? null);
    setFormData(initialWeaponData);
    onClose();
  };

  const handleCancel = () => {
    setFormData(initialWeaponData);
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
            {editingWeapon ? 'Edit Weapon' : 'Add Weapon'}
          </DialogTitle>
          <DialogDescription>
            {editingWeapon
              ? 'Update weapon details below.'
              : 'Search the database or fill in manually.'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <WeaponForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isEditing={!!editingWeapon}
            autocompleteSlot={
              <WeaponAutocomplete
                items={weaponsDb}
                onSelect={handleWeaponDbSelect}
                loading={weaponsLoading}
              />
            }
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
