// Price resolution for NPC/merchant inventory rows (DM-authored) plus the
// gp/sp/cp <-> copper denomination helpers shared by the DM Shop tab and the
// player shop dialog. `resolvePriceCopper`/`MAGIC_ITEM_RARITY_DEFAULT_COPPER`
// are DM-side-only concerns (see Slice 2 of the merchant feature plan); the
// `PriceDenominations` type and its two conversion functions below were
// relocated here in Slice 3 Task 10 specifically because the player-facing
// shop dialog needs them too and the old home
// (`NPCShopTab/NPCShopTab.utils.ts`) is a DM-only module.

import type { NPCInventoryItem } from '@/types/encounter';
import type { MagicItemRarity } from '@/types/character';
import { CURRENCY_VALUES } from '@/utils/currency';

/**
 * Suggested magic item prices (permanent items), in integer copper, keyed by
 * the six `MagicItemRarity` strings. Values are derived from the DMG/
 * Xanathar's Guide to Everything "Magic Item Prices" guideline ranges
 * (common 50-100gp, uncommon 101-500gp, rare 501-5,000gp, very rare
 * 5,001-50,000gp, legendary 50,001gp+), normalized to a single round
 * upper-bound-per-tier figure (100gp / 500gp / 5,000gp / 50,000gp /
 * 500,000gp for common through legendary) since this table needs one
 * number, not a range.
 *
 * `artifact` is deliberately `null`: artifacts are RAW priceless — neither
 * the DMG nor XGE price them, and there is no guideline figure to derive
 * one from. Rendering an invented number here would read to the DM as
 * authoritative "this is what players would pay" guidance for a rarity the
 * rules explicitly decline to price. `null` routes an artifact row into the
 * same "price required" state as any other unpriceable row; the DM can
 * still set an explicit `priceCopper` override to sell one anyway.
 */
export const MAGIC_ITEM_RARITY_DEFAULT_COPPER: Record<
  MagicItemRarity,
  number | null
> = {
  common: 100 * CURRENCY_VALUES.gold,
  uncommon: 500 * CURRENCY_VALUES.gold,
  rare: 5_000 * CURRENCY_VALUES.gold,
  'very rare': 50_000 * CURRENCY_VALUES.gold,
  legendary: 500_000 * CURRENCY_VALUES.gold,
  artifact: null,
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
 *      magic item, or that carry a recognised rarity string) — `artifact`
 *      has no table default and falls through to step 4
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
  return rarity ? MAGIC_ITEM_RARITY_DEFAULT_COPPER[rarity] : null;
}

/** A price split into the three entry/display denominations the DM Shop tab
 *  edits directly and the player shop dialog reads back. Relocated here
 *  (Task 10, VTT merchants Slice 3) from the DM-only
 *  `NPCShopTab/NPCShopTab.utils.ts` — the player shop dialog needs both
 *  conversion functions below, and this module (unlike the DM Shop tab) is
 *  reachable from player-facing code. */
export interface PriceDenominations {
  gp: number;
  sp: number;
  cp: number;
}

/** Splits an integer copper price into gp/sp/cp for display or entry fields. */
export function priceCopperToDenominations(copper: number): PriceDenominations {
  const gp = Math.floor(copper / CURRENCY_VALUES.gold);
  const afterGold = copper % CURRENCY_VALUES.gold;
  const sp = Math.floor(afterGold / CURRENCY_VALUES.silver);
  const cp = afterGold % CURRENCY_VALUES.silver;
  return { gp, sp, cp };
}

/**
 * Controller decision (Slice 2 Task 5 brief, R2): the gp/sp/cp entry fields
 * combine into the single integer `priceCopper` written to the item. A
 * missing denomination counts as zero, so editing one field alone still
 * produces a valid price.
 */
export function denominationsToPriceCopper(
  entry: Partial<PriceDenominations>
): number {
  return (
    (entry.gp ?? 0) * CURRENCY_VALUES.gold +
    (entry.sp ?? 0) * CURRENCY_VALUES.silver +
    (entry.cp ?? 0) * CURRENCY_VALUES.copper
  );
}
