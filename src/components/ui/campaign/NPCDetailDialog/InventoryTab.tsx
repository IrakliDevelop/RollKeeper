'use client';

import React, { useMemo, useState } from 'react';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import {
  ItemForm,
  initialInventoryFormData,
} from '@/components/ui/game/inventory/ItemForm';
import type { InventoryFormData } from '@/components/ui/game/inventory/ItemForm';
import { useItemsData } from '@/hooks/useItemsData';
import { useMagicItemsData } from '@/hooks/useMagicItemsData';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';
import type { Currency } from '@/types/character';
import {
  npcInventoryItemToFormData,
  formDataToNpcInventoryPatch,
} from '@/utils/npcInventoryItemForm';
import { useNPCStore } from '@/store/npcStore';
import { NPCCurrencyStrip } from '../NPCCurrencyStrip';
import { useFocusAfterRemove } from '../NpcLibrary/NpcLibrary.hooks';
import { NpcInventoryRow } from './NpcInventoryRow';
import { NpcItemViewDialog } from './NpcItemViewDialog';

const EMPTY_CURRENCY: Currency = {
  platinum: 0,
  gold: 0,
  electrum: 0,
  silver: 0,
  copper: 0,
};

interface InventoryTabProps {
  npc: CampaignNPC;
  readOnly?: boolean;
  onUpdateInventory?: (npcId: string, inventory: NPCInventoryItem[]) => void;
  onSendItemToPlayer?: (item: NPCInventoryItem, npcName: string) => void;
}

export function InventoryTab({
  npc,
  readOnly,
  onUpdateInventory: onUpdateInventoryProp,
  onSendItemToPlayer: onSendItemToPlayerProp,
}: InventoryTabProps) {
  // Read-only shows what the NPC carries and offers no way to change it.
  const onUpdateInventory = readOnly ? undefined : onUpdateInventoryProp;
  const onSendItemToPlayer = readOnly ? undefined : onSendItemToPlayerProp;
  const [inventoryFormOpen, setInventoryFormOpen] = useState(false);
  const [inventoryFormEditingItem, setInventoryFormEditingItem] =
    useState<NPCInventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<NPCInventoryItem | null>(null);

  const inventory = useMemo(() => npc.inventory ?? [], [npc.inventory]);
  const itemIds = useMemo(() => inventory.map(i => i.id), [inventory]);
  const { fallbackRef, registerTarget, removeThenFocus } =
    useFocusAfterRemove(itemIds);

  const { items: dbItems, loading: dbItemsLoading } = useItemsData();
  const { items: dbMagicItems } = useMagicItemsData();

  const handleInventoryFormSubmit = (data: InventoryFormData) => {
    if (!onUpdateInventory) return;
    if (inventoryFormEditingItem) {
      const updated = inventory.map(i =>
        i.id === inventoryFormEditingItem.id
          ? formDataToNpcInventoryPatch(data, i)
          : i
      );
      onUpdateInventory(npc.id, updated);
    } else {
      const newItem: NPCInventoryItem = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: data.name,
        quantity: data.quantity,
        category: data.category,
        weight: data.weight,
        value: data.value,
        rarity: data.rarity,
        description: data.description || undefined,
        type: data.type,
      };
      onUpdateInventory(npc.id, [...inventory, newItem]);
    }
    setInventoryFormOpen(false);
    setInventoryFormEditingItem(null);
  };

  const handleRemoveItem = async (item: NPCInventoryItem) => {
    if (!onUpdateInventory) return;
    const confirmed = await confirmDialog({
      title: `Remove ${item.name}?`,
      message: `${npc.name} no longer carries it.`,
      confirmLabel: 'Remove item',
      tone: 'danger',
    });
    if (!confirmed) return;
    removeThenFocus(item.id, itemIds, () =>
      onUpdateInventory(
        npc.id,
        inventory.filter(i => i.id !== item.id)
      )
    );
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    if (!onUpdateInventory) return;
    const updated = inventory.map(i =>
      i.id === itemId ? { ...i, quantity } : i
    );
    onUpdateInventory(npc.id, updated);
  };

  const setCurrency = (type: keyof Currency, amount: number) => {
    const currency = { ...EMPTY_CURRENCY, ...npc.currency };
    useNPCStore.getState().updateNPC(npc.campaignCode, npc.id, {
      currency: {
        ...currency,
        [type]: amount,
      },
    });
  };

  const openAddForm = () => {
    setInventoryFormEditingItem(null);
    setInventoryFormOpen(true);
  };

  const openEditForm = (item: NPCInventoryItem) => {
    setInventoryFormEditingItem(item);
    setInventoryFormOpen(true);
  };

  // The empty state carries the one "Add item" while there are no entries.
  const addButton =
    onUpdateInventory && inventory.length > 0 ? (
      <Button size="sm" onClick={openAddForm}>
        Add item
      </Button>
    ) : undefined;

  return (
    <>
      <div className="space-y-4">
        <NPCCurrencyStrip
          currency={{ ...EMPTY_CURRENCY, ...npc.currency }}
          readonly={readOnly}
          onChange={readOnly ? undefined : setCurrency}
        />
        <Section level={3} heading="Items" trailing={addButton}>
          {inventory.length > 0 ? (
            <ul className="divide-divider divide-y">
              {inventory.map(item => (
                <NpcInventoryRow
                  key={item.id}
                  item={item}
                  nameRef={registerTarget(item.id)}
                  onView={() => setViewingItem(item)}
                  onEdit={
                    onUpdateInventory ? () => openEditForm(item) : undefined
                  }
                  onRemove={
                    onUpdateInventory
                      ? () => void handleRemoveItem(item)
                      : undefined
                  }
                  onQuantityChange={
                    onUpdateInventory
                      ? qty => handleQuantityChange(item.id, qty)
                      : undefined
                  }
                  onSend={
                    onSendItemToPlayer
                      ? () => onSendItemToPlayer(item, npc.name)
                      : undefined
                  }
                />
              ))}
            </ul>
          ) : (
            <div className="py-12 text-center">
              <p className="type-subheading text-heading">
                {npc.name} carries nothing yet
              </p>
              {onUpdateInventory && (
                <Button
                  ref={fallbackRef}
                  className="mt-4"
                  onClick={openAddForm}
                >
                  Add item
                </Button>
              )}
            </div>
          )}
        </Section>
      </div>

      <NpcItemViewDialog
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        onEdit={
          onUpdateInventory && viewingItem
            ? () => {
                setViewingItem(null);
                openEditForm(viewingItem);
              }
            : undefined
        }
      />

      <ItemForm
        isOpen={inventoryFormOpen}
        onClose={() => {
          setInventoryFormOpen(false);
          setInventoryFormEditingItem(null);
        }}
        onSubmit={handleInventoryFormSubmit}
        initialData={
          inventoryFormEditingItem
            ? npcInventoryItemToFormData(inventoryFormEditingItem)
            : initialInventoryFormData
        }
        availableLocations={[]}
        isEditing={!!inventoryFormEditingItem}
        databaseItems={dbItems}
        databaseMagicItems={dbMagicItems}
        itemsLoading={dbItemsLoading}
      />
    </>
  );
}
