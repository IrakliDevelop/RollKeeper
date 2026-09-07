// Currency conversion utility functions

import type { Currency } from '@/types/character';

export function formatCurrencyFromCopper(totalCopper: number): string {
  if (!totalCopper || totalCopper <= 0) return '0 cp';

  const gold = Math.floor(totalCopper / 100);
  const remainingAfterGold = totalCopper % 100;

  const silver = Math.floor(remainingAfterGold / 10);
  const copper = remainingAfterGold % 10;

  const parts = [];

  if (gold > 0) parts.push(`${gold} gp`);
  if (silver > 0) parts.push(`${silver} sp`);
  if (copper > 0) parts.push(`${copper} cp`);

  return parts.join(', ');
}

export function formatCurrencyFromCopperShort(totalCopper: number): string {
  if (!totalCopper || totalCopper <= 0) return '0cp';

  const gold = Math.floor(totalCopper / 100);
  const remainingAfterGold = totalCopper % 100;

  const silver = Math.floor(remainingAfterGold / 10);
  const copper = remainingAfterGold % 10;

  const parts = [];

  if (gold > 0) parts.push(`${gold}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (copper > 0) parts.push(`${copper}c`);

  return parts.join(' ');
}

// Copper value of each coin denomination.
export const CURRENCY_VALUES = {
  platinum: 1000,
  gold: 100,
  electrum: 50,
  silver: 10,
  copper: 1,
} as const;

/** Total value of a purse expressed as integer copper. */
export function purseToCopper(purse: Currency): number {
  return (
    purse.platinum * CURRENCY_VALUES.platinum +
    purse.gold * CURRENCY_VALUES.gold +
    purse.electrum * CURRENCY_VALUES.electrum +
    purse.silver * CURRENCY_VALUES.silver +
    purse.copper * CURRENCY_VALUES.copper
  );
}

/** Whether a purse holds at least `copper` (integer) copper worth of coin. */
export function canAfford(purse: Currency, copper: number): boolean {
  return purseToCopper(purse) >= copper;
}

/**
 * Spends `copper` (integer) from a purse, returning the resulting purse or
 * `null` when the purse cannot cover the cost. Never a partial spend, never
 * negative coin counts.
 *
 * The purse never tracks which physical coins are consumed — only its total
 * value does. So spending is: fold the purse to a single integer-copper
 * total, subtract the cost, then re-denominate the remainder greedily from
 * the largest coin down (platinum, then gold, electrum, silver, copper),
 * taking as many of a denomination as fit before moving to the next. That
 * re-denomination is what "breaks" a large coin: if the remainder is smaller
 * than the coins on hand, the greedy pass simply expresses it using more of
 * the smaller denominations instead — e.g. a purse holding a single platinum
 * piece, after a 5 cp spend, comes back as 9 gold + 1 electrum + 4 silver +
 * 5 copper (995 cp), not a broken-open platinum plus loose change.
 */
export function spendCopper(purse: Currency, copper: number): Currency | null {
  const total = purseToCopper(purse);
  if (copper < 0 || copper > total) return null;

  let remaining = total - copper;

  const platinum = Math.floor(remaining / CURRENCY_VALUES.platinum);
  remaining -= platinum * CURRENCY_VALUES.platinum;

  const gold = Math.floor(remaining / CURRENCY_VALUES.gold);
  remaining -= gold * CURRENCY_VALUES.gold;

  const electrum = Math.floor(remaining / CURRENCY_VALUES.electrum);
  remaining -= electrum * CURRENCY_VALUES.electrum;

  const silver = Math.floor(remaining / CURRENCY_VALUES.silver);
  remaining -= silver * CURRENCY_VALUES.silver;

  const copperCoins = remaining;

  return { platinum, gold, electrum, silver, copper: copperCoins };
}
