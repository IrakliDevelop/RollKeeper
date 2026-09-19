import { describe, it, expect } from 'vitest';
import { Skull, TrendingDown } from 'lucide-react';
import {
  CONDITION_ICON_NAMES,
  CONDITION_ICON_REGISTRY,
  DEFAULT_CONDITION_ICON_BY_KIND,
  isConditionIconName,
} from '../conditionIconRegistry';

describe('conditionIconRegistry', () => {
  it('lists a curated set of unique kebab-case names', () => {
    expect(CONDITION_ICON_NAMES.length).toBe(80);
    expect(new Set(CONDITION_ICON_NAMES).size).toBe(
      CONDITION_ICON_NAMES.length
    );
    for (const name of CONDITION_ICON_NAMES) {
      expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it('maps every name to a real lucide component', () => {
    for (const name of CONDITION_ICON_NAMES) {
      expect(CONDITION_ICON_REGISTRY[name], name).toBeDefined();
    }
    expect(Object.keys(CONDITION_ICON_REGISTRY).sort()).toEqual(
      [...CONDITION_ICON_NAMES].sort()
    );
    expect(CONDITION_ICON_REGISTRY.skull).toBe(Skull);
  });

  it('guards arbitrary values arriving over sync', () => {
    expect(isConditionIconName('skull')).toBe(true);
    expect(isConditionIconName('heart-crack')).toBe(true);
    expect(isConditionIconName('Skull')).toBe(false);
    expect(isConditionIconName('not-an-icon')).toBe(false);
    expect(isConditionIconName('')).toBe(false);
    expect(isConditionIconName(undefined)).toBe(false);
    expect(isConditionIconName(null)).toBe(false);
    expect(isConditionIconName(7)).toBe(false);
    expect(isConditionIconName('constructor')).toBe(false);
  });

  it('exposes a registered default icon per kind', () => {
    expect(DEFAULT_CONDITION_ICON_BY_KIND).toEqual({
      buff: 'trending-up',
      debuff: 'trending-down',
      neutral: 'circle-dot',
    });
    expect(CONDITION_ICON_REGISTRY[DEFAULT_CONDITION_ICON_BY_KIND.debuff]).toBe(
      TrendingDown
    );
  });
});
