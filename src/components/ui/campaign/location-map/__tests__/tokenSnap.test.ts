import { describe, it, expect } from 'vitest';

import { snapTokenCenter } from '@/components/ui/campaign/location-map/tokenSnap';

import type { ToolContext } from '@fieldnotes/core';

const squareCtx = {
  gridSize: 40,
  gridType: 'square',
  snapToGrid: true,
} as unknown as ToolContext;

describe('snapTokenCenter', () => {
  it('odd sizes snap the center to a CELL CENTER on square grids', () => {
    // click near the middle of the cell spanning (40,40)-(80,80)
    expect(snapTokenCenter({ x: 55, y: 70 }, 1, squareCtx)).toEqual({
      x: 60,
      y: 60,
    });
    expect(snapTokenCenter({ x: 55, y: 70 }, 3, squareCtx)).toEqual({
      x: 60,
      y: 60,
    });
  });

  it('even sizes snap the center to a grid INTERSECTION (fills cells exactly)', () => {
    expect(snapTokenCenter({ x: 55, y: 70 }, 2, squareCtx)).toEqual({
      x: 40,
      y: 80,
    });
    expect(snapTokenCenter({ x: 55, y: 70 }, 4, squareCtx)).toEqual({
      x: 40,
      y: 80,
    });
  });

  it('hex grids defer to smartSnap regardless of size', () => {
    const hexCtx = {
      gridSize: 40,
      gridType: 'hex',
      hexOrientation: 'pointy',
      snapToGrid: true,
    } as unknown as ToolContext;
    const one = snapTokenCenter({ x: 55, y: 70 }, 1, hexCtx);
    const two = snapTokenCenter({ x: 55, y: 70 }, 2, hexCtx);
    expect(one).toEqual(two); // same smartSnap result — no parity math on hex
  });

  it('is the identity when snapping is off', () => {
    const offCtx = { snapToGrid: false } as unknown as ToolContext;
    expect(snapTokenCenter({ x: 55, y: 70 }, 1, offCtx)).toEqual({
      x: 55,
      y: 70,
    });
  });
});
