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
  /** One-line flavour text shown under the merchant's name (artboard 1b,
   *  e.g. "Ironmonger of the Low Market"), picked from `CampaignNPC.shop.description`
   *  — a dedicated, DM-authored, known-player-facing field — at publish
   *  time. NEVER `CampaignNPC.description` (the DM's private free-text
   *  note; controller ruling R17 reverses the earlier R15 source). Goes
   *  through the same explicit field pick as every other public field
   *  rather than a loose, unsourced prop. */
  merchantDescription?: string;
  /** Encounter entity ids for this NPC's token(s), resolved DM-side at
   *  publish time so a player's token tap can find the shop without
   *  learning anything about NPC internals. */
  entityIds: string[];
  items: PublicShopItem[];
}

/**
 * The player-readable INDEX of one open shop (controller ruling R16) —
 * `GET /api/campaign/[code]/shops` returns one of these per currently-open
 * shop. Deliberately minimal (no items, no description): it exists purely
 * so a player's token tap can resolve `entityId -> npcId` without a token
 * ever carrying that mapping itself. A LOOKUP, not an authority — a match
 * here must still be confirmed against the specific shop's own live
 * `PublicShop.entityIds` (`GET .../shops/[npcId]`) before anything opens.
 */
export interface PublicShopIndexEntry {
  npcId: string;
  merchantName: string;
  entityIds: string[];
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
   * Units sold from this row SINCE THE LAST PUBLISH — ledger-only, never on
   * `PublicShopItem` (players have no business seeing sales counts).
   * `PURCHASE_SCRIPT` increments it by the same amount it decrements
   * `remainingQuantity`; `SHOP_SEED_SCRIPT` resets it to 0 on every reseed.
   *
   * NOT a lifetime counter (Slice 3 final review, Critical finding —
   * controller ruling R5 superseded): an earlier version of this field
   * carried forward across a reseed so `SHOP_SEED_SCRIPT` could recompute
   * `remainingQuantity = max(0, freshlyAuthoredStock - soldQuantity)`. That
   * double-subtracted every sale, because `NPCInventoryItem.quantity` — the
   * source `ShopLedgerSeed.seededQuantity` is built from — is ALSO
   * decremented per sale by `useDmShopSalesSync`'s drain. See
   * `SHOP_SEED_SCRIPT`'s doc comment (`shopPurchases.ts`) for the full
   * arithmetic and the fix.
   */
  soldQuantity: number;
}

/**
 * The DM-authored SEED for one shop row — `buildShopLedger`'s output and the
 * only shape `seedShopLedger`/`SHOP_SEED_SCRIPT` ever accept as input.
 * Deliberately NOT the same shape as `ShopLedgerEntry` (controller ruling
 * R6, Task 5 review of Task 3) — `item`/other fields are shared, but the
 * stock field is named `seededQuantity`, not `remainingQuantity`, so it is a
 * compile error to feed `parseStoredShopLedger`'s return value
 * (`ShopLedgerEntry[]`) straight back into `seedShopLedger`.
 *
 * `seededQuantity` IS the live remaining count the DM's client wants
 * published (Slice 3 final review, Critical finding — superseding R5's
 * "freshly-authored total stock, unaware of sales" description of this
 * field): `buildShopLedger` builds it from `NPCInventoryItem.quantity`,
 * which `useDmShopSalesSync`'s drain already decrements per sale, so by the
 * time a republish happens the client-authored count has already had sold
 * units subtracted once. `SHOP_SEED_SCRIPT` writes it straight through to
 * `remainingQuantity` with no further subtraction — see that script's doc
 * comment (`shopPurchases.ts`) for why an earlier version subtracted a
 * second time and eroded stock on every post-sale edit.
 */
export interface ShopLedgerSeed
  extends Omit<PublicShopItem, 'item' | 'remainingQuantity'> {
  item: InventoryItem | MagicItem;
  /** Live remaining stock for this row, already net of any sales (see the
   *  type doc above) — never a lifetime total. */
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

/**
 * One completed sale as displayed in the DM Shop tab's sales log (VTT
 * merchants Slice 3, Task 13b — artboard 1a's "2 sales · 165 gp" state).
 * Recorded by `useDmShopSalesSync`'s `applySaleToNpc` at apply time, into
 * `npcStore`'s `shopSalesLogByNpc` — a sibling of, and always written
 * alongside, `appliedShopSaleIds` (that field is a bare id ledger for
 * dedup only and carries nothing display-worthy).
 *
 * `itemName` is captured at sale time rather than re-derived from the
 * current inventory row on every render: a later rename or deletion of
 * that row must never rewrite what a past sale is shown as. `reconciled`
 * is `false` when the sale's inventory row (or the NPC record itself)
 * could no longer be found at drain time — the coin credit still lands,
 * but the stock decrement could not be applied. The spec requires this to
 * surface in the log rather than vanish into a console warning; see
 * `applySaleToNpc`'s doc comment in `useDmShopSalesSync.ts`.
 */
export interface ShopSaleLogEntry {
  /** `ShopSale.id` — lets a future entry point back at the source sale. */
  id: string;
  entryId: string;
  itemName: string;
  quantity: number;
  copper: number;
  playerId: string;
  at: string; // ISO timestamp
  reconciled: boolean;
}
