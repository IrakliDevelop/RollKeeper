import type { InventoryItem, MagicItem } from './character';

/**
 * The PUBLIC projection of a merchant NPC's shop — the only shape that ever
 * leaves the DM to players (spec "Data model wire shapes"). Built by
 * `buildPublicShop` via an explicit safe-field pick, mirroring
 * `PublicMarkerDetail` in `battlemap.ts`.
 */
export interface PublicShop {
  npcId: string;
  merchantName: string;
  /** Encounter entity ids for this NPC's token(s), resolved DM-side at
   *  publish time so a player's token tap can find the shop without
   *  learning anything about NPC internals. */
  entityIds: string[];
  items: PublicShopItem[];
}

/**
 * The PUBLIC projection of one shop row.
 *
 * `item?: never` is a structural refusal, not documentation — the same
 * device `PublicMarkerDetail.dmNotes` uses in `battlemap.ts`. Without it, a
 * `ShopLedgerEntry` (or the DM's `NPCInventoryItem`) is assignable to
 * `PublicShopItem` (extra properties survive anything but a fresh object
 * literal), so `items: ledger.entries` would type-check in a sync payload
 * builder and ship every full item definition — including a `magicItem` with
 * its mechanical text — to players. Do NOT widen this back; fix the call
 * site with an explicit field pick instead.
 */
export interface PublicShopItem {
  id: string;
  name: string;
  itemKind: 'inventory' | 'magic';
  priceCopper: number;
  remainingQuantity: number;
  description?: string;
  rarity?: string;
  item?: never;
}

/**
 * The authoritative, server-side shop row — carries the full item so a sale
 * can enqueue an `ItemTransfer`. Never sent to players directly; only
 * `PublicShopItem` rows (built from this via `buildPublicShop`) are.
 */
export interface ShopLedgerEntry extends Omit<PublicShopItem, 'item'> {
  item: InventoryItem | MagicItem;
  /**
   * Cumulative units sold from this row across its lifetime — ledger-only,
   * never on `PublicShopItem` (players have no business seeing sales
   * counts). `SHOP_SEED_SCRIPT` uses it to compute `remainingQuantity` on
   * every reseed as `max(0, freshlyAuthoredStock - soldQuantity)`, so a DM
   * republishing the shop (which resends the *authored* stock as
   * `remainingQuantity`, unaware of sales) can genuinely restock an item —
   * unlike a bare non-increasing `remainingQuantity`, which can only ever
   * shrink. `PURCHASE_SCRIPT` increments it by the same amount it decrements
   * `remainingQuantity`.
   */
  soldQuantity: number;
}

/**
 * The DM-authored SEED for one shop row — `buildShopLedger`'s output and the
 * only shape `seedShopLedger`/`SHOP_SEED_SCRIPT` ever accept as input.
 * Deliberately NOT the same shape as `ShopLedgerEntry` (controller ruling
 * R6, Task 5 review of Task 3): `seededQuantity` names the freshly-authored
 * TOTAL stock a republish wants live, never the live remaining count, and
 * there is no `soldQuantity` here at all — a fresh seed has no notion of
 * sales, `SHOP_SEED_SCRIPT` derives that from the OLD stored row keyed by
 * `id`. Renaming the stock field (rather than merely documenting the
 * hazard) makes it a compile error to feed `parseStoredShopLedger`'s return
 * value — `ShopLedgerEntry[]`, which carries `remainingQuantity` and
 * `soldQuantity` — back into `seedShopLedger`: exactly the
 * reseed-erodes-stock hazard (8 -> 6 -> 4) the Task 3 review flagged.
 * `parseStoredShopLedger` keeps returning `ShopLedgerEntry[]`; the two types
 * must never be interchangeable.
 */
export interface ShopLedgerSeed
  extends Omit<PublicShopItem, 'item' | 'remainingQuantity'> {
  item: InventoryItem | MagicItem;
  /** Authored total stock for this row, before any already-sold units are
   *  subtracted. Never a live/remaining count — see the type doc above. */
  seededQuantity: number;
}

/** One completed sale, drained by the DM sync hook for reconciliation. */
export interface ShopSale {
  id: string;
  entryId: string;
  quantity: number;
  /** Integer copper the player paid for this sale (unit price * quantity). */
  copper: number;
  playerId: string;
  at: string; // ISO timestamp
}
