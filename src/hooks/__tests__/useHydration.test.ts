import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useHydration } from '@/hooks/useHydration';
import { useCharacterStore } from '@/store/characterStore';

describe('useHydration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset store to un-hydrated state before each test
    useCharacterStore.setState({ hasHydrated: false });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns false initially when the store has not yet hydrated', () => {
    useCharacterStore.setState({ hasHydrated: false });

    const { result } = renderHook(() => useHydration());

    // Before the setTimeout fires, hasHydrated is still false
    expect(result.current).toBe(false);
  });

  it('returns true after the setTimeout callback fires', () => {
    useCharacterStore.setState({ hasHydrated: false });

    const { result } = renderHook(() => useHydration());

    expect(result.current).toBe(false);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current).toBe(true);
  });

  it('returns true immediately when the store is already hydrated', () => {
    useCharacterStore.setState({ hasHydrated: true });

    const { result } = renderHook(() => useHydration());

    // No timer needed — store already hydrated
    expect(result.current).toBe(true);
  });

  it('does not schedule another setTimeout when already hydrated', () => {
    useCharacterStore.setState({ hasHydrated: true });
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    renderHook(() => useHydration());

    // The effect runs but should bail out before calling setTimeout
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('reflects store update when persist middleware onRehydrateStorage sets hasHydrated', () => {
    useCharacterStore.setState({ hasHydrated: false });

    const { result } = renderHook(() => useHydration());

    expect(result.current).toBe(false);

    // Simulate what onRehydrateStorage does — sets hasHydrated directly on the store
    act(() => {
      useCharacterStore.setState({ hasHydrated: true });
    });

    expect(result.current).toBe(true);
  });

  it('clears the pending timer on unmount when not yet hydrated', () => {
    useCharacterStore.setState({ hasHydrated: false });
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount } = renderHook(() => useHydration());

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('does not update hasHydrated after unmount', () => {
    useCharacterStore.setState({ hasHydrated: false });

    const { unmount } = renderHook(() => useHydration());

    unmount();

    // Advance timers after unmount — the clearTimeout in cleanup should have
    // prevented the setState call from ever running
    act(() => {
      vi.runAllTimers();
    });

    expect(useCharacterStore.getState().hasHydrated).toBe(false);
  });
});
