import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createMockEncounterEntity } from '@/test/helpers';

import { useDmVttDragPlacement } from '../useDmVttDragPlacement';
import { useDmVttPlacementAndSelection } from '../useDmVttPlacementAndSelection';

import type { PointerEvent as ReactPointerEvent } from 'react';

/** PR08 repair 07 CC1: only a surface with a live room waits for 'live'. */
describe('roster placement live gate', () => {
  const entity = createMockEncounterEntity({ id: 'e-1', name: 'Aria' });

  it('a surface with a live room still refuses tap-to-arm until live', () => {
    const addToast = vi.fn();
    const { result, rerender } = renderHook(
      ({ status }: { status: 'connecting' | 'live' }) =>
        useDmVttPlacementAndSelection({
          status,
          liveRequired: true,
          linkedEntities: [entity],
          getViewport: () => null,
          addToast,
        }),
      { initialProps: { status: 'connecting' } }
    );
    act(() => result.current.armPlacement(entity));
    expect(result.current.pendingPlacement).toBeNull();
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Not connected' })
    );
    rerender({ status: 'live' });
    act(() => result.current.armPlacement(entity));
    expect(result.current.pendingPlacement?.entityName).toBe('Aria');
  });

  it('a surface with a live room still refuses drag-to-place until live', () => {
    const addToast = vi.fn();
    const { result } = renderHook(() =>
      useDmVttDragPlacement({
        status: 'connecting',
        liveRequired: true,
        getViewport: () => null,
        getCanvasEl: () => null,
        addToast,
        selectEntity: vi.fn(),
        clearPendingPlacement: vi.fn(),
      })
    );
    act(() =>
      result.current.startDrag(entity, {
        clientX: 1,
        clientY: 1,
      } as unknown as ReactPointerEvent)
    );
    expect(result.current.drag).toBeNull();
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Not connected' })
    );
  });
});
