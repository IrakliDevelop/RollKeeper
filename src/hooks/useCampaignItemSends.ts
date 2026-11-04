import { useCallback, useMemo, useState } from 'react';

import type { SendItemTarget } from '@/components/ui/campaign/SendItemDialog';
import type { ToastData } from '@/components/ui/feedback/Toast';
import type { CampaignPlayerData } from '@/types/campaign';
import type { InventoryItem, MagicItem } from '@/types/character';
import type { NPCInventoryItem } from '@/types/encounter';
import type { ItemTransfer } from '@/types/sharedState';

export type AddCampaignToast = (toast: Omit<ToastData, 'id'>) => void;

export interface UseCampaignItemSendsOptions {
  code: string;
  dmId: string;
  players: CampaignPlayerData[];
  addToast: AddCampaignToast;
}

export interface CampaignItemSends {
  sendTargets: SendItemTarget[];
  openNpcItemSend: (item: NPCInventoryItem, npcName: string) => void;
  giveLibraryMagicItem: (
    item: MagicItem,
    target: SendItemTarget
  ) => Promise<void>;
  sendItemDialog: {
    open: boolean;
    onClose: () => void;
    item: InventoryItem | null;
    targets: SendItemTarget[];
    onSend: (item: InventoryItem, target: SendItemTarget) => Promise<void>;
    sending: boolean;
  };
}

function npcItemToInventoryItem(npcItem: NPCInventoryItem): InventoryItem {
  return {
    id: npcItem.id,
    name: npcItem.name,
    quantity: npcItem.quantity,
    category: npcItem.category || 'misc',
    description: npcItem.description,
    weight: npcItem.weight,
    value: npcItem.value,
    rarity: npcItem.rarity as InventoryItem['rarity'],
    type: npcItem.type as InventoryItem['type'],
    location: 'Backpack',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** The DM campaign page's item sends: NPC inventory items through the send
 * dialog, and library magic items straight to a player. */
export function useCampaignItemSends({
  code,
  dmId,
  players,
  addToast,
}: UseCampaignItemSendsOptions): CampaignItemSends {
  const [npcSendingItem, setNpcSendingItem] = useState<NPCInventoryItem | null>(
    null
  );
  const [npcSendingNpcName, setNpcSendingNpcName] = useState<string | null>(
    null
  );
  const [npcSendDialogOpen, setNpcSendDialogOpen] = useState(false);
  const [isNpcSendingItem, setIsNpcSendingItem] = useState(false);

  const sendTargets: SendItemTarget[] = useMemo(
    () =>
      players.map(p => ({
        playerId: p.playerId,
        playerName: p.playerName,
        characterName: p.characterName,
        characterId: p.characterId,
      })),
    [players]
  );

  const openNpcItemSend = useCallback(
    (item: NPCInventoryItem, npcName: string) => {
      setNpcSendingItem(item);
      setNpcSendingNpcName(npcName);
      setNpcSendDialogOpen(true);
    },
    []
  );

  const closeNpcItemSend = useCallback(() => {
    setNpcSendDialogOpen(false);
    setNpcSendingItem(null);
    setNpcSendingNpcName(null);
  }, []);

  const pendingInventoryItem = useMemo(
    () => (npcSendingItem ? npcItemToInventoryItem(npcSendingItem) : null),
    [npcSendingItem]
  );

  const handleNpcSendItem = useCallback(
    async (item: InventoryItem, target: SendItemTarget) => {
      setIsNpcSendingItem(true);
      try {
        const transfer: ItemTransfer = {
          id: `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          item,
          fromPlayerName: 'DM',
          fromCharacterName: npcSendingNpcName ?? 'NPC',
          fromType: 'npc',
          sentAt: new Date().toISOString(),
        };

        const res = await fetch(`/api/campaign/${code}/shared`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feature: 'item_transfer',
            data: { transfer, playerId: target.playerId },
            dmId,
          }),
        });

        if (!res.ok) throw new Error('Failed to send item');

        addToast({
          type: 'success',
          title: 'Item Sent',
          message: `${item.name} sent to ${target.characterName}`,
        });
      } catch (err) {
        console.error('Failed to send item:', err);
        addToast({
          type: 'error',
          title: 'Failed',
          message: 'Could not send item',
        });
      } finally {
        setIsNpcSendingItem(false);
      }
    },
    [code, dmId, npcSendingNpcName, addToast]
  );

  const giveLibraryMagicItem = useCallback(
    async (item: MagicItem, target: SendItemTarget) => {
      const transfer: ItemTransfer = {
        id: `transfer-${crypto.randomUUID()}`,
        item,
        itemKind: 'magic',
        fromPlayerName: 'DM',
        fromCharacterName: 'Magic Item Library',
        fromType: 'dm',
        sentAt: new Date().toISOString(),
      };
      try {
        const response = await fetch(`/api/campaign/${code}/shared`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feature: 'item_transfer',
            data: { transfer, playerId: target.playerId },
            dmId,
          }),
        });
        if (!response.ok) throw new Error('Failed to give magic item');
        addToast({
          type: 'success',
          title: 'Magic Item Given',
          message: `${item.name} sent to ${target.characterName}. The library copy was kept.`,
        });
      } catch (error) {
        console.error('Failed to give magic item:', error);
        addToast({
          type: 'error',
          title: 'Magic Item Not Sent',
          message: `Could not send ${item.name} to ${target.characterName}.`,
        });
      }
    },
    [addToast, code, dmId]
  );

  return {
    sendTargets,
    openNpcItemSend,
    giveLibraryMagicItem,
    sendItemDialog: {
      open: npcSendDialogOpen,
      onClose: closeNpcItemSend,
      item: pendingInventoryItem,
      targets: sendTargets,
      onSend: handleNpcSendItem,
      sending: isNpcSendingItem,
    },
  };
}
