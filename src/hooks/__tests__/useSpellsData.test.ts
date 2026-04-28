import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSpellsData, clearSpellCache } from '@/hooks/useSpellsData';
import { mockFetchResponse, resetFetch } from '@/test/mocks/fetch';

describe('useSpellsData', () => {
  beforeEach(() => {
    resetFetch();
    clearSpellCache();
  });

  it('starts with loading=true', () => {
    mockFetchResponse(200, { spells: [] });
    const { result } = renderHook(() => useSpellsData());
    expect(result.current.loading).toBe(true);
  });

  it('loads spells and sets loading=false', async () => {
    mockFetchResponse(200, {
      spells: [{ id: 'fireball', name: 'Fireball', level: 3 }],
    });
    const { result } = renderHook(() => useSpellsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.spells).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    mockFetchResponse(500, { error: 'Server error' });
    const { result } = renderHook(() => useSpellsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });

  it('getSpellById finds a spell', async () => {
    mockFetchResponse(200, {
      spells: [{ id: 'fireball', name: 'Fireball', level: 3 }],
    });
    const { result } = renderHook(() => useSpellsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.getSpellById('fireball')?.name).toBe('Fireball');
  });

  it('getSpellByName finds case-insensitively', async () => {
    mockFetchResponse(200, {
      spells: [{ id: 'fireball', name: 'Fireball', level: 3 }],
    });
    const { result } = renderHook(() => useSpellsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.getSpellByName('fireball')?.id).toBe('fireball');
  });

  it('uses cache on second render', async () => {
    const fetchFn = mockFetchResponse(200, {
      spells: [{ id: 's1', name: 'Shield' }],
    });
    const { result: r1 } = renderHook(() => useSpellsData());
    await waitFor(() => expect(r1.current.loading).toBe(false));
    const { result: r2 } = renderHook(() => useSpellsData());
    await waitFor(() => expect(r2.current.loading).toBe(false));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
