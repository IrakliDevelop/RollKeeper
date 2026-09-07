/**
 * The projection boundary for merchant shops (VTT merchants Slice 3, Task 2).
 *
 * `buildPublicShop` is the DM-side authoritative → public projection, built
 * from a trusted `CampaignNPC`. `sanitizePublicShop` is a SECOND, independent
 * boundary — the read-side validator for a `PublicShop` payload arriving
 * over the wire (e.g. a stored/cached copy, or an HTTP body claiming to
 * already be public) — mirroring `validateMarkerLootSeed` /
 * `parseStoredMarkerLootLedger` in `markerLootClaims.ts` for shape and
 * bounds discipline. `buildShopLedger` is the authoritative side, carrying
 * the full item so a sale can enqueue an `ItemTransfer`.
 *
 * Both `buildPublicShop` and `sanitizePublicShop` build `PublicShopItem`
 * objects field-by-field (never spread, never the caller's object) — the
 * same discipline `sanitizePublicMarkers.ts` documents. `PublicShopItem.item`
 * is `never`, a structural refusal: an `NPCInventoryItem` may carry a full
 * `magicItem` definition and other DM-only fields, and only an explicit pick
 * keeps those from riding through into what a player receives.
 */

import type { InventoryItem, MagicItem } from '@/types/character';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';
import type {
  PublicShop,
  PublicShopItem,
  ShopLedgerEntry,
  ShopLedgerSeed,
} from '@/types/shop';
import { resolvePriceCopper } from '@/utils/itemPricing';

const MAX_SHOP_ITEMS = 500;
const MAX_ENTITY_IDS = 50;

function itemKindOf(row: NPCInventoryItem): 'inventory' | 'magic' {
  return row.magicItem ? 'magic' : 'inventory';
}

/**
 * Explicit field pick from an `NPCInventoryItem` row into a `PublicShopItem`.
 * `priceCopper` is passed in already resolved (the caller has confirmed it
 * is non-null) rather than re-resolved here, so there is exactly one call to
 * `resolvePriceCopper` per row across both `buildPublicShop` and
 * `buildShopLedger`.
 */
function toPublicShopItem(
  row: NPCInventoryItem,
  priceCopper: number
): PublicShopItem {
  return {
    id: row.id,
    name: row.name,
    itemKind: itemKindOf(row),
    priceCopper,
    remainingQuantity: row.quantity,
    ...(row.description !== undefined ? { description: row.description } : {}),
    ...(row.rarity !== undefined ? { rarity: row.rarity } : {}),
  };
}

/**
 * Builds the player-facing projection of a merchant NPC's shop, or `null`
 * when the shop is closed (or the NPC was never turned into a merchant —
 * `shop` absent). A row is included only when it is BOTH flagged for sale
 * AND priceable: Slice 2 deliberately left `forSale` and priceability
 * independent in the data model (a row can be flagged for sale and still
 * fail to resolve a price), so this is the enforcement point for that
 * invariant, not the authoring UI.
 *
 * `merchantDescription` is picked from `npc.shop.description` — NEVER
 * `npc.description` (controller ruling R17, reversing R15). `npc.description`
 * is the DM's private free-text note, authored under a "Brief description"
 * placeholder with nothing indicating it becomes player-visible, and
 * rendered only in DM surfaces today; publishing it would leak a DM's
 * private notes (e.g. "secretly a doppelganger") to the whole party the
 * instant the shop toggle flips. `shop.description` is a dedicated field the
 * DM authors in the Shop tab (Task 13's job to add UI for) KNOWING it is
 * player-facing.
 */
export function buildPublicShop(
  npc: CampaignNPC,
  entityIds: string[]
): PublicShop | null {
  if (npc.shop?.open !== true) return null;

  const items: PublicShopItem[] = [];
  for (const row of npc.inventory ?? []) {
    if (row.forSale !== true) continue;
    const priceCopper = resolvePriceCopper(row);
    if (priceCopper === null) continue;
    items.push(toPublicShopItem(row, priceCopper));
  }

  return {
    npcId: npc.id,
    merchantName: npc.name,
    ...(npc.shop.description !== undefined
      ? { merchantDescription: npc.shop.description }
      : {}),
    entityIds,
    items,
  };
}

/**
 * Converts one `NPCInventoryItem` shop row into the full `InventoryItem |
 * MagicItem` a `ShopLedgerEntry` carries. Mirrors `npcItemToInventoryItem`
 * (`src/app/dm/campaign/[code]/page.tsx`) and the magic-item branch of
 * `deliverMarkerLoot` (`markerLootDelivery.ts`): a row with a populated
 * `magicItem` carries that definition verbatim (cloned, so the ledger entry
 * never aliases the NPC's live object); any other row is reconstructed into
 * a minimal but valid `InventoryItem`, since `NPCInventoryItem` itself lacks
 * `InventoryItem`'s required `tags`/`createdAt`/`updatedAt`/`category`.
 */
