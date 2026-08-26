import { describe, it, expect } from 'vitest';
import { cellUnit } from '@/components/ui/campaign/location-map/cellUnit';

describe('cellUnit', () => {
  it('square grids: the unit is gridSize', () => {
    expect(cellUnit({ gridSize: 50, gridType: 'square' })).toBe(50);
  });

  it('hex grids: the unit is √3 × gridSize (the SDK snapUnit)', () => {
    expect(cellUnit({ gridSize: 40, gridType: 'hex' })).toBeCloseTo(
      Math.sqrt(3) * 40,
      9
    );
  });

  it('no grid type behaves like square', () => {
    expect(cellUnit({ gridSize: 40 })).toBe(40);
  });

  it('missing gridSize falls back to 40', () => {
    expect(cellUnit({})).toBe(40);
    expect(cellUnit({ gridType: 'hex' })).toBeCloseTo(Math.sqrt(3) * 40, 9);
  });
});
