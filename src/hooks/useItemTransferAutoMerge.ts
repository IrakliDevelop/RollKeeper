import { useEffect } from 'react';

import type { ItemTransfer } from '@/types/sharedState';
import type { InventoryItem, MagicItem } from '@/types/character';

interface UseItemTransferAutoMergeOptions {
  /** Transfers queued for this character in shared campaign state. */
  transfers: ItemTransfer[] | undefined;
  /**
   * Ids of transfers already merged into inventory, persisted on
   * `characterStore` — replaces a `useRef<Set<string>>`, which is reset on
   * every component mount and therefore re-applies every transfer still in
   * the queue if `acknowledgeTransfers()` never lands (fetch failure, tab
   * closed before it resolves).
   */
  appliedTransferIds: string[];
  /** Persists a transfer id as applied. Idempotent. */
  recordAppliedTransfer: (transferId: string) => void;
  addInventoryItem: (
    item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  addMagicItem: (
    item: Omit<MagicItem, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  /** Fire-and-forget: clears the server-side queue. May fail (network) or
   * never run (tab closed) — the dedup ledger, not this call, is what
   * prevents re-application on the next mount. */
  acknowledgeTransfers: () => Promise<void>;
}

/**
 * Auto-merges incoming item transfers (DM/player sends) into inventory,
 * exactly once per transfer id — ported out of
 * `src/app/player/characters/[characterId]/page.tsx` so the dedup fix is
 * unit-testable without rendering the whole sheet page.
 */
export function useItemTransferAutoMerge({
  transfers,
  appliedTransferIds,
  recordAppliedTransfer,
  addInventoryItem,
  addMagicItem,
  acknowledgeTransfers,
}: UseItemTransferAutoMergeOptions): void {
  useEffect(() => {
    const pending = transfers ?? [];
    if (pending.length === 0) return;

    // Snapshot plus a within-run guard: `appliedTransferIds` is the value
    // from the render that scheduled this effect, so a duplicate id inside
    // the same `pending` batch (should not happen, but the queue is
    // server-controlled) would otherwise slip past a `.includes` check
    // against a snapshot that never changes mid-loop.
    const seen = new Set(appliedTransferIds);
    let added = false;
    for (const transfer of pending) {
      if (seen.has(transfer.id)) continue;
      seen.add(transfer.id);
      recordAppliedTransfer(transfer.id);

      if (transfer.itemKind === 'magic') {
        const {
          id: _id,
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          ...item
        } = transfer.item as MagicItem;
        void _id;
        void _createdAt;
        void _updatedAt;
        addMagicItem({ ...item, isAttuned: false, isEquipped: false });
        added = true;
        continue;
      }

      const inventoryItem = transfer.item as InventoryItem;
      addInventoryItem({
        name: inventoryItem.name,
        category: inventoryItem.category || 'misc',
        quantity: inventoryItem.quantity,
        description: inventoryItem.description,
        weight: inventoryItem.weight,
        value: inventoryItem.value,
        rarity: inventoryItem.rarity,
        type: inventoryItem.type,
        location: inventoryItem.location || 'Backpack',
        tags: inventoryItem.tags || [],
      });
      added = true;
    }

    if (added) {
      acknowledgeTransfers();
    }
  }, [
    transfers,
    appliedTransferIds,
    recordAppliedTransfer,
    addInventoryItem,
    addMagicItem,
    acknowledgeTransfers,
  ]);
}
