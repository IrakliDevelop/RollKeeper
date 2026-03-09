'use client';

import React, { useState, useCallback } from 'react';
import type { MagicItem } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import DragDropList from '@/components/ui/layout/DragDropList';
import { MagicItemRow } from './MagicItemRow';
import { MagicItemFormDialog } from './MagicItemFormDialog';
import { EquipmentFilterBar, type FilterConfig } from './EquipmentFilterBar';
import { useEquipmentFilters } from '@/hooks/useEquipmentFilters';
import type { MagicItemFormData } from '@/components/ui/game/equipment/MagicItemForm';

const FILTER_CONFIG: FilterConfig = {
  showAttuned: true,
  showCategory: true,
  showRarity: true,
  showHasCharges: true,
  categoryOptions: [
    'all',
    'wondrous',
    'wand',
    'staff',
    'rod',
    'ring',
    'scroll',
    'potion',
    'weapon',
    'armor',
    'other',
  ],
};

export function MagicItemsTab() {
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
  } = useCharacterStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MagicItem | null>(null);

  const {
    filters,
    updateFilter,
    resetFilters,
    filteredItems,
    hasActiveFilters,
  } = useEquipmentFilters(character.magicItems);

  const totalAttuned = character.magicItems.filter(i => i.isAttuned).length;

  const handleAdd = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: MagicItem) => {
    setEditingItem(item);
    setDialogOpen(true);
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

  const handleSubmit = useCallback(
    (formData: MagicItemFormData, editingId: string | null) => {
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

      const itemData = {
        ...formData,
        charges: chargesWithIds.length > 0 ? chargesWithIds : undefined,
        chargePool,
        bonusSpellAttack: formData.bonusSpellAttack,
        bonusSpellSaveDc: formData.bonusSpellSaveDc,
      };

      if (editingId) {
        updateMagicItem(editingId, itemData);
      } else {
        addMagicItem(itemData);
      }
    },
    [addMagicItem, updateMagicItem]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-heading text-lg font-semibold">Magic Items</h3>
          <span className="text-muted text-sm">
            ({character.magicItems.length})
          </span>
          <Badge variant="primary" size="sm">
            {totalAttuned}/{character.attunementSlots.max} attuned
          </Badge>
        </div>
        <Button
          onClick={handleAdd}
          variant="primary"
          size="sm"
          leftIcon={<Plus size={16} />}
        >
          Add Item
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
          onReorder={reorderMagicItems}
          keyExtractor={i => i.id}
          className="space-y-2"
          showDragHandle
          dragHandlePosition="left"
          renderItem={item => (
            <MagicItemRow
              item={item}
              characterLevel={character.level}
              onEdit={handleEdit}
              onDelete={id => deleteMagicItem(id)}
              onToggleAttunement={handleAttunement}
              onExpendCharge={expendMagicItemCharge}
              onRestoreCharge={restoreMagicItemCharge}
              onExpendChargePoolAbility={expendChargePoolAbility}
              onRestoreChargePool={restoreChargePool}
              onSetChargePoolUsed={setChargePoolUsed}
            />
          )}
        />
      ) : (
        <div className="text-muted py-12 text-center">
          <Sparkles className="text-faint mx-auto mb-3 h-12 w-12" />
          <p className="text-heading font-medium">
            {hasActiveFilters
              ? 'No magic items match your filters'
              : 'No magic items added yet'}
          </p>
          <p className="mt-1 text-sm">
            {hasActiveFilters
              ? 'Try adjusting your filters.'
              : 'Add magic items to manage your collection.'}
          </p>
        </div>
      )}

      <MagicItemFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingItem(null);
        }}
        editingItem={editingItem}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
