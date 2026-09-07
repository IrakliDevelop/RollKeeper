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
import type { PublicShop, PublicShopItem, ShopLedgerEntry } from '@/types/shop';
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
 * Builds the server-authoritative shop ledger — same inclusion rule as
 * `buildPublicShop` (`forSale === true` AND priceable), but every entry also
 * carries the full item so a sale can enqueue an `ItemTransfer`. Never sent
 * to players directly.
 */
export function buildShopLedger(
  npc: CampaignNPC,
  entityIds: string[]
): ShopLedgerEntry[] {
  const entries: ShopLedgerEntry[] = [];
  for (const row of npc.inventory ?? []) {
    if (row.forSale !== true) continue;
    const priceCopper = resolvePriceCopper(row);
    if (priceCopper === null) continue;
    entries.push({
      ...toPublicShopItem(row, priceCopper),
      item: toLedgerItem(row),
    });
  }
  // entityIds is accepted for interface symmetry with buildPublicShop; the
  // ledger itself is per-NPC/per-item and does not carry entityIds.
  void entityIds;
  return entries;
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
