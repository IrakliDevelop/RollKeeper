import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedSearch } from '@/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('does not update value before delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 300 } }
    );
    rerender({ value: 'world', delay: 300 });
    vi.advanceTimersByTime(100);
    expect(result.current).toBe('hello');
  });

  it('updates value after delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 300 } }
    );
    rerender({ value: 'world', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('world');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 300 } }
    );
    rerender({ value: 'b', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: 'c', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('c');
  });

  it('uses default delay of 300ms', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: 'start' },
    });
    rerender({ value: 'end' });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('start');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('end');
  });
});

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial search term', () => {
    const { result } = renderHook(() => useDebouncedSearch('', 300));
    expect(result.current.debouncedSearchTerm).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('shows isSearching while debouncing', () => {
    const { result, rerender } = renderHook(
      ({ term }) => useDebouncedSearch(term, 300),
      { initialProps: { term: '' } }
    );
    rerender({ term: 'fire' });
    expect(result.current.isSearching).toBe(true);
  });

  it('sets isSearching to false after debounce completes', () => {
    const { result, rerender } = renderHook(
      ({ term }) => useDebouncedSearch(term, 300),
      { initialProps: { term: '' } }
    );
    rerender({ term: 'fire' });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.debouncedSearchTerm).toBe('fire');
    expect(result.current.isSearching).toBe(false);
  });
});
