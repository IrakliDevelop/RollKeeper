import type { InventoryItem, MagicItem } from '@/types/character';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';
import type { MarkerLootEntry } from '@/types/battlemap';
import type { ItemTransfer } from '@/types/sharedState';

export type MarkerLootRecipient =
  | { kind: 'player'; playerId: string }
  | { kind: 'npc'; npcId: string };

export async function deliverMarkerLoot(input: {
  campaignCode: string;
  dmId: string;
  entry: MarkerLootEntry;
  recipient: MarkerLootRecipient;
  fetcher?: typeof fetch;
  findNpc: (id: string) => CampaignNPC | undefined;
  updateNpc: (id: string, inventory: NPCInventoryItem[]) => void;
}): Promise<void> {
  if (input.entry.claimedQuantity >= input.entry.quantity) {
    throw new Error('This loot entry is depleted.');
  }

  if (input.recipient.kind === 'npc') {
    const npc = input.findNpc(input.recipient.npcId);
    if (!npc) throw new Error('The selected NPC no longer exists.');
    const item: NPCInventoryItem = {
      id: `npc-item-${crypto.randomUUID()}`,
      name: input.entry.item.name,
      quantity: 1,
      description: input.entry.item.description,
      category:
        input.entry.itemKind === 'magic'
          ? 'magic item'
          : input.entry.item.category,
      rarity: input.entry.item.rarity,
      ...(input.entry.itemKind === 'magic'
        ? { magicItem: structuredClone(input.entry.item as MagicItem) }
        : {}),
    };
    input.updateNpc(npc.id, [...(npc.inventory ?? []), item]);
    return;
  }

  const transferable = structuredClone(input.entry.item);
  if (input.entry.itemKind === 'inventory') {
    (transferable as InventoryItem).quantity = 1;
  }
  const transfer: ItemTransfer = {
    id: `transfer-${crypto.randomUUID()}`,
    item: transferable,
    itemKind: input.entry.itemKind,
    fromPlayerName: 'DM',
    fromCharacterName: 'Map loot',
    fromType: 'dm',
    sentAt: new Date().toISOString(),
  };
  const response = await (input.fetcher ?? fetch)(
    `/api/campaign/${input.campaignCode}/shared`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feature: 'item_transfer',
        data: { transfer, playerId: input.recipient.playerId },
        dmId: input.dmId,
      }),
    }
  );
  if (!response.ok) throw new Error('Could not give the item to that player.');
}
