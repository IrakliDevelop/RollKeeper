'use client';

import React from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { InventoryManager as SharedInventoryManager } from '@/components/shared/character';

export default function InventoryManager() {
  const { 
    character, 
    addInventoryItem, 
    updateInventoryItem, 
    deleteInventoryItem, 
    updateItemQuantity,
    reorderInventoryItems
  } = useCharacterStore();
  return (
    <div className="space-y-6">
      <SharedInventoryManager
        items={character.inventoryItems}
        onAddItem={(item) => addInventoryItem(item)}
        onUpdateItem={updateInventoryItem}
        onDeleteItem={deleteInventoryItem}
        onQuantityChange={updateItemQuantity}
        onReorderItems={reorderInventoryItems}
        readonly={false}
        compact={false}
        hideAddButton={false}
        hideFilters={false}
        hideLocations={false}
      />
    </div>
  );
}
