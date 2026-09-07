import { describe, it, expect } from 'vitest';
import {
  formatCurrencyFromCopper,
  formatCurrencyFromCopperShort,
  CURRENCY_VALUES,
  purseToCopper,
  canAfford,
  spendCopper,
} from '@/utils/currency';
import type { Currency } from '@/types/character';

const purse = (overrides: Partial<Currency> = {}): Currency => ({
  copper: 0,
  silver: 0,
  electrum: 0,
  gold: 0,
  platinum: 0,
  ...overrides,
});

describe('formatCurrencyFromCopper', () => {
  it('returns "0 cp" for zero', () => {
    expect(formatCurrencyFromCopper(0)).toBe('0 cp');
  });

  it('returns "0 cp" for negative values', () => {
    expect(formatCurrencyFromCopper(-5)).toBe('0 cp');
  });

  it('returns copper only for small amounts', () => {
    expect(formatCurrencyFromCopper(5)).toBe('5 cp');
  });

  it('returns silver and copper for amounts 10-99', () => {
    expect(formatCurrencyFromCopper(35)).toBe('3 sp, 5 cp');
  });

  it('returns silver only when no copper remainder', () => {
    expect(formatCurrencyFromCopper(20)).toBe('2 sp');
  });

  it('returns gold only for exact 100-copper multiples', () => {
    expect(formatCurrencyFromCopper(100)).toBe('1 gp');
  });

  it('returns gold and silver and copper for mixed amounts', () => {
    expect(formatCurrencyFromCopper(1234)).toBe('12 gp, 3 sp, 4 cp');
  });

  it('returns gold and copper with no silver when silver remainder is 0', () => {
    expect(formatCurrencyFromCopper(1004)).toBe('10 gp, 4 cp');
  });

  it('handles large gold amounts', () => {
    expect(formatCurrencyFromCopper(10000)).toBe('100 gp');
  });
});

describe('formatCurrencyFromCopperShort', () => {
  it('returns "0cp" for zero', () => {
    expect(formatCurrencyFromCopperShort(0)).toBe('0cp');
  });

  it('returns "0cp" for negative values', () => {
    expect(formatCurrencyFromCopperShort(-1)).toBe('0cp');
  });

  it('returns compact copper format', () => {
    expect(formatCurrencyFromCopperShort(5)).toBe('5c');
  });

  it('returns compact silver and copper format', () => {
    expect(formatCurrencyFromCopperShort(35)).toBe('3s 5c');
  });

  it('returns compact gold only for exact 100-copper multiples', () => {
    expect(formatCurrencyFromCopperShort(100)).toBe('1g');
  });

  it('returns compact gold silver copper for mixed amounts', () => {
    expect(formatCurrencyFromCopperShort(1234)).toBe('12g 3s 4c');
  });

  it('returns compact silver only when no copper remainder', () => {
    expect(formatCurrencyFromCopperShort(20)).toBe('2s');
  });
});

describe('CURRENCY_VALUES', () => {
  it('matches the D&D 5e copper-per-coin table', () => {
    expect(CURRENCY_VALUES).toEqual({
      platinum: 1000,
      gold: 100,
      electrum: 50,
      silver: 10,
      copper: 1,
    });
  });
});

describe('purseToCopper', () => {
  it('converts a single-denomination purse', () => {
    expect(purseToCopper(purse({ copper: 5 }))).toBe(5);
  });

  it('sums a mixed purse: 3 gp / 40 sp / 1 pp', () => {
    expect(purseToCopper(purse({ gold: 3, silver: 40, platinum: 1 }))).toBe(
      1700
    );
  });

  it('returns 0 for an all-zero purse', () => {
    expect(purseToCopper(purse())).toBe(0);
  });
});

describe('canAfford', () => {
  it('is true when the purse total meets the cost', () => {
    expect(canAfford(purse({ gold: 1 }), 100)).toBe(true);
  });

  it('is true when the purse total exceeds the cost', () => {
    expect(canAfford(purse({ gold: 2 }), 100)).toBe(true);
  });

  it('is false when the purse total is short of the cost', () => {
    expect(canAfford(purse({ gold: 1 }), 101)).toBe(false);
  });

  it('is true for a 0 cost against an empty purse', () => {
    expect(canAfford(purse(), 0)).toBe(true);
  });
});

describe('spendCopper', () => {
  it('3 gp / 40 sp / 1 pp → 12 gp equivalent', () => {
    // 1700 cp total; spending 500 cp (5 gp) leaves 1200 cp = 12 gp equivalent,
    // re-denominated as 1 pp + 2 gp rather than the original 3 gp/40 sp/1 pp.
    const result = spendCopper(
      purse({ gold: 3, silver: 40, platinum: 1 }),
      500
    );
    expect(result).toEqual(purse({ platinum: 1, gold: 2 }));
    expect(purseToCopper(result as Currency)).toBe(1200);
  });

  it('exact change: spending the entire purse leaves all zeros', () => {
    const result = spendCopper(purse({ gold: 5 }), 500);
    expect(result).toEqual(purse());
  });

  it('breaking a platinum: no smaller coins on hand forces a full re-denomination', () => {
    const result = spendCopper(purse({ platinum: 1 }), 5);
    expect(result).toEqual(
      purse({ gold: 9, electrum: 1, silver: 4, copper: 5 })
    );
    expect(purseToCopper(result as Currency)).toBe(995);
  });

  it('insufficient funds: returns null instead of a partial spend', () => {
    const result = spendCopper(purse({ gold: 1 }), 101);
    expect(result).toBeNull();
  });

  it('spending 0 returns the purse unchanged in value and composition', () => {
    const start = purse({ gold: 2, electrum: 1, copper: 3 });
    const result = spendCopper(start, 0);
    expect(result).toEqual(start);
  });

  it('handles a purse with missing/zero denominations', () => {
    const empty = purse();
    expect(spendCopper(empty, 0)).toEqual(empty);
    expect(spendCopper(empty, 1)).toBeNull();
  });
});
