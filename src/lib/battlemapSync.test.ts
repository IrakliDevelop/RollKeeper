import { describe, it, expect } from 'vitest';
import type { CanvasElement } from '@fieldnotes/core';
import { computeSeedIds } from '@/lib/battlemapSync';

const el = (id: string) => ({ id }) as CanvasElement;

describe('computeSeedIds', () => {
  it('returns ids of local elements missing from the snapshot', () => {
    expect(computeSeedIds([el('a'), el('b'), el('c')], new Set(['b']))).toEqual(
      ['a', 'c']
    );
  });
  it('returns empty when snapshot covers everything', () => {
    expect(computeSeedIds([el('a')], new Set(['a']))).toEqual([]);
  });
  it('returns everything for an empty room', () => {
    expect(computeSeedIds([el('a'), el('b')], new Set())).toEqual(['a', 'b']);
  });
});
