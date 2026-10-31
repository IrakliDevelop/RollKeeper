'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Weapon } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import DragDropList from '@/components/ui/layout/DragDropList';
import { WeaponRow } from './WeaponRow';
import { WeaponFormDialog } from './WeaponFormDialog';
import {
  EquipmentFilterBar,
  getEquipmentEmptyText,
  type FilterConfig,
} from './EquipmentFilterBar';
import { useEquipmentFilters } from '@/hooks/useEquipmentFilters';
import { useSheetMode } from '@/components/ui/character/SheetMode';
import { EquipmentReorderControls } from './EquipmentReorderControls';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import type {
  WeaponFormData,
  WeaponChargeFormData,
} from '@/components/ui/game/equipment/WeaponForm';

const FILTER_CONFIG: FilterConfig = {
  showAttuned: true,
  showCategory: true,
  showRarity: false,
  showHasCharges: true,
  categoryOptions: ['all', 'simple', 'martial'],
};

export function WeaponsTab() {
  const { editing } = useSheetMode();
  const {
    character,
    addWeapon,
    updateWeapon,
    deleteWeapon,
    equipWeapon,
    reorderWeapons,
    expendWeaponCharge,
    restoreWeaponCharge,
    expendWeaponChargePoolAbility,
    restoreWeaponChargePool,
    setWeaponChargePoolUsed,
    useWeapon,
  } = useCharacterStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWeapon, setEditingWeapon] = useState<Weapon | null>(null);
  const [pendingDeleteFocusId, setPendingDeleteFocusId] = useState<
    string | null
  >(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (
      pendingDeleteFocusId &&
      !character.weapons.some(weapon => weapon.id === pendingDeleteFocusId)
    ) {
      addButtonRef.current?.focus();
      setPendingDeleteFocusId(null);
    }
  }, [character.weapons, pendingDeleteFocusId]);

  const {
    filters,
    updateFilter,
    resetFilters,
    filteredItems,
    hasActiveFilters,
  } = useEquipmentFilters(character.weapons);

  const handleAdd = () => {
    setEditingWeapon(null);
    setDialogOpen(true);
  };

  const handleEdit = (weapon: Weapon) => {
    setEditingWeapon(weapon);
    setDialogOpen(true);
  };

  const handleSubmit = useCallback(
    (formData: WeaponFormData, editingId: string | null) => {
      const chargesWithIds = (formData.charges || [])
        .filter(c => c.name.trim())
        .map(c => ({
          id:
            c.id ||
            `charge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: c.name,
          description: c.description,
          maxCharges: c.maxCharges,
          usedCharges: c.usedCharges,
          restType: c.restType,
          scaleWithProficiency: c.scaleWithProficiency,
          proficiencyMultiplier: c.proficiencyMultiplier,
        }));

      const chargePool = formData.chargePool
        ? {
            maxCharges: formData.chargePool.maxCharges,
            usedCharges: formData.chargePool.usedCharges,
            rechargeType: formData.chargePool.rechargeType,
            rechargeAmount: formData.chargePool.rechargeAmount,
            abilities: formData.chargePool.abilities.map(a => ({
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
        ...formData,
        properties: formData.properties.filter(p => p.trim()),
        range: formData.range?.normal
          ? { normal: formData.range.normal, long: formData.range.long }
          : undefined,
        charges: chargesWithIds.length > 0 ? chargesWithIds : undefined,
        chargePool,
        bonusSpellAttack: formData.bonusSpellAttack,
        bonusSpellSaveDc: formData.bonusSpellSaveDc,
      };

      if (editingId) {
        updateWeapon(editingId, weaponData);
      } else {
        addWeapon(weaponData);
      }
    },
    [addWeapon, updateWeapon]
  );

  return (
    <Section
      heading="Weapons"
      level={3}
      trailing={
        <div className="flex items-center gap-2">
          <span className="text-muted text-sm">{character.weapons.length}</span>
          <Button
            ref={addButtonRef}
            onClick={handleAdd}
            variant="primary"
            size="sm"
            leftIcon={<Plus size={16} />}
          >
            Add weapon
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <EquipmentFilterBar
          filters={filters}
          onFilterChange={updateFilter}
          onReset={resetFilters}
          hasActiveFilters={hasActiveFilters}
          config={FILTER_CONFIG}
        />

        {filteredItems.length > 0 ? (
          <DragDropList
            items={filteredItems}
            onReorder={(sourceIndex, destinationIndex) => {
              const source = filteredItems[sourceIndex];
              const destination = filteredItems[destinationIndex];
              if (source && destination)
                reorderWeapons(source.id, destination.id);
            }}
            keyExtractor={w => w.id}
            className="space-y-2"
            showDragHandle
            dragHandlePosition="left"
            renderItem={(weapon, index) => (
              <div>
                <WeaponRow
                  weapon={weapon}
                  characterLevel={character.level}
                  onEdit={handleEdit}
                  onDelete={id => {
                    void confirmDialog({
                      title: `Delete ${weapon.name}?`,
                      confirmLabel: 'Delete item',
                      cancelLabel: 'Cancel',
                      tone: 'danger',
                    }).then(confirmed => {
                      if (confirmed) {
                        setPendingDeleteFocusId(id);
                        deleteWeapon(id);
                      }
                    });
                  }}
                  onToggleEquip={(id, eq) => equipWeapon(id, eq)}
                  onExpendCharge={expendWeaponCharge}
                  onRestoreCharge={restoreWeaponCharge}
                  onExpendChargePoolAbility={expendWeaponChargePoolAbility}
                  onRestoreChargePool={restoreWeaponChargePool}
                  onSetChargePoolUsed={setWeaponChargePoolUsed}
                  onUse={useWeapon}
                  inventoryItems={character.inventoryItems}
                />
                {editing && (
                  <EquipmentReorderControls
                    name={weapon.name}
                    index={index}
                    count={filteredItems.length}
                    onMove={destinationIndex => {
                      const destination = filteredItems[destinationIndex];
                      if (destination)
                        reorderWeapons(weapon.id, destination.id);
                    }}
                  />
                )}
              </div>
            )}
          />
        ) : (
          <div className="text-muted py-12 text-center">
            <p className="text-heading font-medium">
              {hasActiveFilters
                ? getEquipmentEmptyText('weapons', filters)
                : 'Add your first weapon'}
            </p>
            {hasActiveFilters && (
              <Button onClick={resetFilters} variant="ghost" size="sm">
                Clear filters
              </Button>
            )}
          </div>
        )}

        <WeaponFormDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setEditingWeapon(null);
          }}
          editingWeapon={editingWeapon}
          onSubmit={handleSubmit}
        />
      </div>
    </Section>
  );
}
