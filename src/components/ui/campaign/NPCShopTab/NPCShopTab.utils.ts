// Pure helpers for the DM Shop tab — row pricing/provenance derivation, no
// JSX. See Task 5 of the Slice 2 merchant plan
// (.superpowers/sdd/2026-09-07-vtt-merchants-slice2/task-5-brief.md).

import { useEncounterStore } from '@/store/encounterStore';
import type { NPCInventoryItem } from '@/types/encounter';
import type { MagicItemRarity } from '@/types/character';
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