function toLedgerItem(row: NPCInventoryItem): InventoryItem | MagicItem {
  if (row.magicItem) {
    return structuredClone(row.magicItem);
  }
  const item: InventoryItem = {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    category: row.category || 'misc',
    description: row.description,
    weight: row.weight,
    value: row.value,
    rarity: row.rarity as InventoryItem['rarity'],
    type: row.type as InventoryItem['type'],
    location: 'Backpack',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return item;
}

/**
 * Builds the server-authoritative shop ledger SEED — same inclusion rule as
 * `buildPublicShop` (`forSale === true` AND priceable), but every entry also
 * carries the full item so a sale can enqueue an `ItemTransfer`. Never sent
 * to players directly.
 *
 * Returns `ShopLedgerSeed[]`, NOT `ShopLedgerEntry[]` (ruling R6): there is
 * no `soldQuantity` to report here, and the stock field is named
 * `seededQuantity` rather than `remainingQuantity` so this can never be
 * confused with — or type-check as — the stored ledger shape
 * `parseStoredShopLedger` returns. `seededQuantity` is read straight off
 * `row.quantity` — which `useDmShopSalesSync`'s drain already decrements per
 * sale — so it IS the live remaining count by the time a republish sends
 * it; `SHOP_SEED_SCRIPT` (shopPurchases.ts) writes it straight through to
 * `remainingQuantity` with no further subtraction (Slice 3 final review,
 * Critical finding — see that script's doc comment for why an earlier
 * version subtracted `soldQuantity` a second time here).
 */
export function buildShopLedger(npc: CampaignNPC): ShopLedgerSeed[] {
  const entries: ShopLedgerSeed[] = [];
  for (const row of npc.inventory ?? []) {
    if (row.forSale !== true) continue;
    const priceCopper = resolvePriceCopper(row);
    if (priceCopper === null) continue;
    const { remainingQuantity, ...publicFields } = toPublicShopItem(
      row,
      priceCopper
    );
    entries.push({
      ...publicFields,
      item: toLedgerItem(row),
      seededQuantity: remainingQuantity,
    });
  }
  return entries;
}

/**
 * Overlays a shop ledger's canonical (post-sales) `remainingQuantity` onto a
 * freshly-built `PublicShop` — the shop analogue of `applyCanonicalRemaining`
 * in `sanitizePublicMarkers.ts`. `buildPublicShop` projects each row's
 * `remainingQuantity` straight from `NPCInventoryItem.quantity` (the DM's
 * freshly-authored total stock, with no notion of sales); after
 * `seedShopLedger` reconciles that total against already-sold units, the
 * ledger's `remainingQuantity` is the true live count and must replace it —
 * otherwise a republish would show players the pre-sale stock count again.
 * A ledger row with no matching public item (filtered out, or vice versa)
 * is left untouched; this never adds or removes items, only corrects counts.
 */
export function applyCanonicalShopRemaining(
  shop: PublicShop,
  ledger: readonly { id: string; remainingQuantity: number }[]
): PublicShop {
  const remainingById = new Map(
    ledger.map(entry => [entry.id, entry.remainingQuantity])
  );
  return {
    ...shop,
    items: shop.items.map(item => {
      const canonical = remainingById.get(item.id);
      return canonical === undefined
        ? item
        : { ...item, remainingQuantity: canonical };
    }),
  };
}

/**
 * Overlays a shop ledger's live (post-sales) `remainingQuantity` onto a
 * PUBLISHED `PublicShop` for a player-facing `GET` (VTT merchants Slice 3,
 * Task 5a / controller ruling R10). This is NOT `applyCanonicalShopRemaining`
 * under another name — that function runs at PUBLISH time against a
 * projection and a ledger seed built from the SAME request, where a mismatch
 * can't happen, so it leaves an unmatched row untouched as a defensive
 * no-op. This one runs at READ time against two keys that age independently
 * — `PURCHASE_SCRIPT` decrements the ledger on every sale and never touches
 * the projection — so a mismatch here is exactly the stale-stock hazard the
 * read exists to close, and is handled by dropping, not trusting:
 *
 *   - A projection row with no matching ledger entry is REMOVED — never
 *     shown with a stale (pre-sale) count.
 *   - A ledger row with no matching projection row is simply never visited:
 *     this only ever iterates the projection's rows, since the projection
 *     alone defines what is public. The ledger is consulted for counts
 *     only, never as a source of rows — a `ShopLedgerEntry` carries the
 *     full `item` that `PublicShopItem.item: never` exists to keep off the
 *     wire, so nothing here may spread or return a ledger entry.
 *
 * Every field but `remainingQuantity` is explicit-field-picked from the
 * PROJECTION's row.
 */
export function overlayLiveShopStock(
  shop: PublicShop,
  ledger: readonly ShopLedgerEntry[]
): PublicShop {
  const remainingById = new Map(
    ledger.map(entry => [entry.id, entry.remainingQuantity])
  );
  const items: PublicShopItem[] = [];
  for (const item of shop.items) {
    const remainingQuantity = remainingById.get(item.id);
    if (remainingQuantity === undefined) continue;
    items.push({
      id: item.id,
      name: item.name,
      itemKind: item.itemKind,
      priceCopper: item.priceCopper,
      remainingQuantity,
      ...(item.description !== undefined
        ? { description: item.description }
        : {}),
      ...(item.rarity !== undefined ? { rarity: item.rarity } : {}),
    });
  }
  return {
    npcId: shop.npcId,
    merchantName: shop.merchantName,
    ...(shop.merchantDescription !== undefined
      ? { merchantDescription: shop.merchantDescription }
      : {}),
    entityIds: [...shop.entityIds],
    items,
  };
}

function isPublicShopItem(value: unknown): value is PublicShopItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    item.id.length <= 200 &&
    typeof item.name === 'string' &&
    item.name.length > 0 &&
    item.name.length <= 300 &&
    (item.itemKind === 'inventory' || item.itemKind === 'magic') &&
    Number.isInteger(item.priceCopper) &&
    (item.priceCopper as number) >= 0 &&
    Number.isInteger(item.remainingQuantity) &&
    (item.remainingQuantity as number) >= 0 &&
    (item.description === undefined || typeof item.description === 'string') &&
    (item.rarity === undefined || typeof item.rarity === 'string') &&
    item.item === undefined
  );
}

