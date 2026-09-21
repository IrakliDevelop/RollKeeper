import { describe, it, expect } from 'vitest';

import { GridConstraintService, snapFootprintCenter } from '@fieldnotes/vtt';

import type { ToolContext } from '@fieldnotes/core';

function gridCtx(gridType: 'square' | 'hex', active: boolean): ToolContext {
  const grid = new GridConstraintService(() => ({
    gridType,
    cellSize: 40,
    cellRadius: 20,
    hexOrientation: 'pointy',
  }));
  return {
    constraintService: {
      isActive: active,
      constrainPoint: grid.constrainPoint,
      getConstraintInfo: grid.getConstraintInfo,
      hasCapability: () => false,
      setActive: () => undefined,
    },
  } as unknown as ToolContext;
}

const squareCtx = gridCtx('square', true);

describe('snapFootprintCenter', () => {
  it('odd sizes snap the center to a CELL CENTER on square grids', () => {
    // click near the middle of the cell spanning (40,40)-(80,80)
    expect(snapFootprintCenter({ x: 55, y: 70 }, 1, squareCtx)).toEqual({
      x: 60,
      y: 60,
    });
    expect(snapFootprintCenter({ x: 55, y: 70 }, 3, squareCtx)).toEqual({
      x: 60,
      y: 60,
    });
  });

  it('even sizes snap the center to a grid INTERSECTION (fills cells exactly)', () => {
    expect(snapFootprintCenter({ x: 55, y: 70 }, 2, squareCtx)).toEqual({
      x: 40,
      y: 80,
    });
    expect(snapFootprintCenter({ x: 55, y: 70 }, 4, squareCtx)).toEqual({
      x: 40,
      y: 80,
    });
  });

  it('hex grids defer to snapToHexCenter regardless of size', () => {
    const hexCtx = gridCtx('hex', true);
    const one = snapFootprintCenter({ x: 55, y: 70 }, 1, hexCtx);
    const two = snapFootprintCenter({ x: 55, y: 70 }, 2, hexCtx);
    expect(one).toEqual(two); // same snapToHexCenter result — no parity math on hex
  });

  it('is the identity when the constraint service is inactive', () => {
    const offCtx = gridCtx('square', false);
    expect(snapFootprintCenter({ x: 55, y: 70 }, 1, offCtx)).toEqual({
      x: 55,
      y: 70,
    });
  });
});
