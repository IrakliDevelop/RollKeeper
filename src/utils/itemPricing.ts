// Price resolution for NPC/merchant inventory rows (DM-authored only; this
// module publishes nothing player-reachable — see Slice 2 of the merchant
// feature plan).

import type { NPCInventoryItem } from '@/types/encounter';
import type { MagicItemRarity } from '@/types/character';
import { CURRENCY_VALUES } from '@/utils/currency';

/**
 * Suggested magic item prices (permanent items), in integer copper, keyed by
 * the six `MagicItemRarity` strings. Values follow the DMG/Xanathar's Guide
 * to Everything "Magic Item Prices" guideline table (100gp / 500gp / 5,000gp
 * / 50,000gp / 500,000gp for common through legendary). Artifacts have no
 * official price in the rules (they're RAW priceless, not for sale); the
 * value here extends the same escalating pattern as a placeholder default
 * so DM-authored rows always have something to fall back on.
 */
export const MAGIC_ITEM_RARITY_DEFAULT_COPPER: Record<MagicItemRarity, number> =
  {
    common: 100 * CURRENCY_VALUES.gold,
    uncommon: 500 * CURRENCY_VALUES.gold,
    rare: 5_000 * CURRENCY_VALUES.gold,
    'very rare': 50_000 * CURRENCY_VALUES.gold,
    legendary: 500_000 * CURRENCY_VALUES.gold,
    artifact: 1_000_000 * CURRENCY_VALUES.gold,
  };

function asKnownRarity(rarity: string | undefined): MagicItemRarity | null {
  if (!rarity) return null;
  return rarity in MAGIC_ITEM_RARITY_DEFAULT_COPPER
    ? (rarity as MagicItemRarity)
    : null;
}

/**
 * Resolves the copper price of an NPC inventory row for merchant display.
 *
 * Resolution order, first match wins:
 *   1. explicit `item.priceCopper` override
 *   2. `item.value`
 *   3. a magic-item rarity default (only for rows that actually carry a
 *      magic item, or that carry a recognised rarity string)
 *   4. `null` ("price required" — the row cannot be flagged for sale)
 *
 * Each of steps 1-2 wins even when its value is `0` — a free item is a
 * legitimate DM-authored price, not a signal to fall through to the next
 * step. Only `undefined` is treated as "absent".
 *
 * `item.rarity` is loosely typed (`string | undefined`) and may hold the
 * sentinel `'none'` or any unrecognised string; both are treated as "no
 * rarity" and resolve to `null` rather than crashing or guessing a price.
 */
export function resolvePriceCopper(item: NPCInventoryItem): number | null {
  if (item.priceCopper !== undefined) return item.priceCopper;
  if (item.value !== undefined) return item.value;

  const rarity = asKnownRarity(item.magicItem?.rarity ?? item.rarity);
  if (rarity) return MAGIC_ITEM_RARITY_DEFAULT_COPPER[rarity];

  return null;
}
