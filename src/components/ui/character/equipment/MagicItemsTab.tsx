'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { MagicItem } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Section } from '@/components/ui/layout/section';
import DragDropList from '@/components/ui/layout/DragDropList';
import { MagicItemRow } from './MagicItemRow';
import { MagicItemFormDialog } from './MagicItemFormDialog';
import {
  EquipmentFilterBar,
  getEquipmentEmptyText,
  type FilterConfig,
} from './EquipmentFilterBar';
import { useEquipmentFilters } from '@/hooks/useEquipmentFilters';
import { useSheetMode } from '@/components/ui/character/SheetMode';
import { EquipmentReorderControls } from './EquipmentReorderControls';
import type { MagicItemFormData } from '@/components/ui/game/equipment/MagicItemForm';
import {
  alertDialog,
  confirmDialog,
} from '@/components/ui/feedback/confirm-dialog';

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
  const { editing } = useSheetMode();
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
  const [pendingDeleteFocusId, setPendingDeleteFocusId] = useState<
    string | null
  >(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (
      pendingDeleteFocusId &&
      !character.magicItems.some(item => item.id === pendingDeleteFocusId)
    ) {
      addButtonRef.current?.focus();
      setPendingDeleteFocusId(null);
    }
  }, [character.magicItems, pendingDeleteFocusId]);

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
      void alertDialog({
        title: 'No attunement slots left',
        message: `You can attune to ${character.attunementSlots.max} items at a time. End attunement to another item first.`,
      });
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
    <Section
      heading="Magic items"
      level={3}
      trailing={
        <div className="flex items-center gap-2">
          <span className="text-muted text-sm">
            {character.magicItems.length}
          </span>
          <Badge variant="neutral" size="sm">
            {totalAttuned}/{character.attunementSlots.max} attuned
          </Badge>
          <Button
            ref={addButtonRef}
            onClick={handleAdd}
            variant="primary"
            size="sm"
            leftIcon={<Plus size={16} />}
          >
            Add magic item
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
                reorderMagicItems(source.id, destination.id);
            }}
            keyExtractor={i => i.id}
            className="space-y-2"
            showDragHandle
            dragHandlePosition="left"
            renderItem={(item, index) => (
              <div>
                <MagicItemRow
                  item={item}
                  characterLevel={character.level}
                  onEdit={handleEdit}
                  onDelete={id => {
                    void confirmDialog({
                      title: `Delete ${item.name}?`,
                      confirmLabel: 'Delete item',
                      cancelLabel: 'Cancel',
                      tone: 'danger',
                    }).then(confirmed => {
                      if (confirmed) {
                        setPendingDeleteFocusId(id);
                        deleteMagicItem(id);
                      }
                    });
                  }}
                  onToggleAttunement={handleAttunement}
                  onExpendCharge={expendMagicItemCharge}
                  onRestoreCharge={restoreMagicItemCharge}
                  onExpendChargePoolAbility={expendChargePoolAbility}
                  onRestoreChargePool={restoreChargePool}
                  onSetChargePoolUsed={setChargePoolUsed}
                />
                {editing && (
                  <EquipmentReorderControls
                    name={item.name}
                    index={index}
                    count={filteredItems.length}
                    onMove={destinationIndex => {
                      const destination = filteredItems[destinationIndex];
                      if (destination)
                        reorderMagicItems(item.id, destination.id);
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
                ? getEquipmentEmptyText('magic items', filters)
                : 'Add your first magic item'}
            </p>
            {hasActiveFilters && (
              <Button onClick={resetFilters} variant="ghost" size="sm">
                Clear filters
              </Button>
            )}
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
    </Section>
  );
}
