'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { ArmorItem } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import DragDropList from '@/components/ui/layout/DragDropList';
import { ArmorRow } from './ArmorRow';
import { ArmorFormDialog, type ArmorFormData } from './ArmorFormDialog';
import {
  EquipmentFilterBar,
  getEquipmentEmptyText,
  type FilterConfig,
} from './EquipmentFilterBar';
import { useEquipmentFilters } from '@/hooks/useEquipmentFilters';
import { useSheetMode } from '@/components/ui/character/SheetMode';
import { EquipmentReorderControls } from './EquipmentReorderControls';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';

const FILTER_CONFIG: FilterConfig = {
  showAttuned: false,
  showCategory: true,
  showRarity: false,
  showHasCharges: false,
  categoryOptions: ['all', 'light', 'medium', 'heavy', 'shield'],
};

export function ArmorTab() {
  const { editing } = useSheetMode();
  const {
    character,
    addArmorItem,
    updateArmorItem,
    deleteArmorItem,
    equipArmorItem,
    reorderArmorItems,
  } = useCharacterStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArmor, setEditingArmor] = useState<ArmorItem | null>(null);
  const [pendingDeleteFocusId, setPendingDeleteFocusId] = useState<
    string | null
  >(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (
      pendingDeleteFocusId &&
      !character.armorItems.some(item => item.id === pendingDeleteFocusId)
    ) {
      addButtonRef.current?.focus();
      setPendingDeleteFocusId(null);
    }
  }, [character.armorItems, pendingDeleteFocusId]);

  const {
    filters,
    updateFilter,
    resetFilters,
    filteredItems,
    hasActiveFilters,
  } = useEquipmentFilters(character.armorItems, {
    showAttuned: false,
    showHasCharges: false,
  });

  const handleAdd = () => {
    setEditingArmor(null);
    setDialogOpen(true);
  };

  const handleEdit = (armor: ArmorItem) => {
    setEditingArmor(armor);
    setDialogOpen(true);
  };

  const handleSubmit = useCallback(
    (formData: ArmorFormData, editingId: string | null) => {
      if (editingId) {
        updateArmorItem(editingId, formData);
      } else {
        addArmorItem(formData);
      }
    },
    [addArmorItem, updateArmorItem]
  );

  return (
    <Section
      heading="Armor"
      level={3}
      trailing={
        <div className="flex items-center gap-2">
          <span className="text-muted text-sm">
            {character.armorItems.length}
          </span>
          <Button
            ref={addButtonRef}
            onClick={handleAdd}
            variant="primary"
            size="sm"
            leftIcon={<Plus size={16} />}
          >
            Add armor
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
                reorderArmorItems(source.id, destination.id);
            }}
            keyExtractor={a => a.id}
            className="space-y-2"
            showDragHandle
            dragHandlePosition="left"
            renderItem={(armor, index) => (
              <div>
                <ArmorRow
                  armor={armor}
                  onEdit={handleEdit}
                  onDelete={id => {
                    void confirmDialog({
                      title: `Delete ${armor.name}?`,
                      confirmLabel: 'Delete item',
                      cancelLabel: 'Cancel',
                      tone: 'danger',
                    }).then(confirmed => {
                      if (confirmed) {
                        setPendingDeleteFocusId(id);
                        deleteArmorItem(id);
                      }
                    });
                  }}
                  onToggleEquip={(id, eq) => equipArmorItem(id, eq)}
                />
                {editing && (
                  <EquipmentReorderControls
                    name={armor.name}
                    index={index}
                    count={filteredItems.length}
                    onMove={destinationIndex => {
                      const destination = filteredItems[destinationIndex];
                      if (destination)
                        reorderArmorItems(armor.id, destination.id);
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
                ? getEquipmentEmptyText('armor', filters)
                : "Add your character's armor"}
            </p>
            {hasActiveFilters && (
              <Button onClick={resetFilters} variant="ghost" size="sm">
                Clear filters
              </Button>
            )}
          </div>
        )}

        <ArmorFormDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setEditingArmor(null);
          }}
          editingArmor={editingArmor}
          onSubmit={handleSubmit}
        />
      </div>
    </Section>
  );
}
