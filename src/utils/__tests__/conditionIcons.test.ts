import { describe, it, expect } from 'vitest';
import {
  Biohazard,
  ChevronsDown,
  CircleDot,
  Skull,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { getConditionIcon } from '../conditionIcons';

describe('getConditionIcon', () => {
  it('resolves canonical 5e condition names case-insensitively', () => {
    expect(getConditionIcon('Poisoned')).toBe(Biohazard);
    expect(getConditionIcon('poisoned')).toBe(Biohazard);
    expect(getConditionIcon('  PRONE  ')).toBe(ChevronsDown);
  });

  it('strips a trailing parenthetical (e.g. exhaustion levels)', () => {
    expect(getConditionIcon('Exhaustion (3)')).toBe(
      getConditionIcon('Exhaustion')
    );
  });

  it('falls back by kind for unknown names', () => {
    expect(getConditionIcon("Hunter's Mark", 'debuff')).toBe(TrendingDown);
    expect(getConditionIcon('Heroism', 'buff')).toBe(TrendingUp);
    expect(getConditionIcon('Marked', 'neutral')).toBe(CircleDot);
  });

  it('defaults unknown names with no kind to the neutral glyph', () => {
    expect(getConditionIcon('Totally Homebrew')).toBe(CircleDot);
  });

  it('lets a valid registry icon win over the name/kind lookup', () => {
    expect(getConditionIcon('Poisoned', 'debuff', 'skull')).toBe(Skull);
    expect(getConditionIcon('Totally Homebrew', 'buff', 'skull')).toBe(Skull);
  });

  it('falls back to the name/kind lookup for an invalid or absent icon', () => {
    expect(getConditionIcon('Poisoned', 'debuff', 'not-an-icon')).toBe(
      Biohazard
    );
    expect(getConditionIcon('Cursed', 'debuff', 'Skull')).toBe(TrendingDown);
    expect(getConditionIcon('Cursed', 'debuff', '')).toBe(TrendingDown);
    expect(getConditionIcon('Cursed', 'debuff', undefined)).toBe(TrendingDown);
  });
});
