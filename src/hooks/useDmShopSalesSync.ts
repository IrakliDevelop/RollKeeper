import { useCallback, useEffect, useRef, useState } from 'react';

import { isValidShopSale } from '@/lib/shopPurchases';
import { useNPCStore } from '@/store/npcStore';
import type { Currency } from '@/types/character';
import type { ShopSale, ShopSaleLogEntry } from '@/types/shop';
import { creditCopper } from '@/utils/currency';

const DEFAULT_POLL_INTERVAL_MS = 10000;

const ZERO_PURSE: Currency = {
  copper: 0,
  silver: 0,
  electrum: 0,
  gold: 0,
  platinum: 0,
};

export interface UseDmShopSalesSyncOptions {
  campaignCode: string | null | undefined;
  dmId: string | null | undefined;
  /** Merchant NPC ids to drain each poll (typically every NPC that has ever
   *  had a `shop` configured — a sale can still be un-drained after the DM
   *  closes the shop, so this isn't limited to currently-open shops). */
  npcIds: string[];
  /** Default `true`. Pass `false` to pause polling without unmounting. */
  enabled?: boolean;
  pollIntervalMs?: number;
}

export interface UseDmShopSalesSyncResult {
  lastDrainedAt: Date | null;
  error: string | null;
  /** Drains every configured NPC's sales log once, immediately. The poll
   *  loop calls this itself on `pollIntervalMs`; exposed for an explicit
   *  "sync now" affordance and for tests. */
  drainNow: () => Promise<void>;
}

/** Builds the `ShopSaleLogEntry` for one drained sale — shared by every
 *  branch of `applySaleToNpc` so the DM Shop tab's sales log (Task 13b)
 *  always gets an entry, reconciled or not, whenever a sale is applied. */
function toSaleLogEntry(
  sale: ShopSale,
  itemName: string,
  reconciled: boolean
): ShopSaleLogEntry {
  return {
    id: sale.id,
    entryId: sale.entryId,
    itemName,
    quantity: sale.quantity,
    copper: sale.copper,
    playerId: sale.playerId,
    at: sale.at,
    reconciled,
  };
}

/** Shown as the sales-log row's item name when the row a sale refers to can
 *  no longer be identified (its `NPCInventoryItem` — or the whole NPC — was
 *  deleted before this drain ran). See `applySaleToNpc`'s doc comment. */
const UNRECONCILED_ITEM_NAME = 'Unknown item';

/**
 * Applies one already-validated sale to an NPC: credits `npc.currency` by
 * `sale.copper` and decrements the matching `NPCInventoryItem.quantity` by
 * `sale.quantity`. Always also appends a `ShopSaleLogEntry` via
 * `recordShopSale` (VTT merchants Slice 3, Task 13b) so the DM's Shop tab
 * has something to render — never only the bare id ledger.
 *
 * Spec edge case (a sale is a fact, not something to drop): if the DM
 * deleted the inventory row this sale refers to — or the NPC itself — while
 * the shop was open, the coin credit is still attempted. The currency
 * credit is computed and applied FIRST and unconditionally (whenever the
 * NPC itself still exists); only the inventory decrement is skipped when its
 * row can't be found, with a warning logged AND a `reconciled: false` log
 * entry recorded — the spec requires this surface in the sales log rather
 * than drop the sale silently, not just console-warn where only a developer
 * would ever see it. If the NPC record itself is gone there is no purse left
 * to credit into — `updateNPC` is a no-op for a missing id — but the sale is
 * still logged (against `npcId`, even though no `CampaignNPC` document
 * exists to render it against — harmless, and correct if the id is ever
 * reused) rather than vanishing without a trace, and the caller still
 * records it as applied so a permanently-deleted NPC doesn't cause the same
 * sale to be retried, and warned about, forever.
 */
