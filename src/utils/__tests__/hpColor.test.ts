import { describe, it, expect } from 'vitest';
import {
  getHpBarColor,
  getHpNumberColor,
  getHpTierBarColor,
  getHpTierNumberColor,
  getHpTierTextColor,
} from '../hpColor';

describe('getHpTierBarColor', () => {
  it('maps tiers to role fills; mid and low are both ember', () => {
    expect(getHpTierBarColor('high')).toBe('bg-verdigris-fill');
    expect(getHpTierBarColor('mid')).toBe('bg-ember-fill');
    expect(getHpTierBarColor('low')).toBe('bg-ember-fill');
    expect(getHpTierBarColor('critical')).toBe('bg-blood-fill');
  });
});

describe('getHpTierTextColor', () => {
  it('maps tiers to role text for status words', () => {
    expect(getHpTierTextColor('high')).toBe('text-verdigris-text');
    expect(getHpTierTextColor('mid')).toBe('text-ember-text');
    expect(getHpTierTextColor('low')).toBe('text-ember-text');
    expect(getHpTierTextColor('critical')).toBe('text-blood-text');
  });
});

describe('getHpTierNumberColor', () => {
  it('keeps a healthy HP number in the heading colour', () => {
    expect(getHpTierNumberColor('high')).toBe('text-heading');
    expect(getHpTierNumberColor('mid')).toBe('text-ember-text');
    expect(getHpTierNumberColor('low')).toBe('text-ember-text');
    expect(getHpTierNumberColor('critical')).toBe('text-blood-text');
  });
});

describe('getHpBarColor', () => {
  it('uses the 75/50/25 tiers, thresholds inclusive', () => {
    expect(getHpBarColor(40, 40)).toBe('bg-verdigris-fill');
    expect(getHpBarColor(30, 40)).toBe('bg-verdigris-fill'); // 75%
    expect(getHpBarColor(29, 40)).toBe('bg-ember-fill');
    expect(getHpBarColor(10, 40)).toBe('bg-ember-fill'); // 25%
    expect(getHpBarColor(9, 40)).toBe('bg-blood-fill');
    expect(getHpBarColor(0, 40)).toBe('bg-blood-fill');
  });

  it('falls back to a neutral token when max is 0', () => {
    expect(getHpBarColor(0, 0)).toBe('bg-surface-secondary');
  });
});

describe('getHpNumberColor', () => {
  it('is heading from 75%, ember from 25%, blood below', () => {
    expect(getHpNumberColor(15, 20)).toBe('text-heading'); // 75%
    expect(getHpNumberColor(14, 20)).toBe('text-ember-text');
    expect(getHpNumberColor(5, 20)).toBe('text-ember-text'); // 25%
    expect(getHpNumberColor(4, 20)).toBe('text-blood-text');
    expect(getHpNumberColor(0, 20)).toBe('text-blood-text');
  });

  it('is blood when max is 0 (no false all-clear)', () => {
    expect(getHpNumberColor(0, 0)).toBe('text-blood-text');
  });
});
