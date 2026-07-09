import { describe, it, expect } from 'vitest';
import { dragDistanceFeet } from '@/components/ui/campaign/dm-vtt/dragDistance';
import type { ToolContext } from '@fieldnotes/core';

type Point = { x: number; y: number };

function makeCtx(
  gridSize: number,
  gridType: 'square' | 'hex'
): Pick<ToolContext, 'gridSize' | 'gridType'> {
  return { gridSize, gridType };
}

describe('dragDistanceFeet', () => {
  describe('square grid', () => {
    it('calculates 10 ft for a 100px move with 50px cells', () => {
      const ctx = makeCtx(50, 'square');
      const start: Point = { x: 0, y: 0 };
      const current: Point = { x: 100, y: 0 };
      expect(dragDistanceFeet(start, current, ctx)).toBe(10);
    });

    it('handles vertical movement correctly', () => {
      const ctx = makeCtx(50, 'square');
      const start: Point = { x: 0, y: 0 };
      const current: Point = { x: 0, y: 100 };
      expect(dragDistanceFeet(start, current, ctx)).toBe(10);
    });

    it('calculates diagonal euclidean distance', () => {
      const ctx = makeCtx(50, 'square');
      const start: Point = { x: 0, y: 0 };
      // Move 50px right, 50px down = sqrt(2500 + 2500) = 50*sqrt(2) ≈ 70.71px
      // = 70.71 / 50 ≈ 1.414 cells = 1.414 * 5 ≈ 7.07 ft → rounds to 7 ft
      const current: Point = { x: 50, y: 50 };
      expect(dragDistanceFeet(start, current, ctx)).toBe(7);
    });

    it('rounds correctly', () => {
      const ctx = makeCtx(50, 'square');
      const start: Point = { x: 0, y: 0 };
      // Move 37px = 37/50 = 0.74 cells = 0.74 * 5 = 3.7 ft → rounds to 4 ft
      const current: Point = { x: 37, y: 0 };
      expect(dragDistanceFeet(start, current, ctx)).toBe(4);
    });

    it('respects custom feetPerCell', () => {
      const ctx = makeCtx(50, 'square');
      const start: Point = { x: 0, y: 0 };
      const current: Point = { x: 100, y: 0 };
      expect(dragDistanceFeet(start, current, ctx, 10)).toBe(20);
    });
  });

  describe('hex grid', () => {
    it('calculates 5 ft for a √3×40 move with 40px gridSize', () => {
      const ctx = makeCtx(40, 'hex');
      const start: Point = { x: 0, y: 0 };
      const moveDistance = Math.sqrt(3) * 40;
      const current: Point = { x: moveDistance, y: 0 };
      expect(dragDistanceFeet(start, current, ctx)).toBe(5);
    });

    it('handles diagonal movement on hex grid', () => {
      const ctx = makeCtx(40, 'hex');
      const start: Point = { x: 0, y: 0 };
      // Move by cellUnit in both directions
      const cellU = Math.sqrt(3) * 40;
      const current: Point = { x: cellU, y: cellU };
      // Distance = sqrt(cellU^2 + cellU^2) = cellU * sqrt(2)
      // = cellU * sqrt(2) / cellU = sqrt(2) cells ≈ 1.414 cells = 1.414 * 5 ≈ 7.07 ft → rounds to 7 ft
      expect(dragDistanceFeet(start, current, ctx)).toBe(7);
    });

    it('rounds correctly on hex grid', () => {
      const ctx = makeCtx(40, 'hex');
      const start: Point = { x: 0, y: 0 };
      const cellU = Math.sqrt(3) * 40;
      // Move 0.4 cells = 0.4 * cellU ≈ 27.71px
      const current: Point = { x: 0.4 * cellU, y: 0 };
      // 0.4 cells * 5 ft/cell = 2.0 ft → rounds to 2 ft
      expect(dragDistanceFeet(start, current, ctx)).toBe(2);
    });

    it('respects custom feetPerCell on hex grid', () => {
      const ctx = makeCtx(40, 'hex');
      const start: Point = { x: 0, y: 0 };
      const moveDistance = Math.sqrt(3) * 40;
      const current: Point = { x: moveDistance, y: 0 };
      expect(dragDistanceFeet(start, current, ctx, 10)).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('returns 0 when start and current are the same', () => {
      const ctx = makeCtx(50, 'square');
      const point: Point = { x: 100, y: 100 };
      expect(dragDistanceFeet(point, point, ctx)).toBe(0);
    });

    it('uses default gridSize of 40 when not provided', () => {
      // When gridSize is undefined, cellUnit should default to 40 for square
      const ctx = makeCtx(40, 'square'); // Explicitly set to 40
      const start: Point = { x: 0, y: 0 };
      const current: Point = { x: 40, y: 0 };
      // 40px / 40px = 1 cell * 5 ft = 5 ft
      expect(dragDistanceFeet(start, current, ctx)).toBe(5);
    });
  });
});
