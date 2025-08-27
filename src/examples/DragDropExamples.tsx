'use client';

import React from 'react';
import DragDropList from '@/components/ui/layout/DragDropList';
import { Weapon, InventoryItem, MagicItem } from '@/types/character';
import { Sword, Package, Sparkles, Trash2, Edit2 } from 'lucide-react';

// Example: Weapons List with Drag and Drop
interface WeaponListProps {
  weapons: Weapon[];
  onReorder: (sourceIndex: number, destinationIndex: number) => void;
  onEdit?: (weapon: Weapon) => void;
  onDelete?: (weaponId: string) => void;
  disabled?: boolean;
}

export function DraggableWeaponsList({ 
  weapons, 
  onReorder, 
  onEdit, 
  onDelete, 
  disabled = false 
}: WeaponListProps) {
  return (
    <DragDropList
      items={weapons}
      onReorder={onReorder}
      keyExtractor={(weapon) => weapon.id}
      disabled={disabled}
      className="space-y-3"
      itemClassName="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
      showDragHandle={!disabled}
      dragHandlePosition="left"
      renderItem={(weapon) => (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sword size={20} className="text-gray-500" />
            <div>
              <h4 className="font-medium text-gray-900">{weapon.name}</h4>
              <p className="text-sm text-gray-500">
                {weapon.damage.length > 0 ? (
                  weapon.damage.map((dmg, idx) => (
                    <span key={idx}>
                      {dmg.dice} {dmg.type}
                      {idx < weapon.damage.length - 1 && ', '}
                    </span>
                  ))
                ) : (
                  'No damage defined'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(weapon)}
                className="p-2 text-blue-600 hover:bg-blue-100 rounded-md"
                title="Edit weapon"
              >
                <Edit2 size={16} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(weapon.id)}
                className="p-2 text-red-600 hover:bg-red-100 rounded-md"
                title="Delete weapon"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    />
  );
}

// Example: Inventory Items with Drag and Drop (grouped by location)
interface InventoryListProps {
  items: InventoryItem[];
  onReorder: (sourceIndex: number, destinationIndex: number) => void;
  onEdit?: (item: InventoryItem) => void;
  onDelete?: (itemId: string) => void;
  disabled?: boolean;
}

export function DraggableInventoryList({ 
  items, 
  onReorder, 
  onEdit, 
  onDelete, 
  disabled = false 
}: InventoryListProps) {
  return (
    <DragDropList
      items={items}
      onReorder={onReorder}
      keyExtractor={(item) => item.id}
      disabled={disabled}
      className="space-y-2"
      itemClassName="bg-purple-25 border border-purple-200 rounded-md p-3 hover:shadow-sm transition-all"
      showDragHandle={!disabled}
      dragHandlePosition="right"
      renderItem={(item) => (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package size={18} className="text-purple-500" />
            <div>
              <h5 className="font-medium text-gray-900">
                {item.name} {item.quantity > 1 && `(×${item.quantity})`}
              </h5>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="capitalize">{item.category}</span>
                {item.location && (
                  <>
                    <span>•</span>
                    <span>{item.location}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(item)}
                className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                title="Edit item"
              >
                <Edit2 size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(item.id)}
                className="p-1 text-red-600 hover:bg-red-100 rounded"
                title="Delete item"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    />
  );
}

// Example: Magic Items with Drag and Drop
interface MagicItemListProps {
  items: MagicItem[];
  onReorder: (sourceIndex: number, destinationIndex: number) => void;
  onEdit?: (item: MagicItem) => void;
  onDelete?: (itemId: string) => void;
  disabled?: boolean;
}

export function DraggableMagicItemsList({ 
  items, 
  onReorder, 
  onEdit, 
  onDelete, 
  disabled = false 
}: MagicItemListProps) {
  return (
    <DragDropList
      items={items}
      onReorder={onReorder}
      keyExtractor={(item) => item.id}
      disabled={disabled}
      className="space-y-3"
      itemClassName="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4 hover:shadow-md transition-all"
      showDragHandle={!disabled}
      dragHandlePosition="left"
      renderItem={(item) => (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-indigo-500" />
            <div>
              <h4 className="font-medium text-gray-900">{item.name}</h4>
              <div className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  item.rarity === 'common' ? 'bg-gray-100 text-gray-700' :
                  item.rarity === 'uncommon' ? 'bg-green-100 text-green-700' :
                  item.rarity === 'rare' ? 'bg-blue-100 text-blue-700' :
                  item.rarity === 'very rare' ? 'bg-purple-100 text-purple-700' :
                  item.rarity === 'legendary' ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {item.rarity}
                </span>
                <span className="text-gray-500 capitalize">{item.category}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(item)}
                className="p-2 text-blue-600 hover:bg-blue-100 rounded-md"
                title="Edit magic item"
              >
                <Edit2 size={16} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(item.id)}
                className="p-2 text-red-600 hover:bg-red-100 rounded-md"
                title="Delete magic item"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    />
  );
}

// Usage Example Component
export function DragDropShowcase() {
  const [weapons, setWeapons] = React.useState<Weapon[]>([
    // Mock data - replace with real data
  ]);

  const handleWeaponReorder = (sourceIndex: number, destinationIndex: number) => {
    const newWeapons = [...weapons];
    const [moved] = newWeapons.splice(sourceIndex, 1);
    newWeapons.splice(destinationIndex, 0, moved);
    setWeapons(newWeapons);
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-4">Draggable Weapons List</h2>
        <DraggableWeaponsList
          weapons={weapons}
          onReorder={handleWeaponReorder}
          onEdit={(weapon) => console.log('Edit weapon:', weapon)}
          onDelete={(id) => console.log('Delete weapon:', id)}
        />
      </div>
      
      {/* Add similar sections for inventory and magic items */}
    </div>
  );
} 