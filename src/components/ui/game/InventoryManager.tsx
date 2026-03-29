'use client';

import React from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { InventoryManager as SharedInventoryManager } from '@/components/shared/character';
import { calculateTotalWeight, calculateTotalValue } from '@/utils/encumbrance';
import { InventoryItem } from '@/types/character';

interface InventoryManagerProps {
  onSendItem?: (item: InventoryItem) => void;
}

export default function InventoryManager({
  onSendItem,
}: InventoryManagerProps) {
  const {
    character,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    updateItemQuantity,
    reorderInventoryItems,
  } = useCharacterStore();

  return (
    <div className="space-y-6">
      <SharedInventoryManager
        items={character.inventoryItems}
        onAddItem={item => addInventoryItem(item)}
        onUpdateItem={updateInventoryItem}
        onDeleteItem={deleteInventoryItem}
        onQuantityChange={updateItemQuantity}
        onReorderItems={reorderInventoryItems}
        onSendItem={onSendItem}
        overrideTotalWeight={calculateTotalWeight(character)}
        overrideTotalValue={calculateTotalValue(character)}
        readonly={false}
        compact={false}
        hideAddButton={false}
        hideFilters={false}
        hideLocations={false}
      />
    </div>
  );
}
