import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useOwnTokenPresent } from '@/components/ui/campaign/location-map/useOwnTokenPresent';

import type { CanvasElement } from '@fieldnotes/core';

let mockElements: CanvasElement[] = [];

vi.mock('@fieldnotes/react', () => ({
  useElements: (
    selector: (els: CanvasElement[]) => unknown,
    isEqual?: (a: unknown, b: unknown) => boolean
  ) => {
    void isEqual;
    return selector(mockElements);
  },
}));

function tokenEl(overrides: Record<string, unknown> = {}): CanvasElement {
  return {
    id: 'el-1',
    type: 'shape',
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    zIndex: 0,
    locked: false,
    layerId: 'l1',
    ...overrides,
  } as unknown as CanvasElement;
}

describe('useOwnTokenPresent', () => {
  beforeEach(() => {
    mockElements = [];
  });

  it('returns true when the store has a stamped own player token', () => {
    mockElements = [tokenEl({ tokenKind: 'player', characterId: 'char-1' })];
    const { result } = renderHook(() => useOwnTokenPresent('char-1'));
    expect(result.current).toBe(true);
  });

  it('returns false when the only player token belongs to another character', () => {
    mockElements = [tokenEl({ tokenKind: 'player', characterId: 'char-2' })];
    const { result } = renderHook(() => useOwnTokenPresent('char-1'));
    expect(result.current).toBe(false);
  });

  it('returns false for an unstamped image element', () => {
    mockElements = [tokenEl({ type: 'image', src: 'https://x/a.png' })];
    const { result } = renderHook(() => useOwnTokenPresent('char-1'));
    expect(result.current).toBe(false);
  });

  it('returns false when the store is empty', () => {
    mockElements = [];
    const { result } = renderHook(() => useOwnTokenPresent('char-1'));
    expect(result.current).toBe(false);
  });
});
