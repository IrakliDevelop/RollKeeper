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

// Denominations ascending by value — the order `spendCopper` pays from.
const ASCENDING_DENOMINATIONS: (keyof Currency)[] = [
  'copper',
  'silver',
  'electrum',
  'gold',
  'platinum',
];

/**
 * Pays as much of `owed` as possible using only whole coins already in
 * `coins`, smallest denomination first. Mutates `coins` in place and
 * returns whatever portion of `owed` remains unpaid (0 once fully paid
 * without needing to break any coin).
 */
function payFromCoinsOnHand(coins: Currency, owed: number): number {
  let remainingOwed = owed;
  for (const denom of ASCENDING_DENOMINATIONS) {
    if (remainingOwed <= 0) break;
    const value = CURRENCY_VALUES[denom];
    const use = Math.min(coins[denom], Math.floor(remainingOwed / value));
    coins[denom] -= use;
    remainingOwed -= use * value;
  }
  return remainingOwed;
}

/**
 * What breaking one coin of a given denomination yields. Ruling R11: coin
 * math never *manufactures* electrum by breaking a larger coin — electrum
 * is only ever spent when the purse already holds it. So gold breaks into
 * silver and platinum into gold, skipping straight past electrum; breaking
 * an *existing* electrum coin (spending it down further) still yields
 * silver as normal, since that doesn't create any new electrum.
 */
const BREAK_TARGET: Record<
  Exclude<keyof Currency, 'copper'>,
  keyof Currency
> = {
  silver: 'copper',
  electrum: 'silver',
  gold: 'silver',
  platinum: 'gold',
};

/**
 * Breaks the smallest denomination coin on hand larger than copper into
 * coins of its `BREAK_TARGET` denomination. Returns false when there is
 * nothing left to break.
 */
function breakSmallestAvailableCoin(coins: Currency): boolean {
  for (let i = 1; i < ASCENDING_DENOMINATIONS.length; i++) {
    const denom = ASCENDING_DENOMINATIONS[i];
    if (denom === 'copper') continue;
    if (coins[denom] > 0) {
      const lowerDenom = BREAK_TARGET[denom];
      const coinsFromBreak =
        CURRENCY_VALUES[denom] / CURRENCY_VALUES[lowerDenom];
      coins[denom] -= 1;
      coins[lowerDenom] += coinsFromBreak;
      return true;
    }
  }
  return false;
}

/**
 * Spends `copper` (integer) from a purse, returning the resulting purse or
 * `null` when the purse cannot cover the cost. Never a partial spend, never
 * negative coin counts.
 *
 * Pays greedily from the smallest denomination up, using only the coins
 * actually on hand, and breaks a larger coin only when the smaller ones
 * can't cover what's still owed — one coin at a time, immediately down to
 * the next denomination, then retrying the payment before breaking again if
 * needed. Coins the spend never needed to touch come back untouched: e.g.
 * `{silver: 7, copper: 8}` spending 5 cp pays from the copper on hand and
 * returns `{silver: 7, copper: 3}`, not a re-denominated purse. A purse
 * holding only `{platinum: 1}` spending 5 cp has nothing smaller to pay
 * with, so it cascades platinum -> gold -> silver -> copper one break at a
 * time until there's enough small change, landing on
 * `{gold: 9, silver: 9, copper: 5}` (995 cp) — electrum is skipped as a
 * break target (ruling R11: breaking a coin never manufactures electrum,
 * though electrum already in the purse is still spent normally).
 */
export function spendCopper(purse: Currency, copper: number): Currency | null {
  const total = purseToCopper(purse);
  if (copper < 0 || copper > total) return null;
  if (copper === 0) return { ...purse };

  const coins: Currency = { ...purse };
  let owed = payFromCoinsOnHand(coins, copper);

  while (owed > 0) {
    if (!breakSmallestAvailableCoin(coins)) return null;
    owed = payFromCoinsOnHand(coins, owed);
  }

  return coins;
}

// Denominations used to mint a fresh credit, largest value first. Skips
// electrum, mirroring ruling R11 (`BREAK_TARGET` above): minting new coins
// for an incoming credit must never manufacture electrum either — a purse
// only ever gains electrum by already holding it, never by conjuring it from
// a lump sum of copper.
const DESCENDING_MINT_DENOMINATIONS: (keyof Currency)[] = [
  'platinum',
  'gold',
  'silver',
  'copper',
];

/**
 * Credits `copper` (integer) onto a purse — the natural counterpart to
 * `spendCopper`, and this module's second consumer (a shop sale crediting an
 * NPC's till in `useDmShopSalesSync`).
 *
 * Mints whole coins largest-denomination-first (platinum -> gold -> silver
 * -> copper, skipping electrum per ruling R11) and adds them on top of
 * whatever the purse already holds. Where `spendCopper` pays smallest-first
 * so it never disturbs large coins already on hand, `creditCopper` mints
 * largest-first so a sizeable sale doesn't dump the whole price into a pile
 * of copper pieces; existing coins (including any electrum already in the
 * purse) are never touched, only added to.
 *
 * Non-integer or negative `copper` is a no-op — returns a shallow copy of
 * `purse`, never throws, never partially credits. Callers
 * (`useDmShopSalesSync`) validate `ShopSale.copper` before calling this; the
 * guard here just keeps the helper safe to call defensively on its own.
 */
export function creditCopper(purse: Currency, copper: number): Currency {
  if (!Number.isInteger(copper) || copper <= 0) return { ...purse };

  const next: Currency = { ...purse };
  let remaining = copper;
  for (const denom of DESCENDING_MINT_DENOMINATIONS) {
    if (denom === 'copper') {
      next.copper += remaining;
      remaining = 0;
      break;
    }
    const value = CURRENCY_VALUES[denom];
    const count = Math.floor(remaining / value);
    next[denom] += count;
    remaining -= count * value;
  }
  return next;
}
