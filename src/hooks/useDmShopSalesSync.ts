import { useCallback, useEffect, useRef, useState } from 'react';

import { isValidShopSale } from '@/lib/shopPurchases';
import { useNPCStore } from '@/store/npcStore';
import type { Currency } from '@/types/character';
import type { ShopSale } from '@/types/shop';
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

/**
 * Applies one already-validated sale to an NPC: credits `npc.currency` by
 * `sale.copper` and decrements the matching `NPCInventoryItem.quantity` by
 * `sale.quantity`.
 *
 * Spec edge case (a sale is a fact, not something to drop): if the DM
 * deleted the inventory row this sale refers to — or the NPC itself — while
 * the shop was open, the coin credit is still attempted. The currency
 * credit is computed and applied FIRST and unconditionally (whenever the
 * NPC itself still exists); only the inventory decrement is skipped when its
 * row can't be found, with a warning logged instead of the sale being
 * silently dropped. If the NPC record itself is gone there is no purse left
 * to credit into — `updateNPC` is a no-op for a missing id — but the sale is
 * still logged rather than vanishing without a trace, and the caller still
 * records it as applied so a permanently-deleted NPC doesn't cause the same
 * sale to be retried, and warned about, forever.
 */
function applySaleToNpc(
  campaignCode: string,
  npcId: string,
  sale: ShopSale
): void {
  const { getNPC, updateNPC } = useNPCStore.getState();
  const npc = getNPC(campaignCode, npcId);
  if (!npc) {
    console.warn(
      `[useDmShopSalesSync] sale ${sale.id} would credit ${sale.copper} copper to NPC ${npcId}, but that NPC no longer exists. The coin credit could not be applied anywhere; this sale's stock is unreconciled.`
    );
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
    return;
  }

  const nextInventory = inventory.map((item, index) =>
    index === itemIndex
      ? { ...item, quantity: Math.max(0, item.quantity - sale.quantity) }
      : item
  );
  updateNPC(campaignCode, npcId, {
    currency: nextCurrency,
    inventory: nextInventory,
  });
}

/**
 * Drains one NPC's `campaign:{code}:shop-sales:{npcId}` log: fetches it,
 * then applies every sale not already recorded in this NPC's
 * `appliedShopSaleIds` ledger (idempotent on `ShopSale.id` — see
 * `npcStore.ts`'s doc comment on that field for why it's persisted the same
 * way as `characterStore`'s `appliedTransferIds`).
 *
 * A malformed row is skipped (logged, not applied, not recorded as applied)
 * rather than aborting the rest of the batch — the same row-level resilience
 * `parseStoredShopSales` already gives the server-side parse, applied again
 * here as defense in depth against whatever the fetch actually hands back.
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

  for (const candidate of sales) {
    if (!isValidShopSale(candidate)) {
      console.warn(
        '[useDmShopSalesSync] skipping a malformed sale row',
        candidate
      );
      continue;
    }
    if (appliedIds.has(candidate.id)) continue;
    applySaleToNpc(campaignCode, npcId, candidate);
    useNPCStore.getState().recordAppliedShopSale(npcId, candidate.id);
    appliedIds.add(candidate.id);
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
