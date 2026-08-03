import { describe, it, expect } from 'vitest';
import {
  applyShortRest,
  applyLongRest,
  isResourceDraftValid,
  isResourceCostValid,
  isValidResourceAmount,
  finalizeResourceDrafts,
  sanitizeEntryResourceCosts,
  stripDanglingResourceCosts,
  type NpcResourceDraft,
} from '@/utils/npcResources';
import type { NpcResource, StatBlockEntry } from '@/types/encounter';

function res(overrides: Partial<NpcResource> = {}): NpcResource {
  return {
    id: 'r1',
    name: 'Wild Shape',
    icon: 'paw-print',
    color: 'emerald',
    displayStyle: 'pips',
    maxUses: 4,
    usesExpended: 3,
    shortRestReset: 1,
    ...overrides,
  };
}

describe('applyShortRest', () => {
  it('restores up to n uses for numeric reset (partial restoration)', () => {
    const out = applyShortRest([res({ usesExpended: 3, shortRestReset: 1 })]);
    expect(out[0].usesExpended).toBe(2);
  });

  it('floors at 0 when n exceeds expended', () => {
    const out = applyShortRest([res({ usesExpended: 1, shortRestReset: 5 })]);
    expect(out[0].usesExpended).toBe(0);
  });

  it("zeroes expended for 'all'", () => {
    const out = applyShortRest([
      res({ usesExpended: 4, shortRestReset: 'all' }),
    ]);
    expect(out[0].usesExpended).toBe(0);
  });

  it('leaves 0-reset resources untouched', () => {
    const out = applyShortRest([res({ usesExpended: 2, shortRestReset: 0 })]);
    expect(out[0].usesExpended).toBe(2);
  });

  it('does not mutate the input array', () => {
    const input = [res({ usesExpended: 3, shortRestReset: 'all' })];
    applyShortRest(input);
    expect(input[0].usesExpended).toBe(3);
  });
});

describe('applyLongRest', () => {
  it('zeroes every resource regardless of shortRestReset', () => {
    const out = applyLongRest([
      res({ id: 'a', usesExpended: 3, shortRestReset: 0 }),
      res({ id: 'b', usesExpended: 2, shortRestReset: 'all' }),
    ]);
    expect(out.map(r => r.usesExpended)).toEqual([0, 0]);
  });
});

describe('isResourceDraftValid', () => {
  const draft = (o: Partial<NpcResourceDraft> = {}): NpcResourceDraft => ({
    ...res(),
    maxUses: 4,
    ...o,
  });

  it('accepts a named draft with positive integer maxUses', () => {
    expect(isResourceDraftValid(draft())).toBe(true);
  });

  it('rejects empty/whitespace name', () => {
    expect(isResourceDraftValid(draft({ name: '  ' }))).toBe(false);
  });

  it('rejects undefined, zero, negative, and fractional maxUses', () => {
    expect(isResourceDraftValid(draft({ maxUses: undefined }))).toBe(false);
    expect(isResourceDraftValid(draft({ maxUses: 0 }))).toBe(false);
    expect(isResourceDraftValid(draft({ maxUses: -2 }))).toBe(false);
    expect(isResourceDraftValid(draft({ maxUses: 1.5 }))).toBe(false);
  });

  it("accepts 'all', 0, and integers up to maxUses for shortRestReset", () => {
    expect(isResourceDraftValid(draft({ shortRestReset: 'all' }))).toBe(true);
    expect(isResourceDraftValid(draft({ shortRestReset: 0 }))).toBe(true);
    expect(isResourceDraftValid(draft({ maxUses: 4, shortRestReset: 4 }))).toBe(
      true
    );
  });

  it('rejects negative, fractional, and above-maxUses shortRestReset', () => {
    expect(isResourceDraftValid(draft({ shortRestReset: -1 }))).toBe(false);
    expect(isResourceDraftValid(draft({ shortRestReset: 1.5 }))).toBe(false);
    expect(isResourceDraftValid(draft({ maxUses: 4, shortRestReset: 5 }))).toBe(
      false
    );
  });
});

