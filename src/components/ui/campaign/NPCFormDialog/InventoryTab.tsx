'use client';

import { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { ItemAutocomplete } from '@/components/ui/forms/ItemAutocomplete';
import { useItemsData } from '@/hooks/useItemsData';
import { useMagicItemsData } from '@/hooks/useMagicItemsData';
import { NpcFormInventoryRow } from './NpcFormInventoryRow';
import type { NPCInventoryItem } from '@/types/encounter';
import type { ProcessedItem } from '@/types/items';
import type { NpcFormDraft, NpcFormUpdate } from './npcFormDraft';

interface InventoryTabProps {
  draft: NpcFormDraft;
  update: NpcFormUpdate;
  onEditItem: (itemId: string) => void;
}

type PendingFocus = { row: string } | 'add' | null;

function newItemId(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

export function InventoryTab({ draft, update, onEditItem }: InventoryTabProps) {
  const { items: dbItems, loading: dbItemsLoading } = useItemsData();
  const { items: dbMagicItems } = useMagicItemsData();
  const nameFields = useRef(new Map<string, HTMLInputElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<PendingFocus>(null);
  const items = draft.inventoryItems;

  // Focus moves after the add or remove has rendered.
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === 'add') addButton.current?.focus();
    else if (target) nameFields.current.get(target.row)?.focus();
  }, [items]);

  const handleSelect = (item: ProcessedItem) => {
    update(d => ({
      inventoryItems: [
        ...d.inventoryItems,
        {
          id: newItemId(),
          name: item.name,
          quantity: 1,
          category: item.category,
          weight: item.weight,
          value: item.value,
          rarity: item.rarity !== 'none' ? item.rarity : undefined,
          description: item.description,
          type: item.rawType,
        },
      ],
    }));
  };

  const handleAddCustom = () => {
    const id = newItemId();
    pendingFocus.current = { row: id };
    update(d => ({
      inventoryItems: [...d.inventoryItems, { id, name: '', quantity: 1 }],
    }));
  };

  const handleChange = (next: NPCInventoryItem) => {
    update(d => ({
      inventoryItems: d.inventoryItems.map(entry =>
        entry.id === next.id ? next : entry
      ),
    }));
  };

  const handleRemove = (index: number) => {
    const following = items[index + 1];
    pendingFocus.current = following ? { row: following.id } : 'add';
    update(d => ({
      inventoryItems: d.inventoryItems.filter(
        entry => entry.id !== items[index].id
      ),
    }));
  };

  return (
    <div className="space-y-5">
      <ItemAutocomplete
        items={dbItems}
        magicItems={dbMagicItems}
        loading={dbItemsLoading}
        onSelect={handleSelect}
        placeholder="Potion of healing"
      />

      {items.length === 0 ? (
        <p className="type-body text-muted">No items yet.</p>
      ) : (
        <ul className="divide-divider divide-y">
          {items.map((item, index) => (
            <NpcFormInventoryRow
              key={item.id}
              item={item}
              onChange={handleChange}
              onEdit={() => onEditItem(item.id)}
              onRemove={() => handleRemove(index)}
              nameRef={el => {
                if (el) nameFields.current.set(item.id, el);
                else nameFields.current.delete(item.id);
              }}
            />
          ))}
        </ul>
      )}

      <Button
        ref={addButton}
        variant="secondary"
        size="sm"
        onClick={handleAddCustom}
      >
        <Plus size={16} aria-hidden="true" />
        Add custom item
      </Button>
    </div>
  );
}
