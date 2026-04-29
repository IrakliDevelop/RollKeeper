import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimeAgo } from '@/hooks/useTimeAgo';

describe('useTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for null input', () => {
    const { result } = renderHook(() => useTimeAgo(null));
    expect(result.current).toBeNull();
  });

  it('returns "just now" for a timestamp less than 5 seconds ago', () => {
    const date = new Date(Date.now() - 3000); // 3 seconds ago
    const { result } = renderHook(() => useTimeAgo(date));
    expect(result.current).toBe('just now');
  });

  it('returns "Xs ago" for timestamps within the last minute', () => {
    const date = new Date(Date.now() - 30000); // 30 seconds ago
    const { result } = renderHook(() => useTimeAgo(date));
    expect(result.current).toBe('30s ago');
  });

  it('returns "Xm ago" for timestamps within the last hour', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    const { result } = renderHook(() => useTimeAgo(date));
    expect(result.current).toBe('5m ago');
  });

  it('returns "Xh ago" for timestamps older than an hour', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
    const { result } = renderHook(() => useTimeAgo(date));
    expect(result.current).toBe('3h ago');
  });

  it('updates the displayed text after 5 seconds pass', () => {
    // Start at exactly 59 seconds ago — should show "59s ago"
    const date = new Date(Date.now() - 59000);
    const { result } = renderHook(() => useTimeAgo(date));
    expect(result.current).toBe('59s ago');

    // Advance 5 seconds — now 64 seconds ago (1m ago)
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe('1m ago');
  });

  it('continues updating on subsequent 5-second intervals', () => {
    // Start at 55 minutes ago
    const date = new Date(Date.now() - 55 * 60 * 1000);
    const { result } = renderHook(() => useTimeAgo(date));
    expect(result.current).toBe('55m ago');

    // After 5 minutes (300 seconds in 5-second ticks = 60 ticks of 5s)
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(result.current).toBe('1h ago');
  });

  it('clears the interval and returns null when date changes to null', () => {
    let date: Date | null = new Date(Date.now() - 30000);
    const { result, rerender } = renderHook(
      ({ d }: { d: Date | null }) => useTimeAgo(d),
      {
        initialProps: { d: date as Date | null },
      }
    );
    expect(result.current).toBe('30s ago');

    date = null;
    rerender({ d: null });
    expect(result.current).toBeNull();
  });

  it('re-initializes when a new date is provided after null', () => {
    const { result, rerender } = renderHook(
      ({ d }: { d: Date | null }) => useTimeAgo(d),
      {
        initialProps: { d: null as Date | null },
      }
    );
    expect(result.current).toBeNull();

    const newDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    rerender({ d: newDate });
    expect(result.current).toBe('10m ago');
  });
});
