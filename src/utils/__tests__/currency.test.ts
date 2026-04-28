import { describe, it, expect } from 'vitest';
import {
  formatCurrencyFromCopper,
  formatCurrencyFromCopperShort,
} from '@/utils/currency';

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