function applySaleToNpc(
  campaignCode: string,
  npcId: string,
  sale: ShopSale
): void {
  const { getNPC, updateNPC, recordShopSale } = useNPCStore.getState();
  const npc = getNPC(campaignCode, npcId);
  if (!npc) {
    console.warn(
      `[useDmShopSalesSync] sale ${sale.id} would credit ${sale.copper} copper to NPC ${npcId}, but that NPC no longer exists. The coin credit could not be applied anywhere; this sale's stock is unreconciled.`
    );
    recordShopSale(npcId, toSaleLogEntry(sale, UNRECONCILED_ITEM_NAME, false));
    return;
  }

  const nextCurrency = creditCopper(npc.currency ?? ZERO_PURSE, sale.copper);
  // Migration-wipe hazard guard: an NPC with no inventory at all is a valid,
  // common state (not every NPC is a merchant), never an error.
  const inventory = npc.inventory ?? [];
  const itemIndex = inventory.findIndex(item => item.id === sale.entryId);

  if (itemIndex === -1) {
    console.warn(
      `[useDmShopSalesSync] sale ${sale.id} for NPC ${npcId} references inventory row ${sale.entryId}, which no longer exists. Crediting ${sale.copper} copper regardless; this sale's stock is unreconciled.`
    );
    updateNPC(campaignCode, npcId, { currency: nextCurrency });
    recordShopSale(npcId, toSaleLogEntry(sale, UNRECONCILED_ITEM_NAME, false));
    return;
  }

  const soldItem = inventory[itemIndex];
  const nextInventory = inventory.map((item, index) =>
    index === itemIndex
      ? { ...item, quantity: Math.max(0, item.quantity - sale.quantity) }
      : item
  );
  updateNPC(campaignCode, npcId, {
    currency: nextCurrency,
    inventory: nextInventory,
  });
  recordShopSale(npcId, toSaleLogEntry(sale, soldItem.name, true));
}

/**
 * Acknowledges every sale in `saleIds` for one NPC in a SINGLE batch
 * request (Task 12a) — never one `DELETE` per sale. The server route does a
 * non-atomic read-filter-write, exactly like `shared/route.ts`'s batch
 * transfer ack; N concurrent single-id calls would each write "log minus MY
 * id" against the same starting snapshot and the last writer would silently
 * resurrect every other call's id, so every id applied on this drain (or
 * still pending acknowledgement from a previous one — see the caller) is
 * sent together.
 *
 * Deliberately swallows both a rejected fetch AND a non-ok HTTP status
 * (`fetch` only throws on network failure — a 403/500 otherwise looks like
 * success) rather than propagating either to `drainNow`'s caller: a failed
 * ack is harmless by construction, because it runs strictly AFTER the sale
 * was already applied and recorded in `appliedShopSaleIds` — the ledger
 * already guarantees the next drain won't double-apply these sales, so all
 * a failed ack costs is a redundant re-fetch-and-re-filter of rows the
 * server still holds. Surfacing it as a `drainNow` error would incorrectly
 * suggest a sale failed to apply, when every sale here already succeeded.
 */
async function acknowledgeAppliedSales(
  campaignCode: string,
  dmId: string,
  npcId: string,
  saleIds: string[]
): Promise<void> {
  try {
    const res = await fetch(
      `/api/campaign/${encodeURIComponent(campaignCode)}/shops/${encodeURIComponent(npcId)}/sales`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dmId, saleIds }),
      }
    );
    if (!res.ok) {
      console.warn(
        `[useDmShopSalesSync] failed to acknowledge ${saleIds.length} sale(s) for NPC ${npcId} (status ${res.status}); they remain in the server log and will be retried next drain`
      );
    }
  } catch (err) {
    console.warn(
      `[useDmShopSalesSync] failed to acknowledge sales for NPC ${npcId}; will retry next drain`,
      err
    );
  }
}

/**
 * Drains one NPC's `campaign:{code}:shop-sales:{npcId}` log: fetches it,
 * applies every sale not already recorded in this NPC's `appliedShopSaleIds`
 * ledger (idempotent on `ShopSale.id` — see `npcStore.ts`'s doc comment on
 * that field for why it's persisted the same way as `characterStore`'s
 * `appliedTransferIds`), and then — Task 12a — acknowledges every sale seen
 * this drain that has been applied, so the server-side log stays short in
 * normal operation instead of relying on `PURCHASE_SCRIPT`'s 500-entry FIFO
 * cap never being reached.
 *
 * Order is apply -> record in the ledger -> acknowledge, deliberately never
 * the other way around: acknowledging BEFORE recording would let a crash
 * between the two lose a sale entirely (the server has already forgotten
 * it, but the ledger never learned it happened, so `npc.currency`/
 * `NPCInventoryItem.quantity` never get credited/decremented and nothing
 * ever retries it). With acknowledge last, the same crash just leaves the
 * sale un-acknowledged — the next drain re-fetches it, sees it's already in
 * `appliedShopSaleIds`, skips re-applying it, and re-attempts the ack. A
 * sale already in `appliedShopSaleIds` when this drain starts (an
 * apply from a previous drain whose ack failed or never ran) is therefore
 * skipped for re-application but still added to `idsToAck` — otherwise a
 * merchant whose DM ack keeps failing would never shrink its log, exactly
 * the unbounded-growth failure mode this task exists to close.
 *
 * A malformed row is skipped (logged, not applied, not recorded as applied,
 * and not acknowledged) rather than aborting the rest of the batch — the
 * same row-level resilience `parseStoredShopSales` already gives the
 * server-side parse, applied again here as defense in depth against
 * whatever the fetch actually hands back.
 */
