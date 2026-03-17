'use client';

import React, { useState } from 'react';
import {
  Weapon,
  MagicItem,
  WeaponCategory,
  WeaponType,
  DamageType,
  WeaponDamage,
} from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus, Sword, Wand2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/feedback/dialog';
import DragDropList from '@/components/ui/layout/DragDropList';
import { Button } from '@/components/ui/forms/button';
import { WeaponForm, MagicItemForm } from './equipment';
import { WeaponCard } from './equipment/WeaponCard';
import { MagicItemCard } from './equipment/MagicItemCard';
import type {
  WeaponChargeFormData,
  WeaponFormData,
} from './equipment/WeaponForm';
import type {
  MagicItemChargeFormData,
  MagicItemFormData,
} from './equipment/MagicItemForm';
import { MagicItemAutocomplete } from '@/components/ui/forms/MagicItemAutocomplete';
import { useMagicItemsData } from '@/hooks/useMagicItemsData';
import { convertProcessedMagicItemToFormData } from '@/utils/magicItemConversion';
import { WeaponAutocomplete } from '@/components/ui/forms/WeaponAutocomplete';
import { useWeaponsDbData } from '@/hooks/useWeaponsDbData';
import { convertProcessedWeaponToFormData } from '@/utils/weaponConversion';
import type { ProcessedMagicItem, ProcessedWeapon } from '@/types/items';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const initialMagicItemData: MagicItemFormData = {
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

const initialWeaponData: WeaponFormData = {
  name: '',
  category: 'simple',
  weaponType: ['melee'],
  damage: [
    {
      dice: '1d6',
      type: 'bludgeoning',
      label: 'Weapon Damage',
    },
  ],
  enhancementBonus: 0,
  attackBonus: 0,
  damageBonus: 0,
  properties: [],
  description: '',
  range: {
    normal: 5,
  },
  isEquipped: false,
  manualProficiency: undefined,
  requiresAttunement: false,
  isAttuned: false,
  charges: [],
};

export default function EquipmentModal({
  isOpen,
  onClose,
}: EquipmentModalProps) {
  const {
    character,
    addMagicItem,
    updateMagicItem,
    deleteMagicItem,
    attuneMagicItem,
    reorderMagicItems,
    expendMagicItemCharge,
    restoreMagicItemCharge,
    expendChargePoolAbility,
    restoreChargePool,
    setChargePoolUsed,
    addWeapon,
    updateWeapon,
    deleteWeapon,
    equipWeapon,
    reorderWeapons,
    expendWeaponChargePoolAbility,
    restoreWeaponChargePool,
    setWeaponChargePoolUsed,
  } = useCharacterStore();

  const { items: magicItemsDb, loading: magicItemsLoading } =
    useMagicItemsData();

  const handleMagicItemSelect = (item: ProcessedMagicItem) => {
    const autoFilled = convertProcessedMagicItemToFormData(item);
    setMagicItemForm(prev => ({
      ...prev,
      ...autoFilled,
    }));
  };

  const { items: weaponsDb, loading: weaponsLoading } = useWeaponsDbData();

  const handleWeaponDbSelect = (item: ProcessedWeapon) => {
    const autoFilled = convertProcessedWeaponToFormData(item);
    setWeaponForm(prev => ({
      ...prev,
      ...autoFilled,
    }));
  };

  const [showMagicItemForm, setShowMagicItemForm] = useState(false);
  const [showWeaponForm, setShowWeaponForm] = useState(false);
  const [editingMagicItem, setEditingMagicItem] = useState<MagicItem | null>(
    null
  );
  const [editingWeapon, setEditingWeapon] = useState<Weapon | null>(null);
  const [magicItemForm, setMagicItemForm] =
    useState<MagicItemFormData>(initialMagicItemData);
  const [weaponForm, setWeaponForm] =
    useState<WeaponFormData>(initialWeaponData);

  // Calculate attunement usage
  const attunedItems = character.magicItems.filter(
    item => item.isAttuned
  ).length;
  const weaponsRequiringAttunement = character.weapons.filter(
    weapon => weapon.isAttuned
  ).length;
  const totalAttuned = attunedItems + weaponsRequiringAttunement;

  const handleMagicItemSubmit = () => {
    if (!magicItemForm.name.trim()) return;

    const chargesWithIds = (magicItemForm.charges || [])
      .filter(charge => charge.name.trim())
      .map(charge => ({
        id:
          charge.id ||
          `charge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: charge.name,
        description: charge.description,
        maxCharges: charge.maxCharges,
        usedCharges: charge.usedCharges,
        restType: charge.restType,
        scaleWithProficiency: charge.scaleWithProficiency,
        proficiencyMultiplier: charge.proficiencyMultiplier,
      }));

    const chargePool = magicItemForm.chargePool
      ? {
          maxCharges: magicItemForm.chargePool.maxCharges,
          usedCharges: magicItemForm.chargePool.usedCharges,
          rechargeType: magicItemForm.chargePool.rechargeType,
          rechargeAmount: magicItemForm.chargePool.rechargeAmount,
          abilities: magicItemForm.chargePool.abilities.map(a => ({
            id:
              a.id ||
              `cpa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: a.name,
            description: a.description,
            cost: a.cost,
            isSpell: a.isSpell,
            spellLevel: a.spellLevel,
          })),
        }
      : undefined;

    const magicItemData = {
      ...magicItemForm,
      charges: chargesWithIds.length > 0 ? chargesWithIds : undefined,
      chargePool,
      bonusSpellAttack: magicItemForm.bonusSpellAttack,
      bonusSpellSaveDc: magicItemForm.bonusSpellSaveDc,
    };

    if (editingMagicItem) {
      updateMagicItem(editingMagicItem.id, magicItemData);
      setEditingMagicItem(null);
    } else {
      addMagicItem(magicItemData);
    }

    setMagicItemForm(initialMagicItemData);
    setShowMagicItemForm(false);
  };

  const handleWeaponSubmit = () => {
    if (!weaponForm.name.trim()) return;

    // Convert charges form data to WeaponCharge[] with IDs
    const chargesWithIds = (weaponForm.charges || [])
      .filter(charge => charge.name.trim()) // Only include charges with names
      .map(charge => ({
        id:
          charge.id ||
          `charge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: charge.name,
        description: charge.description,
        maxCharges: charge.maxCharges,
        usedCharges: charge.usedCharges,
        restType: charge.restType,
        scaleWithProficiency: charge.scaleWithProficiency,
        proficiencyMultiplier: charge.proficiencyMultiplier,
      }));

    const chargePool = weaponForm.chargePool
      ? {
          maxCharges: weaponForm.chargePool.maxCharges,
          usedCharges: weaponForm.chargePool.usedCharges,
          rechargeType: weaponForm.chargePool.rechargeType,
          rechargeAmount: weaponForm.chargePool.rechargeAmount,
          abilities: weaponForm.chargePool.abilities.map(a => ({
            id:
              a.id ||
              `cpa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: a.name,
            description: a.description,
            cost: a.cost,
            isSpell: a.isSpell,
            spellLevel: a.spellLevel,
          })),
        }
      : undefined;

    const weaponData = {
      ...weaponForm,
      properties: weaponForm.properties.filter(p => p.trim()),
      range: weaponForm.range?.normal
        ? {
            normal: weaponForm.range.normal,
            long: weaponForm.range.long,
          }
        : undefined,
      charges: chargesWithIds.length > 0 ? chargesWithIds : undefined,
      chargePool,
      bonusSpellAttack: weaponForm.bonusSpellAttack,
      bonusSpellSaveDc: weaponForm.bonusSpellSaveDc,
    };

    if (editingWeapon) {
      updateWeapon(editingWeapon.id, weaponData);
      setEditingWeapon(null);
    } else {
      addWeapon(weaponData);
    }

    setWeaponForm(initialWeaponData);
    setShowWeaponForm(false);
  };

  const handleEditMagicItem = (item: MagicItem) => {
    // Convert MagicItemCharge[] to MagicItemChargeFormData[]
    const chargesFormData: MagicItemChargeFormData[] = (item.charges || []).map(
      charge => ({
        id: charge.id,
        name: charge.name,
        description: charge.description,
        maxCharges: charge.maxCharges,
        usedCharges: charge.usedCharges,
        restType: charge.restType,
        scaleWithProficiency: charge.scaleWithProficiency,
        proficiencyMultiplier: charge.proficiencyMultiplier,
      })
    );

    setMagicItemForm({
      name: item.name,
      category: item.category,
      rarity: item.rarity,
      description: item.description,
      properties: item.properties,
      requiresAttunement: item.requiresAttunement,
      isAttuned: item.isAttuned,
      isEquipped: item.isEquipped,
      charges: chargesFormData,
      chargePool: item.chargePool
        ? {
            maxCharges: item.chargePool.maxCharges,
            usedCharges: item.chargePool.usedCharges,
            rechargeType: item.chargePool.rechargeType,
            rechargeAmount: item.chargePool.rechargeAmount,
            abilities: item.chargePool.abilities,
          }
        : undefined,
      bonusSpellAttack: item.bonusSpellAttack,
      bonusSpellSaveDc: item.bonusSpellSaveDc,
    });
    setEditingMagicItem(item);
    setShowMagicItemForm(true);
  };

  const handleEditWeapon = (weapon: Weapon) => {
    // Migrate old damage format to new array format if needed
    let damageArray: WeaponDamage[];
    if (Array.isArray(weapon.damage)) {
      damageArray = weapon.damage;
    } else if (weapon.legacyDamage && weapon.legacyDamage.dice) {
      // Use legacy damage if available
      damageArray = [
        {
          dice: weapon.legacyDamage.dice,
          type: weapon.legacyDamage.type as DamageType,
          versatiledice: weapon.legacyDamage.versatiledice,
          label: 'Weapon Damage',
        },
      ];
    } else {
      // Fallback: create default damage entry
      damageArray = [
        {
          dice: '1d6',
          type: 'bludgeoning',
          label: 'Weapon Damage',
        },
      ];
    }

    // Convert WeaponCharge[] to WeaponChargeFormData[]
    const chargesFormData: WeaponChargeFormData[] = (weapon.charges || []).map(
      charge => ({
        id: charge.id,
        name: charge.name,
        description: charge.description,
        maxCharges: charge.maxCharges,
        usedCharges: charge.usedCharges,
        restType: charge.restType,
        scaleWithProficiency: charge.scaleWithProficiency,
        proficiencyMultiplier: charge.proficiencyMultiplier,
      })
    );

    const chargePoolData = weapon.chargePool
      ? {
          maxCharges: weapon.chargePool.maxCharges,
          usedCharges: weapon.chargePool.usedCharges,
          rechargeType: weapon.chargePool.rechargeType,
          rechargeAmount: weapon.chargePool.rechargeAmount,
          abilities: weapon.chargePool.abilities,
        }
      : undefined;

    setWeaponForm({
      name: weapon.name,
      category: weapon.category,
      weaponType: weapon.weaponType,
      damage: damageArray,
      enhancementBonus: weapon.enhancementBonus,
      attackBonus: weapon.attackBonus || 0,
      damageBonus: weapon.damageBonus || 0,
      properties: weapon.properties,
      description: weapon.description || '',
      range: weapon.range || { normal: 5 },
      isEquipped: weapon.isEquipped,
      manualProficiency: weapon.manualProficiency,
      requiresAttunement: weapon.requiresAttunement || false,
      isAttuned: weapon.isAttuned || false,
      charges: chargesFormData,
      chargePool: chargePoolData,
      bonusSpellAttack: weapon.bonusSpellAttack,
      bonusSpellSaveDc: weapon.bonusSpellSaveDc,
    });
    setEditingWeapon(weapon);
    setShowWeaponForm(true);
  };

  const handleAttunement = (item: MagicItem, shouldAttune: boolean) => {
    if (shouldAttune && totalAttuned >= character.attunementSlots.max) {
      alert(
        `Cannot attune to more items. Maximum attunement slots: ${character.attunementSlots.max}`
      );
      return;
    }
    attuneMagicItem(item.id, shouldAttune);
  };

  const handleCloseModal = () => {
    setShowMagicItemForm(false);
    setShowWeaponForm(false);
    setEditingMagicItem(null);
    setEditingWeapon(null);
    setMagicItemForm(initialMagicItemData);
    setWeaponForm(initialWeaponData);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleCloseModal();
      }}
    >
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{`⚔️ Equipment & Magic Items (Attunement: ${totalAttuned}/${character.attunementSlots.max})`}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {/* Show forms if active, otherwise show main content */}
          {showWeaponForm ? (
            <div className="space-y-4">
              <h3 className="text-heading text-xl font-bold">
                {editingWeapon ? 'Edit Weapon' : 'Add Weapon'}
              </h3>

              <WeaponForm
                formData={weaponForm}
                setFormData={setWeaponForm}
                onSubmit={handleWeaponSubmit}
                onCancel={() => {
                  setShowWeaponForm(false);
                  setEditingWeapon(null);
                  setWeaponForm(initialWeaponData);
                }}
                isEditing={!!editingWeapon}
                autocompleteSlot={
                  <WeaponAutocomplete
                    items={weaponsDb}
                    onSelect={handleWeaponDbSelect}
                    loading={weaponsLoading}
                  />
                }
              />
            </div>
          ) : showMagicItemForm ? (
            <div className="space-y-4">
              <h3 className="text-heading text-xl font-bold">
                {editingMagicItem ? 'Edit Magic Item' : 'Add Magic Item'}
              </h3>

              <MagicItemForm
                formData={magicItemForm}
                setFormData={setMagicItemForm}
                onSubmit={handleMagicItemSubmit}
                onCancel={() => {
                  setShowMagicItemForm(false);
                  setEditingMagicItem(null);
                  setMagicItemForm(initialMagicItemData);
                }}
                isEditing={!!editingMagicItem}
                autocompleteSlot={
                  <MagicItemAutocomplete
                    items={magicItemsDb}
                    onSelect={handleMagicItemSelect}
                    loading={magicItemsLoading}
                  />
                }
              />
            </div>
          ) : (
            // Main equipment view
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Weapons Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-heading flex items-center gap-2 text-xl font-bold">
                    <Sword className="h-5 w-5" />
                    Weapons ({character.weapons.length})
                  </h3>
                  <Button
                    onClick={() => setShowWeaponForm(true)}
                    variant="primary"
                    size="md"
                    leftIcon={<Plus size={16} />}
                    className="bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    Add Weapon
                  </Button>
                </div>

                <div className="space-y-3">
                  {character.weapons.length === 0 ? (
                    <div className="text-muted py-8 text-center">
                      <Sword className="text-faint mx-auto mb-2 h-12 w-12" />
                      <p>No weapons added yet</p>
                    </div>
                  ) : (
                    <DragDropList
                      items={character.weapons}
                      onReorder={reorderWeapons}
                      keyExtractor={weapon => weapon.id}
                      className="space-y-3"
                      showDragHandle={true}
                      dragHandlePosition="left"
                      renderItem={weapon => (
                        <WeaponCard
                          weapon={weapon}
                          onEdit={handleEditWeapon}
                          onDelete={deleteWeapon}
                          onToggleEquip={equipWeapon}
                          onExpendWeaponChargePoolAbility={
                            expendWeaponChargePoolAbility
                          }
                          onRestoreWeaponChargePool={restoreWeaponChargePool}
                          onSetWeaponChargePoolUsed={setWeaponChargePoolUsed}
                        />
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Magic Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-heading flex items-center gap-2 text-xl font-bold">
                    <Wand2 className="h-5 w-5" />
                    Magic Items ({character.magicItems.length})
                  </h3>
                  <Button
                    onClick={() => setShowMagicItemForm(true)}
                    variant="primary"
                    size="md"
                    leftIcon={<Plus size={16} />}
                    className="bg-linear-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
                  >
                    Add Magic Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {character.magicItems.length === 0 ? (
                    <div className="text-muted py-8 text-center">
                      <Wand2 className="text-faint mx-auto mb-2 h-12 w-12" />
                      <p>No magic items added yet</p>
                    </div>
                  ) : (
                    <DragDropList
                      items={character.magicItems}
                      onReorder={reorderMagicItems}
                      keyExtractor={item => item.id}
                      className="space-y-3"
                      showDragHandle={true}
                      dragHandlePosition="left"
                      renderItem={item => (
                        <MagicItemCard
                          item={item}
                          characterLevel={character.level}
                          onEdit={handleEditMagicItem}
                          onDelete={deleteMagicItem}
                          onToggleAttunement={handleAttunement}
                          onExpendCharge={expendMagicItemCharge}
                          onRestoreCharge={restoreMagicItemCharge}
                          onExpendChargePoolAbility={expendChargePoolAbility}
                          onRestoreChargePool={restoreChargePool}
                          onSetChargePoolUsed={setChargePoolUsed}
                        />
                      )}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
