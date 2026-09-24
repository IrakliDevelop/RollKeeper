import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useSheetDrawerState } from '../useSheetDrawerState';

describe('useSheetDrawerState', () => {
  it('opening the sheet collapses the dock and remembers the prior state', () => {
    const setDockCollapsed = vi.fn();
    const { result } = renderHook(() =>
      useSheetDrawerState({
        sheetReady: true,
        dockCollapsed: false,
        setDockCollapsed,
      })
    );

    act(() => {
      result.current.openSheet();
    });

    expect(result.current.sheetOpen).toBe(true);
    expect(setDockCollapsed).toHaveBeenCalledWith(true);
  });

  it('closing the sheet restores the dock collapsed state from before it opened', () => {
    const setDockCollapsed = vi.fn();
    const { result, rerender } = renderHook(
      ({ dockCollapsed }) =>
        useSheetDrawerState({
          sheetReady: true,
          dockCollapsed,
          setDockCollapsed,
        }),
      { initialProps: { dockCollapsed: false } }
    );

    act(() => {
      result.current.openSheet();
    });
    // Dock is now collapsed (simulate parent re-render with the new value).
    rerender({ dockCollapsed: true });

    act(() => {
      result.current.closeSheet();
    });

    expect(result.current.sheetOpen).toBe(false);
    expect(setDockCollapsed).toHaveBeenLastCalledWith(false);
  });

  it('does nothing when the sheet is not ready', () => {
    const setDockCollapsed = vi.fn();
    const { result } = renderHook(() =>
      useSheetDrawerState({
        sheetReady: false,
        dockCollapsed: false,
        setDockCollapsed,
      })
    );

    act(() => {
      result.current.openSheet();
    });

    expect(result.current.sheetOpen).toBe(false);
    expect(setDockCollapsed).not.toHaveBeenCalled();
  });

  it('is a no-op when the sheet is already open', () => {
    const setDockCollapsed = vi.fn();
    const { result } = renderHook(() =>
      useSheetDrawerState({
        sheetReady: true,
        dockCollapsed: false,
        setDockCollapsed,
      })
    );

    act(() => {
      result.current.openSheet();
    });
    setDockCollapsed.mockClear();

    act(() => {
      result.current.openSheet();
    });

    expect(setDockCollapsed).not.toHaveBeenCalled();
  });
});
