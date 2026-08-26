import type { MagicItemCategory, MagicItemRarity } from '@/types/character';
import type { NPCInventoryItem } from '@/types/encounter';
import type { InventoryFormData } from '@/components/ui/game/inventory/ItemForm';

/** Map stored NPC inventory row → ItemForm fields (player inventory editor). */
export function npcInventoryItemToFormData(
  item: NPCInventoryItem
): InventoryFormData {
  const rarity =
    item.rarity && item.rarity !== 'none'
      ? (item.rarity as MagicItemRarity)
      : undefined;
  const type = item.type ? (item.type as MagicItemCategory) : undefined;

  return {
    name: item.name,
    category: item.category || 'misc',
    location: 'Backpack',
    rarity,
    type,
    quantity: Math.max(1, item.quantity),
    weight: item.weight,
    value: item.value,
    description: item.description ?? '',
    tags: [],
  };
}

/** Apply ItemForm submit payload onto an existing NPC item (preserves id & equipped). */
export function formDataToNpcInventoryPatch(
  data: InventoryFormData,
  existing: NPCInventoryItem
): NPCInventoryItem {
  return {
    ...existing,
    name: data.name,
    quantity: Math.max(1, data.quantity),
    category: data.category,
    weight: data.weight,
    value: data.value,
    rarity: data.rarity,
    description: data.description || undefined,
    type: data.type,
  };
}
