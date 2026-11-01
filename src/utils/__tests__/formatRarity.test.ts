import { describe, expect, it } from 'vitest';
import { formatRarity } from '../formatRarity';

describe('formatRarity', () => {
  it('uses sentence case for every rarity', () => {
    expect(formatRarity('common')).toBe('Common');
    expect(formatRarity('very rare')).toBe('Very rare');
    expect(formatRarity('Very Rare')).toBe('Very rare');
    expect(formatRarity('')).toBe('');
  });
});
