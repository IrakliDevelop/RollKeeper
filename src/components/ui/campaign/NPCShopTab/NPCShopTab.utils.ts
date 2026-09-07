// Pure helpers for the DM Shop tab — row pricing/provenance derivation, no
// JSX. See Task 5 of the Slice 2 merchant plan
// (.superpowers/sdd/2026-09-07-vtt-merchants-slice2/task-5-brief.md).

import type { NPCInventoryItem } from '@/types/encounter';
import type { MagicItemRarity } from '@/types/character';
import {
  resolvePriceCopper,
  MAGIC_ITEM_RARITY_DEFAULT_COPPER,
} from '@/utils/itemPricing';
import { CURRENCY_VALUES, formatCurrencyFromCopper } from '@/utils/currency';
import type { PriceDenominations } from './NPCShopTab.types';

/** Splits an integer copper price into gp/sp/cp for the three entry fields. */
export function priceCopperToDenominations(copper: number): PriceDenominations {
  const gp = Math.floor(copper / CURRENCY_VALUES.gold);
  const afterGold = copper % CURRENCY_VALUES.gold;
  const sp = Math.floor(afterGold / CURRENCY_VALUES.silver);
  const cp = afterGold % CURRENCY_VALUES.silver;
  return { gp, sp, cp };
}

/**
 * Controller decision (Task 5 brief, R2): the gp/sp/cp entry fields combine
 * into the single integer `priceCopper` written to the item. A missing
 * denomination counts as zero, so editing one field alone still produces a
 * valid price.
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
  const rarityDefault = rarity
    ? MAGIC_ITEM_RARITY_DEFAULT_COPPER[rarity]
    : null;
  if (rarityDefault !== null && rarityDefault !== undefined) {
    return `magic item · rarity default ${formatCurrencyFromCopper(rarityDefault)}${suffix}`;
  }

  return overridden
    ? 'no value, no rarity · overridden'
    : 'no value, no rarity — set a price to sell it';
}