describe('finalizeResourceDrafts', () => {
  it('trims name and clamps usesExpended when maxUses was reduced', () => {
    const out = finalizeResourceDrafts([
      { ...res(), name: '  Rage ', maxUses: 2, usesExpended: 5 },
    ]);
    expect(out[0].name).toBe('Rage');
    expect(out[0].maxUses).toBe(2);
    expect(out[0].usesExpended).toBe(2);
  });

  it('normalizes shortRestReset into 0..maxUses and preserves valid values', () => {
    const out = finalizeResourceDrafts([
      { ...res(), maxUses: 4, shortRestReset: -2 },
      { ...res(), id: 'b', maxUses: 4, shortRestReset: 2.7 },
      { ...res(), id: 'c', maxUses: 4, shortRestReset: 9 },
      { ...res(), id: 'd', maxUses: 4, shortRestReset: 'all' },
      { ...res(), id: 'e', maxUses: 4, shortRestReset: 3 },
    ]);
    expect(out.map(r => r.shortRestReset)).toEqual([0, 2, 4, 'all', 3]);
  });
});

describe('stripDanglingResourceCosts', () => {
  const entries: StatBlockEntry[] = [
    {
      name: 'Bite',
      text: 'chomp',
      resourceCost: { resourceId: 'r1', amount: 1 },
    },
    {
      name: 'Roar',
      text: 'loud',
      resourceCost: { resourceId: 'gone', amount: 2 },
    },
    { name: 'Idle', text: 'nothing' },
  ];

  it('removes costs whose resource id is not in validIds, keeps the rest', () => {
    const out = stripDanglingResourceCosts(entries, new Set(['r1']));
    expect(out[0].resourceCost).toEqual({ resourceId: 'r1', amount: 1 });
    expect(out[1].resourceCost).toBeUndefined();
    expect(out[2].resourceCost).toBeUndefined();
    expect(out[1].name).toBe('Roar');
  });
});

describe('isValidResourceAmount', () => {
  it('accepts positive integers, rejects zero/negative/fractional/NaN', () => {
    expect(isValidResourceAmount(1)).toBe(true);
    expect(isValidResourceAmount(3)).toBe(true);
    expect(isValidResourceAmount(0)).toBe(false);
    expect(isValidResourceAmount(-2)).toBe(false);
    expect(isValidResourceAmount(1.5)).toBe(false);
    expect(isValidResourceAmount(NaN)).toBe(false);
  });
});

describe('isResourceCostValid', () => {
  const entry = (amount?: number): StatBlockEntry =>
    amount === undefined
      ? { name: 'Bite', text: 'chomp' }
      : {
          name: 'Bite',
          text: 'chomp',
          resourceCost: { resourceId: 'r1', amount },
        };

  it('accepts entries without a cost and costs with positive integer amounts', () => {
    expect(isResourceCostValid(entry())).toBe(true);
    expect(isResourceCostValid(entry(1))).toBe(true);
    expect(isResourceCostValid(entry(4))).toBe(true);
  });

  it('rejects zero, negative, and fractional amounts', () => {
    expect(isResourceCostValid(entry(0))).toBe(false);
    expect(isResourceCostValid(entry(-1))).toBe(false);
    expect(isResourceCostValid(entry(2.5))).toBe(false);
  });
});

describe('sanitizeEntryResourceCosts', () => {
  it('normalizes invalid amounts to 1 and leaves valid costs untouched', () => {
    const out = sanitizeEntryResourceCosts([
      { name: 'A', text: '', resourceCost: { resourceId: 'r1', amount: 0 } },
      { name: 'B', text: '', resourceCost: { resourceId: 'r1', amount: -3 } },
      { name: 'C', text: '', resourceCost: { resourceId: 'r1', amount: 2.5 } },
      { name: 'D', text: '', resourceCost: { resourceId: 'r1', amount: 2 } },
      { name: 'E', text: '' },
    ]);
    expect(out[0].resourceCost!.amount).toBe(1);
    expect(out[1].resourceCost!.amount).toBe(1);
    expect(out[2].resourceCost!.amount).toBe(1);
    expect(out[3].resourceCost!.amount).toBe(2);
    expect(out[4].resourceCost).toBeUndefined();
  });
});