/**
 * Validates and re-projects an untrusted value into a `PublicShop`, or
 * `null` if the shape is invalid. Mirrors `validateMarkerLootSeed`'s shape
 * and bounds discipline (length caps, per-entry validity, duplicate-id
 * rejection) and `sanitizePublicMarkers`'s explicit-field-pick discipline:
 * only `{ npcId, merchantName, entityIds, items }` — and, per item, only
 * `{ id, name, itemKind, priceCopper, remainingQuantity, description?,
 * rarity? }` — ever survives. `item` is rejected outright on any input item
 * that carries it (structural refusal, same as `PublicShopItem.item: never`
 * at the type level), rather than silently dropped, since a payload
 * asserting that key is exactly the shape this boundary exists to catch.
 */
export function sanitizePublicShop(value: unknown): PublicShop | null {
  if (!value || typeof value !== 'object') return null;
  const shop = value as Record<string, unknown>;

  if (
    typeof shop.npcId !== 'string' ||
    shop.npcId.length === 0 ||
    shop.npcId.length > 200 ||
    typeof shop.merchantName !== 'string' ||
    shop.merchantName.length === 0 ||
    shop.merchantName.length > 300 ||
    (shop.merchantDescription !== undefined &&
      (typeof shop.merchantDescription !== 'string' ||
        shop.merchantDescription.length > 300)) ||
    !Array.isArray(shop.entityIds) ||
    shop.entityIds.length > MAX_ENTITY_IDS ||
    !shop.entityIds.every(
      id => typeof id === 'string' && id.length > 0 && id.length <= 200
    ) ||
    !Array.isArray(shop.items) ||
    shop.items.length > MAX_SHOP_ITEMS ||
    !shop.items.every(isPublicShopItem)
  ) {
    return null;
  }

  const items = shop.items as PublicShopItem[];
  const ids = new Set(items.map(item => item.id));
  if (ids.size !== items.length) return null;

  return {
    npcId: shop.npcId,
    merchantName: shop.merchantName,
    ...(shop.merchantDescription !== undefined
      ? { merchantDescription: shop.merchantDescription as string }
      : {}),
    entityIds: [...(shop.entityIds as string[])],
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      itemKind: item.itemKind,
      priceCopper: item.priceCopper,
      remainingQuantity: item.remainingQuantity,
      ...(item.description !== undefined
        ? { description: item.description }
        : {}),
      ...(item.rarity !== undefined ? { rarity: item.rarity } : {}),
    })),
  };
}
