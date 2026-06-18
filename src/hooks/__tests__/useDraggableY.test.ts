import { describe, it, expect } from 'vitest';
import { clampTop } from '../useDraggableY';

describe('clampTop', () => {
  it('returns the moved position when within bounds', () => {
    expect(clampTop(100, 50, 800)).toBe(150);
    expect(clampTop(200, -50, 800)).toBe(150);
  });

  it('clamps to the top margin when dragged above the viewport', () => {
    expect(clampTop(100, -500, 800)).toBe(8);
  });

  it('clamps to (innerHeight - bottomMargin) when dragged below the viewport', () => {
    // 800 - 120 = 680
    expect(clampTop(100, 5000, 800)).toBe(680);
  });
});
