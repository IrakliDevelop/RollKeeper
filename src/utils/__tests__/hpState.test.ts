import { describe, it, expect } from 'vitest';
import {
  HP_STATUS_LABELS,
  hpPercent,
  hpStateLabel,
  hpStatus,
  hpTier,
  resolveEntryHpMode,
} from '../hpState';
import { DEFAULT_HP_STATE_BANDS } from '@/types/encounter';

describe('hpPercent', () => {
  it('computes a clamped 0-100 percentage', () => {
    expect(hpPercent(60, 120)).toBe(50);
    expect(hpPercent(120, 120)).toBe(100);
    expect(hpPercent(-5, 120)).toBe(0);
    expect(hpPercent(10, 0)).toBe(0); // guard divide-by-zero
  });
});

describe('hpTier', () => {
  it('is high from 75% up, inclusive', () => {
    expect(hpTier(100)).toBe('high');
    expect(hpTier(75)).toBe('high');
    expect(hpTier(74.9)).toBe('mid');
  });

  it('is mid from 50%, low from 25%, inclusive', () => {
    expect(hpTier(50)).toBe('mid');
    expect(hpTier(49.9)).toBe('low');
    expect(hpTier(25)).toBe('low');
    expect(hpTier(24.9)).toBe('critical');
  });

  it('is critical down to 0', () => {
    expect(hpTier(0.5)).toBe('critical');
    expect(hpTier(0)).toBe('critical');
  });
});

describe('hpStatus', () => {
  it('maps the tiers to healthy, bloodied and critical', () => {
    expect(hpStatus(30, 40)).toBe('healthy'); // 75%
    expect(hpStatus(29, 40)).toBe('bloodied'); // 72.5%
    expect(hpStatus(10, 40)).toBe('bloodied'); // 25%
    expect(hpStatus(9, 40)).toBe('critical'); // 22.5%
  });

  it('is down at 0 HP or below, and critical while any HP is left', () => {
    expect(hpStatus(0, 40)).toBe('down');
    expect(hpStatus(-3, 40)).toBe('down');
    expect(hpStatus(1, 200)).toBe('critical'); // 0.5%
  });

  it('is down when there is no max and no HP', () => {
    expect(hpStatus(0, 0)).toBe('down');
  });

  it('has a word for every status', () => {
    expect(HP_STATUS_LABELS).toEqual({
      healthy: 'Healthy',
      bloodied: 'Bloodied',
      critical: 'Critical',
      down: 'Down',
    });
  });
});

describe('hpStateLabel', () => {
  const bands = DEFAULT_HP_STATE_BANDS;

  it('defaults to the HP tier words', () => {
    expect(bands).toEqual([
      { minPercent: 75, label: 'Healthy' },
      { minPercent: 25, label: 'Bloodied' },
      { minPercent: 0, label: 'Critical' },
    ]);
  });

  it('picks the default band for the current percentage', () => {
    expect(hpStateLabel(120, 120, bands)).toBe('Healthy'); // 100%
    expect(hpStateLabel(90, 120, bands)).toBe('Healthy'); // 75%
    expect(hpStateLabel(89, 120, bands)).toBe('Bloodied'); // ~74%
    expect(hpStateLabel(30, 120, bands)).toBe('Bloodied'); // 25%
    expect(hpStateLabel(29, 120, bands)).toBe('Critical'); // ~24%
  });

  it('agrees with the status word at every whole percentage', () => {
    // hpStatus derives from hpTier, so the default band word and the tier's
    // colour can't drift apart.
    for (let current = 1; current <= 100; current++) {
      expect(hpStateLabel(current, 100, bands)).toBe(
        HP_STATUS_LABELS[hpStatus(current, 100)]
      );
    }
  });

  it('keeps a living creature on 1 of 200 HP out of any 0 HP word', () => {
    expect(hpStateLabel(1, 200, bands)).toBe('Critical'); // 0.5%
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

describe('resolveEntryHpMode', () => {
  it('prefers the per-entry override over the state-level mode', () => {
    expect(resolveEntryHpMode({ hpMode: 'exact' }, 'off')).toBe('exact');
    expect(resolveEntryHpMode({ hpMode: 'exact' }, 'label')).toBe('exact');
    expect(resolveEntryHpMode({ hpMode: 'percent' }, 'bar')).toBe('percent');
  });

  it('falls back to the state-level mode when the entry has no override (old payloads)', () => {
    expect(resolveEntryHpMode({}, 'off')).toBe('off');
    expect(resolveEntryHpMode({}, 'label')).toBe('label');
    expect(resolveEntryHpMode({ hpMode: undefined }, 'exact')).toBe('exact');
  });
});
