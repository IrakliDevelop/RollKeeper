import { MAX_SALES_LOG_ENTRIES } from '@/lib/shopPurchases';

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
 * ONE cap governs this ledger end to end — `capAppliedSaleIds` is used by
 * BOTH `recordAppliedShopSale`'s single-tab append (`npcStore.ts`) AND
 * `crossTabNpcSync`'s cross-tab union. Earlier this was two separate caps
 * (500 for the single-tab write, 1000 for the merge), which contradicted
 * each other: a dormant tab's stale merge could grow the ledger past 500,
 * and the very next local sale would immediately re-slice it back down to
 * 500 — dropping the two most-recently-live local ids while keeping
 * whatever ancient id the merge had just added, restoring the exact
 * re-application risk this ledger exists to prevent. A single cap used
 * everywhere removes that contradiction rather than narrowing it.
 *
 * Sized at `MAX_SALES_LOG_ENTRIES * 2` (1000): the server-side per-NPC sales
 * log this ledger deduplicates against is itself capped at
 * `MAX_SALES_LOG_ENTRIES` (500, `shopPurchases.ts`) — FIFO-trimmed on every
 * purchase and never cleared/acked by the drain hook (see that file's own
 * comment on the append step) — so at most 500 sale ids can ever be live and
 * re-appliable for one NPC at a time. A 1000-entry ledger therefore keeps a
 * full cap's worth of headroom for a stale or out-of-order contribution from
 * another tab (`crossTabNpcSync`) to land before any eviction is even
 * possible, and — because both write paths now share this same cap — that
 * headroom is a durable property of the ledger rather than something the
 * next local write could erase.
 *
 * FIFO eviction (trim from the front, i.e. treat array position as a proxy
 * for recency) is exact for `recordAppliedShopSale`'s own appends, which
 * always add the true newest id. It is only an approximation for
 * `crossTabNpcSync`'s merge, where an out-of-order or stale contribution
 * from another tab can land ahead of ids that are actually newer — accepted
 * there as a bounded approximation (see that module's doc comment), not
 * eliminated by this cap. A timestamp-ordered ledger would be strictly
 * better, but `appliedShopSaleIds` deliberately stores bare ids with no
 * per-id metadata, and adding one here is out of proportion to the risk.
 *
 * Storage cost: ~1000 entries × ~45 bytes/id ≈ 45 KB per merchant NPC that
 * ever accumulates this many sales, held in `localStorage` alongside the
 * rest of `npcStore`'s persisted state — acceptable for the handful of
 * long-running merchant NPCs that will ever get near this size.
 */
export const APPLIED_SHOP_SALE_IDS_MAX = MAX_SALES_LOG_ENTRIES * 2;

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
