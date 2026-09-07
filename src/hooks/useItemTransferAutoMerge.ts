import { useEffect, useRef } from 'react';

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
  /** Forgets a transfer id once its specific acknowledge has actually
   * succeeded — it can never reappear in the live queue, so there's no
   * reason left to keep it in the dedup ledger. */
  clearAppliedTransfer: (transferId: string) => void;
  addInventoryItem: (
    item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  addMagicItem: (
    item: Omit<MagicItem, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  /** Acknowledges a batch of transfer ids in ONE request, clearing them
   * from the server-side queue. Must be called with the whole batch at
   * once, never per-id in a loop — the route does a non-atomic
   * read-filter-write, so concurrent per-id calls race and silently lose
   * all but the last writer's removal. Resolves `true` iff the server
   * actually confirmed it (checked against the HTTP status, not just
   * "didn't throw") — used to decide whether `clearAppliedTransfer` is
   * safe to call for each id. May resolve `false` (network/HTTP failure)
   * or never settle in time (tab closed) — the dedup ledger, not this
   * call, is what prevents re-application on the next mount. */
  acknowledgeTransfers: (transferIds: string[]) => Promise<boolean>;
  /** Purse snapshot from the render that scheduled this effect. A purchase
   * debit is applied against this snapshot (and any earlier debit already
   * applied within the same pass — see the running-purse note below), never
   * against a stale closure from a previous render. */
  currency: Currency;
  /** Persists the post-debit purse. Merges a `Partial<Currency>`, so this
   * hook always passes the whole purse `spendCopper` returns rather than a
   * delta — see the note on `spendCopper`'s coin-preserving contract. */
  updateCurrency: (updates: Partial<Currency>) => void;
  /** Called when a transfer's committed cost exceeds what the purse holds
   * (see the insufficient-purse branch below) — the caller's hook into
   * surfacing this to the player, since a `console.error` alone reaches no
   * one: the item still appears and the purse still empties, and without
   * this callback nothing in the UI ever explains why. */
  onInsufficientFunds?: (info: {
    transferId: string;
    costCopper: number;
    heldCopper: number;
    shortfallCopper: number;
  }) => void;
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
  clearAppliedTransfer,
  addInventoryItem,
  addMagicItem,
  acknowledgeTransfers,
  currency,
  updateCurrency,
  onInsufficientFunds,
}: UseItemTransferAutoMergeOptions): void {
  // React StrictMode double-invokes a mount effect (run, cleanup, run again)
  // synchronously, with NO re-render — and therefore no fresh
  // `appliedTransferIds` prop — between the two runs. Without this, the
  // second run would rebuild `seen` from the same stale prop, miss the id
  // `recordAppliedTransfer` just wrote (a store update, but not yet
  // reflected in this closure's prop), and re-apply the transfer. This ref
  // is a same-mount latch only: it survives the double-invoke (refs aren't
  // reset by it) but resets on a genuine remount, where `appliedTransferIds`
  // itself (now correctly persisted) is what prevents re-application.
  const appliedThisMountRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pending = transfers ?? [];
    if (pending.length === 0) return;

    // Snapshot plus the StrictMode/within-run guard described above.
    const seen = new Set(appliedTransferIds);
    for (const id of appliedThisMountRef.current) seen.add(id);

    // Every transfer still in `pending` gets an acknowledge attempt this
    // pass — including one already recorded as applied (its OWN prior
    // acknowledge may have failed and left it stuck in the live queue). Only
    // a transfer newly applied this pass needs the item/currency work first.
    const toAcknowledge: string[] = [];

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
      if (seen.has(transfer.id)) {
        // Already applied (this mount or a prior one) — nothing left to add
        // or charge, but still worth an acknowledge retry.
        toAcknowledge.push(transfer.id);
        continue;
      }
      seen.add(transfer.id);

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
      }

      // Only record AFTER the item is actually applied above: a throw from
      // addInventoryItem/addMagicItem would otherwise leave this id marked
      // "applied" in the persisted ledger with no item to show for it,
      // permanently losing it instead of recovering on the next reload.
      //
      // Deliberate fail-open direction: the item add (above) and the
      // currency write (below, hoisted out of this loop so a batch debits
      // at most once) are two separate store `set` calls, so a throw from a
      // *later* transfer's item-add aborts before `updateCurrency` runs —
      // every item already applied earlier in this pass is free, never
      // double-charged — and a crash between the two calls persists the
      // item without its debit rather than the reverse. Both failure modes
      // favor "free item" over "double charge" on purpose. Do not
      // restructure this into a single atomic write to close that gap.
      appliedThisMountRef.current.add(transfer.id);
      recordAppliedTransfer(transfer.id);
      toAcknowledge.push(transfer.id);

      // `costCopper` is absent, 0, or non-integer for gifts/loot and for
      // every transfer in a multi-unit purchase after the first — treat all
      // of those as an explicit no-op rather than round-tripping through
      // `spendCopper`, which would otherwise re-denominate a purse it has no
      // reason to touch. The non-integer guard is defence in depth: this
      // value is server-authored today, but nothing here re-validates it,
      // and `spendCopper`'s break loop cannot converge on a fractional
      // amount — without the guard that would return `null` and drain the
      // purse to zero for what should have been a no-op.
      const cost = transfer.costCopper ?? 0;
      if (!Number.isInteger(cost) || cost <= 0) continue;

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
      // `console.error` reaches no one in production — there's no error
      // monitoring sink wired to it in this repo, and the player's only
      // observable experience otherwise would be an item appearing and
      // every coin they own silently vanishing. Surface it to the caller so
      // it can render something the player actually sees.
      onInsufficientFunds?.({
        transferId: transfer.id,
        costCopper: cost,
        heldCopper: held,
        shortfallCopper: cost - held,
      });
      purse = drained;
      purseChanged = true;
    }

    if (purseChanged) {
      updateCurrency(purse);
    }

    // ONE batched acknowledge for every id confirmed this pass — not a
    // blanket whole-queue DELETE (which would destroy a transfer enqueued
    // between the last poll and now that hasn't been applied yet), and
    // NOT N separate per-id requests either: the route does a non-atomic
    // read-filter-write, so concurrent per-id DELETEs race each other and
    // the last writer silently undoes every other request's removal — a
    // 25-unit purchase would issue 25 concurrent acks, ~24 of which are
    // lost, and this hook would still (wrongly) forget those ids from the
    // ledger because each one individually reported success. Fire-and-
    // forget — forgetting ledger entries is a bonus if this lands, not a
    // requirement for correctness (the ledger only needs to outlive the
    // in-flight window, and the cap bounds it regardless).
    if (toAcknowledge.length > 0) {
      void acknowledgeTransfers(toAcknowledge).then(ok => {
        if (ok) {
          for (const id of toAcknowledge) clearAppliedTransfer(id);
        }
      });
    }
  }, [
    transfers,
    appliedTransferIds,
    recordAppliedTransfer,
    clearAppliedTransfer,
    addInventoryItem,
    addMagicItem,
    acknowledgeTransfers,
    currency,
    updateCurrency,
    onInsufficientFunds,
  ]);
}
