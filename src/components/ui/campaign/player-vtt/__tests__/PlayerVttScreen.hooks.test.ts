import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { usePlacementFlow } from '../PlayerVttScreen.hooks';
import type { SpellAoe } from '@/types/spellAoe';

const FIREBALL_AOE: SpellAoe = { shape: 'circle', sizeFeet: 20 };
const CONE_AOE: SpellAoe = { shape: 'cone', sizeFeet: 15 };

describe('usePlacementFlow', () => {
  it('requestPlacement sets pending with a config carrying the right shape/size', () => {
    const addToast = vi.fn();
    const { result } = renderHook(() => usePlacementFlow(addToast));

    act(() => {
      result.current.requestPlacement('Fireball', FIREBALL_AOE);
    });

    expect(result.current.pendingPlacement).not.toBeNull();
    expect(result.current.pendingPlacement?.spellName).toBe('Fireball');
    expect(result.current.pendingPlacement?.aoe).toBe(FIREBALL_AOE);
    expect(result.current.pendingPlacement?.config).toMatchObject({
      shape: 'circle',
      sizeFeet: 20,
    });
    expect(addToast).not.toHaveBeenCalled();
  });

  it('config.onPlaced clears pending and fires a success toast in the same act()', () => {
    const addToast = vi.fn();
    const { result } = renderHook(() => usePlacementFlow(addToast));

    act(() => {
      result.current.requestPlacement('Fireball', FIREBALL_AOE);
    });
    const { config } = result.current.pendingPlacement!;

    // Simulate the tool's synchronous onPlaced callback (the invariant
    // pinned here: no await/microtask gap between the toast and the clear).
    act(() => {
      config.onPlaced();
    });

    expect(result.current.pendingPlacement).toBeNull();
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Fireball cast',
      })
    );
  });

  it('cancelPlacement clears pending and fires the slot-stays-spent info toast', () => {
    const addToast = vi.fn();
    const { result } = renderHook(() => usePlacementFlow(addToast));

    act(() => {
      result.current.requestPlacement('Fireball', FIREBALL_AOE);
    });
    act(() => {
      result.current.cancelPlacement();
    });

    expect(result.current.pendingPlacement).toBeNull();
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        title: 'Placement cancelled',
        message: 'Slot stays spent',
      })
    );
  });

  it('a second requestPlacement while one is pending replaces it', () => {
    const addToast = vi.fn();
    const { result } = renderHook(() => usePlacementFlow(addToast));

    act(() => {
      result.current.requestPlacement('Fireball', FIREBALL_AOE);
    });
    act(() => {
      result.current.requestPlacement('Burning Hands', CONE_AOE);
    });

    expect(result.current.pendingPlacement?.spellName).toBe('Burning Hands');
    expect(result.current.pendingPlacement?.aoe).toBe(CONE_AOE);
    expect(result.current.pendingPlacement?.config).toMatchObject({
      shape: 'cone',
      sizeFeet: 15,
    });
  });
});