async function drainNpcSales(
  campaignCode: string,
  dmId: string,
  npcId: string
): Promise<void> {
  const res = await fetch(
    `/api/campaign/${encodeURIComponent(campaignCode)}/shops/${encodeURIComponent(npcId)}/sales?dmId=${encodeURIComponent(dmId)}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch shop sales (${res.status})`);
  }
  const body = (await res.json().catch(() => null)) as {
    sales?: unknown;
  } | null;
  const sales = body?.sales;
  if (!Array.isArray(sales)) return;

  // `?? []` migration-wipe hazard guard: this NPC may never have had a
  // drained sale before, in which case the ledger has no entry for it yet.
  const appliedIds = new Set(
    useNPCStore.getState().appliedShopSaleIds[npcId] ?? []
  );
  const idsToAck: string[] = [];

  for (const candidate of sales) {
    if (!isValidShopSale(candidate)) {
      console.warn(
        '[useDmShopSalesSync] skipping a malformed sale row',
        candidate
      );
      continue;
    }
    if (appliedIds.has(candidate.id)) {
      // Already applied (this drain or an earlier one) but still present in
      // the server log — a previous ack for it must have failed or never
      // ran. Re-attempt the ack; never re-apply.
      idsToAck.push(candidate.id);
      continue;
    }
    applySaleToNpc(campaignCode, npcId, candidate);
    useNPCStore.getState().recordAppliedShopSale(npcId, candidate.id);
    appliedIds.add(candidate.id);
    idsToAck.push(candidate.id);
  }

  if (idsToAck.length > 0) {
    await acknowledgeAppliedSales(campaignCode, dmId, npcId, idsToAck);
  }
}

/**
 * Drains every merchant NPC's shop-sales queue on an interval, crediting
 * `npc.currency` and decrementing matching `NPCInventoryItem.quantity` for
 * each sale a player made — the DM-side half of the shop's "server records,
 * DM client follows" design (VTT merchants Slice 3, Task 12).
 *
 * The shop works with the DM's tab closed: `PURCHASE_SCRIPT`
 * (`shopPurchases.ts`) is the sole authority for a purchase, and this hook
 * only ever catches its queue up — a purchase never depends on this hook
 * running, and sales simply accumulate in Redis (up to
 * `MAX_SALES_LOG_ENTRIES`) until the DM reconnects and this hook's first
 * poll drains all of them at once.
 */
export function useDmShopSalesSync({
  campaignCode,
  dmId,
  npcIds,
  enabled = true,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseDmShopSalesSyncOptions): UseDmShopSalesSyncResult {
  const [lastDrainedAt, setLastDrainedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  // Keeps the interval closure (set up once per campaign/dm) reading the
  // LATEST npcIds without restarting the timer on every render where the
  // caller passes a fresh array literal — same idiom as
  // `useSharedCampaignState`'s `startPollingRef`.
  const npcIdsRef = useRef(npcIds);
  npcIdsRef.current = npcIds;

  const drainNow = useCallback(async () => {
    if (!campaignCode || !dmId) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      for (const npcId of npcIdsRef.current) {
        await drainNpcSales(campaignCode, dmId, npcId);
      }
      setLastDrainedAt(new Date());
      setError(null);
    } catch (err) {
      console.error(
        '[useDmShopSalesSync] drain failed; will retry next poll',
        err
      );
      setError(
        err instanceof Error ? err.message : 'Failed to drain shop sales'
      );
    } finally {
      inFlightRef.current = false;
    }
  }, [campaignCode, dmId]);

  useEffect(() => {
    if (!enabled || !campaignCode || !dmId || npcIds.length === 0) return;
    drainNow();
    const interval = setInterval(drainNow, pollIntervalMs);
    return () => clearInterval(interval);
    // npcIds' CONTENTS are read from npcIdsRef inside drainNow, not from
    // this closure — only npcIds.length gates whether polling runs at all,
    // so an id-set change of the same length never restarts the interval.
  }, [enabled, campaignCode, dmId, drainNow, pollIntervalMs, npcIds.length]);

  return { lastDrainedAt, error, drainNow };
}
