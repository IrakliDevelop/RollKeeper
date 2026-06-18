import { describe, it, expect } from 'vitest';
import { hpPercent, hpStateLabel } from '../hpState';
import { DEFAULT_HP_STATE_BANDS } from '@/types/encounter';

describe('hpPercent', () => {
  it('computes a clamped 0-100 percentage', () => {
    expect(hpPercent(60, 120)).toBe(50);
    expect(hpPercent(120, 120)).toBe(100);
    expect(hpPercent(-5, 120)).toBe(0);
    expect(hpPercent(10, 0)).toBe(0); // guard divide-by-zero
  });
});

describe('hpStateLabel', () => {
  const bands = DEFAULT_HP_STATE_BANDS;

  it('returns the full-health label at 100%', () => {
    expect(hpStateLabel(120, 120, bands)).toBe('Unharmed');
  });

  it('returns the down label at 0 HP', () => {
    expect(hpStateLabel(0, 120, bands)).toBe('Down');
  });

  it('picks the band for the current percentage', () => {
    expect(hpStateLabel(100, 120, bands)).toBe('Healthy'); // ~83%
    expect(hpStateLabel(60, 120, bands)).toBe('Injured'); // 50%
    expect(hpStateLabel(40, 120, bands)).toBe('Bloodied'); // ~33%
    expect(hpStateLabel(6, 120, bands)).toBe('Near Death'); // 5%
  });

  it('is order-independent (sorts bands internally)', () => {
    const shuffled = [
      { minPercent: 0, label: 'Down' },
      { minPercent: 50, label: 'Half' },
      { minPercent: 100, label: 'Full' },
    ];
    expect(hpStateLabel(120, 120, shuffled)).toBe('Full');
    expect(hpStateLabel(30, 120, shuffled)).toBe('Down'); // 25% -> below 50 band
    expect(hpStateLabel(72, 120, shuffled)).toBe('Half'); // 60%
  });

  it('returns empty string when no bands are configured', () => {
    expect(hpStateLabel(50, 120, [])).toBe('');
  });
});
