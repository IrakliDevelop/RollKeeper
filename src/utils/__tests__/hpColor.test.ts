import { describe, it, expect } from 'vitest';
import { getHpBarColor, getHpTierBarColor } from '../hpColor';

describe('getHpBarColor', () => {
  it('is green above 50%', () => {
    expect(getHpBarColor(30, 50)).toContain('green');
  });

  it('is amber between 25% and 50%', () => {
    expect(getHpBarColor(20, 50)).toContain('amber');
  });

  it('is red at or below 25%', () => {
    expect(getHpBarColor(10, 50)).toContain('red');
  });

  it('falls back to a neutral token when max is 0', () => {
    expect(getHpBarColor(0, 0)).toBe('bg-surface-secondary');
  });
});

describe('getHpTierBarColor', () => {
  it('maps each tier to a distinct bar fill', () => {
    const classes = (['high', 'mid', 'low', 'critical'] as const).map(
      getHpTierBarColor
    );
    expect(new Set(classes).size).toBe(4);
    expect(classes[0]).toContain('green');
    expect(classes[3]).toContain('red');
  });
});
