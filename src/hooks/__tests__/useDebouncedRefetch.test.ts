import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDebouncedRefetch } from '../useDebouncedRefetch';

describe('useDebouncedRefetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires the first call immediately (leading edge)', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedRefetch(fn));

    act(() => {
      result.current();
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('coalesces a burst inside the window into one trailing call at expiry', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedRefetch(fn));

    act(() => {
      result.current(); // leading
      result.current(); // inside window -> schedules trailing
      result.current(); // inside window -> coalesces onto same trailing
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fn).toHaveBeenCalledTimes(2);

    // no further stray fetch from a stacked/duplicate timeout
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('reopens the window after expiry — the next call fires immediately again', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedRefetch(fn));

    act(() => {
      result.current();
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      result.current();
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('clears a pending trailing call on unmount', () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedRefetch(fn));

    act(() => {
      result.current(); // leading
      result.current(); // schedules trailing
    });
    expect(fn).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('honors a custom windowMs', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedRefetch(fn, 500));

    act(() => {
      result.current(); // leading
      result.current(); // schedules trailing at +500ms
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('trailing call invokes the latest fn identity, not the one captured at call time', () => {
    const fnA = vi.fn();
    const fnB = vi.fn();
    const { result, rerender } = renderHook(
      ({ fn }) => useDebouncedRefetch(fn),
      { initialProps: { fn: fnA } }
    );

    act(() => {
      result.current(); // leading -> calls fnA
      result.current(); // schedules trailing
    });
    expect(fnA).toHaveBeenCalledTimes(1);

    // swap fn identity mid-window (e.g. a fresh closure from re-render)
    rerender({ fn: fnB });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // the trailing call must invoke the NEW fn, not the stale fnA
    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
  });
});
