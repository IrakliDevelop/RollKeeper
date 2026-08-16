import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

import { useHydration } from '@/hooks/useHydration';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';

describe('useHydration', () => {
  beforeEach(() => {
    useCharacterStore.setState({ hasHydrated: false });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('waits for persisted roster hydration instead of a zero-delay timer', () => {
    let finishHydration: (() => void) | undefined;
    vi.spyOn(usePlayerStore.persist, 'hasHydrated').mockReturnValue(false);
    vi.spyOn(usePlayerStore.persist, 'onFinishHydration').mockImplementation(
      listener => {
        finishHydration = () => listener(usePlayerStore.getState());
        return () => {};
      }
    );
    const { result } = renderHook(() => useHydration());

    expect(result.current).toBe(false);
    act(() => finishHydration?.());
    expect(result.current).toBe(true);
  });

  it('marks ready immediately when roster persistence already hydrated', () => {
    vi.spyOn(usePlayerStore.persist, 'hasHydrated').mockReturnValue(true);

    const { result } = renderHook(() => useHydration());

    expect(result.current).toBe(true);
  });

  it('keeps an existing hydrated state without subscribing again', () => {
    useCharacterStore.setState({ hasHydrated: true });
    const subscribe = vi.spyOn(usePlayerStore.persist, 'onFinishHydration');

    const { result } = renderHook(() => useHydration());

    expect(result.current).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes from the persistence lifecycle on unmount', () => {
    const unsubscribe = vi.fn();
    vi.spyOn(usePlayerStore.persist, 'hasHydrated').mockReturnValue(false);
    vi.spyOn(usePlayerStore.persist, 'onFinishHydration').mockReturnValue(
      unsubscribe
    );

    const { unmount } = renderHook(() => useHydration());
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
