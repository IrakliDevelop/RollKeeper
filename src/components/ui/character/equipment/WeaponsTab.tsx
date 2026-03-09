'use client';

import React, { useState, useCallback } from 'react';
import type { Weapon } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus, Swords } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import DragDropList from '@/components/ui/layout/DragDropList';
import { WeaponRow } from './WeaponRow';
import { WeaponFormDialog } from './WeaponFormDialog';
import { EquipmentFilterBar, type FilterConfig } from './EquipmentFilterBar';
import { useEquipmentFilters } from '@/hooks/useEquipmentFilters';
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
  const {
    character,
    addWeapon,
    updateWeapon,
    deleteWeapon,
    equipWeapon,
    reorderWeapons,
    expendWeaponChargePoolAbility,
    restoreWeaponChargePool,
    setWeaponChargePoolUsed,
  } = useCharacterStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWeapon, setEditingWeapon] = useState<Weapon | null>(null);

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-heading text-lg font-semibold">Weapons</h3>
          <span className="text-muted text-sm">
            ({character.weapons.length})
          </span>
        </div>
        <Button
          onClick={handleAdd}
          variant="primary"
          size="sm"
          leftIcon={<Plus size={16} />}
        >
          Add Weapon
        </Button>
      </div>

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
          onReorder={reorderWeapons}
          keyExtractor={w => w.id}
          className="space-y-2"
          showDragHandle
          dragHandlePosition="left"
          renderItem={weapon => (
            <WeaponRow
              weapon={weapon}
              onEdit={handleEdit}
              onDelete={id => deleteWeapon(id)}
              onToggleEquip={(id, eq) => equipWeapon(id, eq)}
              onExpendChargePoolAbility={expendWeaponChargePoolAbility}
              onRestoreChargePool={restoreWeaponChargePool}
              onSetChargePoolUsed={setWeaponChargePoolUsed}
            />
          )}
        />
      ) : (
        <div className="text-muted py-12 text-center">
          <Swords className="text-faint mx-auto mb-3 h-12 w-12" />
          <p className="text-heading font-medium">
            {hasActiveFilters
              ? 'No weapons match your filters'
              : 'No weapons added yet'}
          </p>
          <p className="mt-1 text-sm">
            {hasActiveFilters
              ? 'Try adjusting your filters.'
              : 'Add weapons to manage your arsenal.'}
          </p>
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
  );
}
