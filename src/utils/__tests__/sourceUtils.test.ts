import { describe, it, expect } from 'vitest';
import {
  formatSourceForDisplay,
  shouldReplaceSource,
  deduplicateBySourcePriority,
  getSourceEdition,
  is2024Source,
  is2014Source,
  compareSourcePriority,
} from '@/utils/sourceUtils';

describe('formatSourceForDisplay', () => {
  it('converts XPHB to PHB2024', () => {
    expect(formatSourceForDisplay('XPHB')).toBe('PHB2024');
  });

  it('returns other sources unchanged', () => {
    expect(formatSourceForDisplay('PHB')).toBe('PHB');
    expect(formatSourceForDisplay('SRD')).toBe('SRD');
    expect(formatSourceForDisplay('DMG')).toBe('DMG');
    expect(formatSourceForDisplay('PHB2024')).toBe('PHB2024');
  });
});

describe('shouldReplaceSource', () => {
  it('always replaces with PHB2024', () => {
    expect(shouldReplaceSource('PHB', 'PHB2024')).toBe(true);
    expect(shouldReplaceSource('SRD', 'PHB2024')).toBe(true);
    expect(shouldReplaceSource('DMG', 'PHB2024')).toBe(true);
  });

  it('does not replace PHB2024 with anything else', () => {
    expect(shouldReplaceSource('PHB2024', 'PHB')).toBe(false);
    expect(shouldReplaceSource('PHB2024', 'SRD')).toBe(false);
    expect(shouldReplaceSource('PHB2024', 'DMG')).toBe(false);
  });

  it('prefers SRD when existing is not SRD', () => {
    expect(shouldReplaceSource('PHB', 'DMG', false, true)).toBe(true);
  });

  it('does not replace SRD with non-SRD', () => {
    expect(shouldReplaceSource('PHB', 'DMG', true, false)).toBe(false);
  });

  it('prefers PHB over other non-SRD sources', () => {
    expect(shouldReplaceSource('DMG', 'PHB')).toBe(true);
  });

  it('does not replace PHB with non-priority source', () => {
    expect(shouldReplaceSource('PHB', 'DMG')).toBe(false);
  });

  it('returns false for same-priority sources (e.g. DMG vs SCAG)', () => {
    expect(shouldReplaceSource('DMG', 'SCAG')).toBe(false);
  });
});

describe('deduplicateBySourcePriority', () => {
  it('returns an empty array for empty input', () => {
    expect(deduplicateBySourcePriority([])).toEqual([]);
  });

  it('keeps the only item when there is no duplication', () => {
    const items = [{ name: 'Fireball', source: 'PHB' }];
    expect(deduplicateBySourcePriority(items)).toEqual(items);
  });

  it('prefers PHB2024 version over PHB version', () => {
    const items = [
      { name: 'Fireball', source: 'PHB' },
      { name: 'Fireball', source: 'PHB2024' },
    ];
    const result = deduplicateBySourcePriority(items);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('PHB2024');
  });

  it('keeps PHB2024 even when encountered first', () => {
    const items = [
      { name: 'Fireball', source: 'PHB2024' },
      { name: 'Fireball', source: 'PHB' },
    ];
    const result = deduplicateBySourcePriority(items);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('PHB2024');
  });

  it('keeps distinct names as separate entries', () => {
    const items = [
      { name: 'Fireball', source: 'PHB' },
      { name: 'Ice Storm', source: 'PHB' },
    ];
    expect(deduplicateBySourcePriority(items)).toHaveLength(2);
  });

  it('uses a custom key function when provided', () => {
    const items = [
      { name: 'Fireball', source: 'PHB', level: 3 },
      { name: 'fireball', source: 'PHB2024', level: 3 },
    ];
    // Default key is name.toLowerCase(), so these are duplicates
    const result = deduplicateBySourcePriority(items);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('PHB2024');
  });

  it('respects isSrd flag in priority resolution', () => {
    const items = [
      { name: 'Spell', source: 'DMG', isSrd: false },
      { name: 'Spell', source: 'SRD', isSrd: true },
    ];
    const result = deduplicateBySourcePriority(items);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('SRD');
  });
});

describe('getSourceEdition', () => {
  it('returns "2024" for PHB2024', () => {
    expect(getSourceEdition('PHB2024')).toBe('2024');
  });

  it('returns "2024" for XPHB', () => {
    expect(getSourceEdition('XPHB')).toBe('2024');
  });

  it('returns "2014" for PHB', () => {
    expect(getSourceEdition('PHB')).toBe('2014');
  });

  it('returns "SRD" for SRD source', () => {
    expect(getSourceEdition('SRD')).toBe('SRD');
  });

  it('returns "Other" for unknown sources', () => {
    expect(getSourceEdition('DMG')).toBe('Other');
    expect(getSourceEdition('SCAG')).toBe('Other');
  });
});

describe('is2024Source', () => {
  it('returns true for XPHB', () => {
    expect(is2024Source('XPHB')).toBe(true);
  });

  it('returns true for PHB2024', () => {
    expect(is2024Source('PHB2024')).toBe(true);
  });

  it('returns false for PHB (2014)', () => {
    expect(is2024Source('PHB')).toBe(false);
  });

  it('returns false for SRD', () => {
    expect(is2024Source('SRD')).toBe(false);
  });

  it('returns false for other sources', () => {
    expect(is2024Source('DMG')).toBe(false);
  });
});

describe('is2014Source', () => {
  it('returns true for PHB', () => {
    expect(is2014Source('PHB')).toBe(true);
  });

  it('returns false for PHB2024', () => {
    expect(is2014Source('PHB2024')).toBe(false);
  });

  it('returns false for XPHB', () => {
    expect(is2014Source('XPHB')).toBe(false);
  });

  it('returns false for SRD', () => {
    expect(is2014Source('SRD')).toBe(false);
  });

  it('returns false for other sources', () => {
    expect(is2014Source('DMG')).toBe(false);
  });
});

describe('compareSourcePriority', () => {
  it('PHB2024 sorts before SRD', () => {
    expect(compareSourcePriority('PHB2024', 'SRD')).toBeLessThan(0);
  });

  it('PHB2024 sorts before PHB', () => {
    expect(compareSourcePriority('PHB2024', 'PHB')).toBeLessThan(0);
  });

  it('PHB2024 sorts before other sources', () => {
    expect(compareSourcePriority('PHB2024', 'DMG')).toBeLessThan(0);
  });

  it('SRD sorts after PHB2024', () => {
    expect(compareSourcePriority('SRD', 'PHB2024')).toBeGreaterThan(0);
  });

  it('SRD sorts before PHB', () => {
    expect(compareSourcePriority('SRD', 'PHB')).toBeLessThan(0);
  });

  it('SRD sorts before other non-priority sources', () => {
    expect(compareSourcePriority('SRD', 'DMG')).toBeLessThan(0);
  });

  it('PHB sorts before non-priority sources', () => {
    expect(compareSourcePriority('PHB', 'DMG')).toBeLessThan(0);
  });

  it('PHB sorts after SRD', () => {
    expect(compareSourcePriority('PHB', 'SRD')).toBeGreaterThan(0);
  });

  it('equal-priority sources are sorted alphabetically', () => {
    const result = compareSourcePriority('DMG', 'SCAG');
    expect(result).toBe('DMG'.localeCompare('SCAG'));
  });

  it('returns 0 for the same source', () => {
    expect(compareSourcePriority('PHB2024', 'PHB2024')).toBe(0);
    expect(compareSourcePriority('SRD', 'SRD')).toBe(0);
  });
});
