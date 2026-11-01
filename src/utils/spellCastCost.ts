import type { InventoryItem, Spell } from '@/types/character';

/** Alert title for a cast refused because its linked inventory cost can't be paid. */
export function castCostAlertTitle(
  spell: Pick<Spell, 'name' | 'inventoryCost'>,
  inventoryItems: Pick<InventoryItem, 'id' | 'name'>[]
): string {
  const item = inventoryItems.find(
    candidate => candidate.id === spell.inventoryCost?.inventoryItemId
  );
  return item
    ? `Not enough ${item.name} to cast ${spell.name}`
    : `${spell.name}'s linked item is no longer in your inventory`;
}
