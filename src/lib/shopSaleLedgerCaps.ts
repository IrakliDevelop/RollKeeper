import type { ShopSaleLogEntry } from '@/types/shop';

/**
 * Idempotency ledger for `useDmShopSalesSync` (VTT merchants Slice 3, Task
 * 12), keyed by npcId. Mirrors `appliedTransferIds` on `characterStore`
 * (Task 8, see `characterCanonicalStorage.ts`) in both placement and
 * eviction: a SIBLING top-level field on the store's state, never a field on
 * `CampaignNPC` itself. Keeping it off `CampaignNPC` isn't just parity with
 * Task 8's rationale (keeping dedup bookkeeping out of exports) — for NPCs
 * it also sidesteps `durableDm/npcFamily.ts`'s 35-key `NPC_DOCUMENT_FIELDS`
 * allowlist entirely, which (unlike the character cloud path) rejects an
 * NPC's ENTIRE record for a single unclassified field. A sibling store field
 * is never part of `NpcPayload` (`Omit<CampaignNPC, 'id' | 'campaignCode'>`),
 * so it can never trip that allowlist no matter how it evolves.
 *
 * Cap mirrors `MAX_SALES_LOG_ENTRIES` (`shopPurchases.ts`) exactly: the
 * server-side sales log this ledger deduplicates against is itself capped at
 * 500 entries per NPC (FIFO, trimmed on every purchase) and is never
 * cleared/acked by the drain hook (see that file's own comment on the
 * append step) — so 500 is already the largest window of un-drained sales
 * that could ever need deduplicating for one NPC at once. FIFO eviction is
 * safe here for the same reason it is for `appliedTransferIds`: an id old
 * enough to fall off a 500-entry ledger has almost certainly already scrolled
 * out of the server's own 500-entry sales window too.
 */
export const APPLIED_SHOP_SALE_IDS_MAX = 500;

export function capAppliedSaleIds(ids: string[]): string[] {
  return ids.length > APPLIED_SHOP_SALE_IDS_MAX
    ? ids.slice(ids.length - APPLIED_SHOP_SALE_IDS_MAX)
    : ids;
}

/**
 * Display-only recent-activity window for the DM Shop tab's sales log
 * (VTT merchants Slice 3, Task 13b), keyed by npcId — a SIBLING of
 * `appliedShopSaleIds`, never a replacement for it: that field is the bare
 * dedup ledger `useDmShopSalesSync` checks before re-applying a sale, this
 * one is what the tab renders, and the two are written together (never one
 * without the other) from `applySaleToNpc`. A much smaller cap than
 * `APPLIED_SHOP_SALE_IDS_MAX` is fine here — this is a DM convenience view
 * of recent business, not a financial ledger (the server-side
 * `ShopLedgerEntry.soldQuantity` already is one, and stays authoritative
 * regardless of what ages out of this array). Oldest entries are trimmed
 * from the FRONT so the array stays in chronological (oldest-first) order,
 * matching the artboard's sales log ordering.
 */
export const SHOP_SALES_LOG_MAX = 50;

export function capShopSalesLog(
  entries: ShopSaleLogEntry[]
): ShopSaleLogEntry[] {
  return entries.length > SHOP_SALES_LOG_MAX
    ? entries.slice(entries.length - SHOP_SALES_LOG_MAX)
    : entries;
}
