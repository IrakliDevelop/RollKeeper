// Pure helpers for the DM Shop tab — row pricing/provenance derivation, no
// JSX. See Task 5 of the Slice 2 merchant plan
// (.superpowers/sdd/2026-09-07-vtt-merchants-slice2/task-5-brief.md).

import { useEncounterStore } from '@/store/encounterStore';
import type { NPCInventoryItem } from '@/types/encounter';
import type { MagicItemRarity } from '@/types/character';
import type { ShopSaleLogEntry } from '@/types/shop';
import {
  resolvePriceCopper,
  MAGIC_ITEM_RARITY_DEFAULT_COPPER,
} from '@/utils/itemPricing';

/** DM-authored player-facing shop subtitle (e.g. "Ironmonger of the Low
 *  Market"). Mirrors the 300-char cap `sanitizePublicShop` (shopProjection.ts)
 *  enforces on the wire-format `merchantDescription`, and the identical cap
 *  added to `isNullableShop` in `durableDm/npcFamily.ts` — all three must
 *  move together. */
export const MAX_SHOP_DESCRIPTION_LENGTH = 300;

/** Generous but bounded — a shop realistically maps to a handful of tokens.
 *  Matches `MAX_ENTITY_IDS` in `shops/[npcId]/route.ts` and
 *  `shopProjection.ts`'s `sanitizePublicShop`; capped here too so an NPC
 *  placed unusually often never trips the route's own bound and turns a
 *  publish into a surprise 400. */
const MAX_SHOP_ENTITY_IDS = 50;

/**
 * DM-side resolution of which encounter entities a published shop should
 * carry (VTT merchants Slice 3, Task 13a): every `EncounterEntity` across
 * every encounter in this campaign whose `npcSourceId` (`encounter.ts`)
 * points at this NPC. This is what lets a player's later token tap find the
 * shop — see `PUT /api/campaign/[code]/shops/[npcId]`'s doc comment, which
 * depends on the DM client sending exactly this resolution.
 *
 * Scans every encounter in the campaign, not just the active one — an NPC's
 * token can sit in more than one encounter, or in an inactive one, and any
 * of those is still a legitimate way for a player to reach the shop.
 */
export function resolveShopEntityIds(
  campaignCode: string,
  npcId: string
): string[] {
  const encounters = useEncounterStore
    .getState()
    .getEncountersByCampaign(campaignCode);
  const entityIds: string[] = [];
  for (const encounter of encounters) {
    for (const entity of encounter.entities) {
      if (entity.npcSourceId === npcId) entityIds.push(entity.id);
    }
  }
  return entityIds.slice(0, MAX_SHOP_ENTITY_IDS);
}
import { formatCurrencyFromCopper } from '@/utils/currency';

/**
 * Shared grid-template for the Stock header row and every `ShopStockRow`.
 * Both must reference this constant rather than declaring their own
 * `grid-cols-[...auto...]` — `auto` tracks size independently per grid
 * container, so a header row and a body row (or two body rows with
 * differently-sized content) can drift out of alignment (Task 5 review,
 * Minor finding). Fixed widths on the trailing three columns keep them
 * identical everywhere; only the item-name column flexes.
 */
export const SHOP_STOCK_GRID_COLS = 'grid-cols-[1fr_4rem_14.5rem_4rem]';

/**
 * The price a row would resolve to with any manual override stripped —
 * `item.value`, then a rarity default, then `null`. This is what the price
 * fields show as placeholder text (spec: "Placeholder is what players would
 * pay"), shown whether or not the row is currently overridden.
 */
export function defaultPriceCopper(item: NPCInventoryItem): number | null {
  return resolvePriceCopper({ ...item, priceCopper: undefined });
}

function knownRarity(item: NPCInventoryItem): MagicItemRarity | null {
  const rarity = item.magicItem?.rarity ?? item.rarity;
  return rarity && rarity in MAGIC_ITEM_RARITY_DEFAULT_COPPER
    ? (rarity as MagicItemRarity)
    : null;
}

/**
 * The row's provenance line (spec artboard 1a, verbatim examples):
 *   - `armor · 20 lb · 50 gp value` — priced from `item.value`
 *   - `magic item · rarity default 50 gp` — priced from a rarity default
 *   - `no value, no rarity — set a price to sell it` — unpriceable
 * An explicit `priceCopper` override appends " · overridden" to whichever
 * shape applies (the spec's overridden example is the magic-item shape; the
 * suffix generalizes to the other two since an override can apply to any
 * row). Ordering mirrors `resolvePriceCopper`'s real precedence: value beats
 * a rarity default.
 *
 * A row with a *recognised* rarity that has no guideline price (currently
 * only `artifact` — RAW priceless, see `itemPricing.ts`) gets its own
 * message naming the rarity rather than being folded into the "no value, no
 * rarity" copy, which would misstate a row that does have a rarity.
 */
