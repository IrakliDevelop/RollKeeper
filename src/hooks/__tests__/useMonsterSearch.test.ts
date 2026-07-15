import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMonsterSearch } from '@/hooks/useMonsterSearch';
import {
  mockFetchResponse,
  mockFetchSequence,
  resetFetch,
} from '@/test/mocks/fetch';
import { createMockProcessedMonster } from '@/test/helpers';

const guard = createMockProcessedMonster({ id: 'guard', name: 'Guard' });
const drake = createMockProcessedMonster({
  id: 'guard-drake',
  name: 'Guard Drake',
});

describe('useMonsterSearch', () => {
  beforeEach(() => {
    resetFetch();
  });

  it('does not search for queries shorter than 2 characters', async () => {
    const fetchFn = mockFetchResponse(200, {
      monsters: [],
      total: 0,
      hasMore: false,
    });
    const { result } = renderHook(() => useMonsterSearch());
    act(() => result.current.setQuery('g'));
    // debounce is 300ms; wait past it and confirm no fetch happened
    await new Promise(r => setTimeout(r, 400));
    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
  });

  it('searches after debounce and exposes results, total, hasMore', async () => {
    const fetchFn = mockFetchResponse(200, {
      monsters: [guard],
      total: 63,
      hasMore: true,
    });
    const { result } = renderHook(() => useMonsterSearch());
    act(() => result.current.setQuery('guard'));
    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/bestiary/search?q=guard&limit=20'
    );
    expect(result.current.total).toBe(63);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('loadMore fetches with offset and appends results', async () => {
    const fetchFn = mockFetchSequence([
      { status: 200, body: { monsters: [guard], total: 2, hasMore: true } },
      { status: 200, body: { monsters: [drake], total: 2, hasMore: false } },
    ]);
    const { result } = renderHook(() => useMonsterSearch());
    act(() => result.current.setQuery('guard'));
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    await act(async () => {
      await result.current.loadMore();
    });
    await waitFor(() => expect(result.current.results).toHaveLength(2));
    expect(fetchFn).toHaveBeenLastCalledWith(
      '/api/bestiary/search?q=guard&limit=20&offset=1'
    );
    expect(result.current.results.map(m => m.name)).toEqual([
      'Guard',
      'Guard Drake',
    ]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loadingMore).toBe(false);
  });

  it('loadMore is a no-op when hasMore is false', async () => {
    const fetchFn = mockFetchResponse(200, {
      monsters: [guard],
      total: 1,
      hasMore: false,
    });
    const { result } = renderHook(() => useMonsterSearch());
    act(() => result.current.setQuery('guard'));
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    await act(async () => {
      await result.current.loadMore();
    });
    await new Promise(r => setTimeout(r, 50));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('a new query resets results and pagination', async () => {
    mockFetchSequence([
      {
        status: 200,
        body: { monsters: [guard, drake], total: 63, hasMore: true },
      },
      { status: 200, body: { monsters: [drake], total: 1, hasMore: false } },
    ]);
    const { result } = renderHook(() => useMonsterSearch());
    act(() => result.current.setQuery('guard'));
    await waitFor(() => expect(result.current.results).toHaveLength(2));

    act(() => result.current.setQuery('drake'));
    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.results[0].name).toBe('Guard Drake');
    expect(result.current.hasMore).toBe(false);
  });

  it('fails silently on fetch error', async () => {
    mockFetchResponse(500, { error: 'boom' });
    const { result } = renderHook(() => useMonsterSearch());
    act(() => result.current.setQuery('guard'));
    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 2000,
    });
    expect(result.current.results).toEqual([]);
  });
});
