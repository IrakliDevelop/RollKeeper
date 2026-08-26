import { describe, it, expect } from 'vitest';

import { ghostFootprintPx } from '../useRosterDrag';

import type { ToolContext } from '@fieldnotes/core';

const squareCtx = {
  gridType: 'square',
  gridSize: 40,
} as unknown as ToolContext;
const hexCtx = { gridType: 'hex', gridSize: 40 } as unknown as ToolContext;
const noGridCtx = {} as unknown as ToolContext;

describe('ghostFootprintPx', () => {
  it('returns cells × cellUnit × zoom on a square grid', () => {
    // cellUnit(squareCtx) resolves to gridSize (40) — 2 cells at zoom 1.5
    expect(ghostFootprintPx(2, squareCtx, 1.5)).toBe(120);
  });

  it('scales with zoom', () => {
    expect(ghostFootprintPx(1, squareCtx, 0.5)).toBe(20);
  });

  it('returns null for hex grids, missing grid, and missing context', () => {
    expect(ghostFootprintPx(2, hexCtx, 1)).toBeNull();
    expect(ghostFootprintPx(2, noGridCtx, 1)).toBeNull();
    expect(ghostFootprintPx(2, null, 1)).toBeNull();
  });
});
