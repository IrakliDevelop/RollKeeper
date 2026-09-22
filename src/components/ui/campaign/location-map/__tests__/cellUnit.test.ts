import { describe, it, expect } from 'vitest';
import { cellUnit } from '@/components/ui/campaign/location-map/cellUnit';

import type { ToolContext } from '@fieldnotes/core';

function ctx(gridType?: 'square' | 'hex', cellSize?: number): ToolContext {
  return {
    constraintService: {
      getConstraintInfo: () => ({ gridType, cellSize }),
    },
  } as unknown as ToolContext;
}

describe('cellUnit', () => {
  it('reads square cell metadata from constraintService', () => {
    expect(cellUnit(ctx('square', 50))).toBe(50);
  });

  it('reads hex cell metadata from constraintService', () => {
    expect(cellUnit(ctx('hex', 40))).toBeCloseTo(Math.sqrt(3) * 40, 9);
  });

  it('uses 40 only when cellSize is missing or invalid', () => {
    expect(cellUnit(ctx('square'))).toBe(40);
    expect(cellUnit(ctx('hex'))).toBe(40);
    expect(cellUnit(ctx('hex', 0))).toBe(40);
    expect(cellUnit(ctx('hex', Number.NaN))).toBe(40);
  });
});
