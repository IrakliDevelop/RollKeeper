import { useEffect } from 'react';

import type { ItemTransfer } from '@/types/sharedState';
import type { Currency, InventoryItem, MagicItem } from '@/types/character';
import { purseToCopper, spendCopper } from '@/utils/currency';

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
  /** Purse snapshot from the render that scheduled this effect. A purchase
   * debit is applied against this snapshot (and any earlier debit already
   * applied within the same pass — see the running-purse note below), never
   * against a stale closure from a previous render. */
  currency: Currency;
  /** Persists the post-debit purse. Merges a `Partial<Currency>`, so this
   * hook always passes the whole purse `spendCopper` returns rather than a
   * delta — see the note on `spendCopper`'s coin-preserving contract. */
  updateCurrency: (updates: Partial<Currency>) => void;
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
  currency,
  updateCurrency,
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

    // Running purse across the whole batch: `currency` is a single snapshot
    // from the render that scheduled this effect, and `updateCurrency` won't
    // be reflected in it until the next render. A magic-item purchase of N
    // units enqueues N transfers with the server placing the full cost on
    // the first and 0 on the rest, so in practice only one transfer per
    // batch ever debits — but two independent purchases landing in the same
    // poll would each carry their own `costCopper`, and the second debit
    // must be computed against the purse *after* the first, not against the
    // stale `currency` snapshot both would otherwise see.
    let purse = currency;
    let purseChanged = false;

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
      } else {
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

      // `costCopper` is absent or 0 for gifts/loot and for every transfer
      // in a multi-unit purchase after the first — treat that as an
      // explicit no-op rather than round-tripping through `spendCopper`,
      // which would otherwise re-denominate a purse it has no reason to
      // touch.
      const cost = transfer.costCopper ?? 0;
      if (cost <= 0) continue;

      const spent = spendCopper(purse, cost);
      if (spent) {
        purse = spent;
        purseChanged = true;
        continue;
      }

      // The server already decremented stock, enqueued this transfer, and
      // wrote the receipt before we ever saw it — the sale is committed on
      // the server side. This should be near-unreachable (the purchase
      // dialog checks affordability pre-flight and the server owns the
      // price), but "near-unreachable" isn't "impossible": coin could have
      // been spent from another tab between that pre-flight check and this
      // transfer draining. Refusing the item here would contradict a sale
      // the server has already completed; refusing the debit would hand out
      // a free item with no trace. So: keep the item (already applied
      // above), pay what the purse can actually bear by draining it to
      // zero, and log loudly so the shortfall is never silent.
      const held = purseToCopper(purse);
      const drained: Currency = {
        copper: 0,
        silver: 0,
        electrum: 0,
        gold: 0,
        platinum: 0,
      };
      console.error(
        `[useItemTransferAutoMerge] Insufficient purse for transfer ${transfer.id}: ` +
          `needed ${cost}cp, purse held ${held}cp (shortfall ${cost - held}cp). ` +
          'The server already committed this sale, so the item is kept; ' +
          'draining the purse to 0cp rather than granting it for free.'
      );
      purse = drained;
      purseChanged = true;
    }

    if (purseChanged) {
      updateCurrency(purse);
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
    currency,
    updateCurrency,
  ]);
}
