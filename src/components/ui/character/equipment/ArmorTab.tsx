'use client';

import React, { useState, useCallback } from 'react';
import type { ArmorItem } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import DragDropList from '@/components/ui/layout/DragDropList';
import { ArmorRow } from './ArmorRow';
import { ArmorFormDialog, type ArmorFormData } from './ArmorFormDialog';
import { EquipmentFilterBar, type FilterConfig } from './EquipmentFilterBar';
import { useEquipmentFilters } from '@/hooks/useEquipmentFilters';

const FILTER_CONFIG: FilterConfig = {
  showAttuned: false,
  showCategory: true,
  showRarity: false,
  showHasCharges: false,
  categoryOptions: ['all', 'light', 'medium', 'heavy', 'shield'],
};

export function ArmorTab() {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-heading text-lg font-semibold">Armor</h3>
          <span className="text-muted text-sm">
            ({character.armorItems.length})
          </span>
        </div>
        <Button
          onClick={handleAdd}
          variant="primary"
          size="sm"
          leftIcon={<Plus size={16} />}
        >
          Add Armor
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
          onReorder={reorderArmorItems}
          keyExtractor={a => a.id}
          className="space-y-2"
          showDragHandle
          dragHandlePosition="left"
          renderItem={armor => (
            <ArmorRow
              armor={armor}
              onEdit={handleEdit}
              onDelete={id => deleteArmorItem(id)}
              onToggleEquip={(id, eq) => equipArmorItem(id, eq)}
            />
          )}
        />
      ) : (
        <div className="text-muted py-12 text-center">
          <Shield className="text-faint mx-auto mb-3 h-12 w-12" />
          <p className="text-heading font-medium">
            {hasActiveFilters
              ? 'No armor matches your filters'
              : 'No armor added yet'}
          </p>
          <p className="mt-1 text-sm">
            {hasActiveFilters
              ? 'Try adjusting your filters.'
              : 'Add armor pieces to manage your defenses.'}
          </p>
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
  );
}
