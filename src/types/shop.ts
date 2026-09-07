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