export function getProvenanceLine(item: NPCInventoryItem): string {
  const overridden = item.priceCopper !== undefined;
  const suffix = overridden ? ' · overridden' : '';

  if (item.value !== undefined) {
    const category = item.category ?? item.type ?? 'item';
    const weightPart = item.weight !== undefined ? `${item.weight} lb · ` : '';
    return `${category} · ${weightPart}${formatCurrencyFromCopper(item.value)} value${suffix}`;
  }

  const rarity = knownRarity(item);
  if (rarity) {
    const rarityDefault = MAGIC_ITEM_RARITY_DEFAULT_COPPER[rarity];
    if (rarityDefault !== null && rarityDefault !== undefined) {
      return `magic item · rarity default ${formatCurrencyFromCopper(rarityDefault)}${suffix}`;
    }
    return overridden
      ? `magic item · ${rarity}, no guideline price · overridden`
      : `magic item · ${rarity}, no guideline price — set a price to sell it`;
  }

  return overridden
    ? 'no value, no rarity · overridden'
    : 'no value, no rarity — set a price to sell it';
}

/**
 * The closed-state "Open for business" subtitle (artboard 1a, and Task
 * 13b item 4 — controller reach correction). The old copy ("Players can't
 * see this stock yet. Turn it on to publish.") undersold what publishing
 * actually does now that `GET /api/campaign/[code]/shops` lists every open
 * shop's npcId/name/token ids to any campaign member: the toggle went from
 * "visible to whoever finds the token" to "listed campaign-wide," including
 * to players who have never reached this NPC's map. This says so plainly,
 * without implying anything unsafe — it is still ordinary shared campaign
 * state, just wider-reaching than a single token.
 */
export const SHOP_CLOSED_SUBTITLE =
  "Players can't see this stock yet. Opening it lists the shop for the whole campaign, not just whoever finds the token.";

/** The open-state "Open for business" subtitle (artboard 1a: "2 items
 *  still in stock. Players who tap Brenn's token can buy now."). */
export function shopOpenSubtitle(
  npcName: string,
  itemsInStock: number
): string {
  const noun = itemsInStock === 1 ? 'item' : 'items';
  return `${itemsInStock} ${noun} still in stock. Players who tap ${npcName}'s token can buy now.`;
}

/** The Stock section's helper line — REPLACED, not supplemented, when the
 *  shop is open (artboard 1a: "Price falls back..." closed vs. "Stock
 *  reflects sales already reconciled..." open). */
export function shopStockHelperText(
  shopOpen: boolean,
  npcName: string
): string {
  return shopOpen
    ? `Stock reflects sales already reconciled to ${npcName}'s inventory.`
    : "Price falls back to the item's value, then its rarity. Placeholder is what players would pay.";
}

/**
 * Count of rows a player could actually buy right now: flagged for sale,
 * priceable, and with at least one unit left. Drives the open-state
 * subtitle's "N items still in stock" (artboard 1a says "2" for a shop
 * whose Chain Shirt just sold out — a for-sale, priceable row at 0 stock
 * does NOT count).
 */
export function countItemsInStock(inventory: NPCInventoryItem[]): number {
  return inventory.filter(
    item =>
      item.forSale === true &&
      resolvePriceCopper(item) !== null &&
      item.quantity > 0
  ).length;
}

/** Sum of `ShopSaleLogEntry.copper` across every entry — the sales log
 *  header's "N sales · X gp" total (artboard 1a). */
export function totalSalesCopper(entries: readonly ShopSaleLogEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.copper, 0);
}

function isSameLocalDay(iso: string, reference: Date): boolean {
  return new Date(iso).toDateString() === reference.toDateString();
}

/** Sum of `ShopSaleLogEntry.copper` for sales made on `now`'s local
 *  calendar day — the purse label's "+165 gp today" delta (artboard 1a).
 *  `now` is a parameter (default `new Date()`) purely so tests can pin it;
 *  callers should never pass anything else. */
export function todaysSalesCopper(
  entries: readonly ShopSaleLogEntry[],
  now: Date = new Date()
): number {
  return entries
    .filter(entry => isSameLocalDay(entry.at, now))
    .reduce((sum, entry) => sum + entry.copper, 0);
}

/**
 * Units sold per inventory row id, derived from the (capped, recent-window)
 * sales log — there is no separate `soldQuantity` counter client-side, so
 * this is what drives each stock row's "N sold" / "N sold — none left"
 * badge (artboard 1a). An approximation, not a ledger: a row's true
 * lifetime sold count can exceed this once older sales age out of
 * `SHOP_SALES_LOG_MAX` (`npcStore.ts`) — acceptable for a UI badge, since
 * the server-side `ShopLedgerEntry.soldQuantity` remains the authoritative
 * count and this never feeds back into stock math.
 */
export function soldQuantityByItemId(
  entries: readonly ShopSaleLogEntry[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    map.set(entry.entryId, (map.get(entry.entryId) ?? 0) + entry.quantity);
  }
  return map;
}
