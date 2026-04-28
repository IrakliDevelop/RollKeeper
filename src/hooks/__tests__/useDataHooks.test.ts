/**
 * Batch tests for data-fetching hooks.
 *
 * Hooks with module-level caches (useArmorDbData, useWeaponsDbData,
 * useItemsData, useMagicItemsData) export no clearXCache helper, so each
 * describe block calls vi.resetModules() in beforeEach and uses dynamic
 * imports to pick up a freshly-initialised module every test.
 *
 * Hooks without module-level caches (useBackgroundsData, useFeatsData,
 * useToolsData, useSensesData) are imported statically at the top.
 *
 * useClassData delegates to apiClient.fetchClasses which wraps fetch in a
 * try/catch and always returns an array (never throws), so the hook itself
 * never enters its own catch block on a 500. The error test therefore
 * verifies that data is empty and loading is false rather than expecting a
 * non-null error.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useBackgroundsData } from '@/hooks/useBackgroundsData';
import { useFeatsData } from '@/hooks/useFeatsData';
import { useToolsData } from '@/hooks/useToolsData';
import { useSensesData } from '@/hooks/useSensesData';

import { mockFetchResponse, resetFetch } from '@/test/mocks/fetch';

// ---------------------------------------------------------------------------
// useBackgroundsData — /api/backgrounds
// ---------------------------------------------------------------------------
describe('useBackgroundsData', () => {
  beforeEach(() => {
    resetFetch();
  });

  it('starts with loading=true', () => {
    mockFetchResponse(200, { backgrounds: [], features: [] });
    const { result } = renderHook(() => useBackgroundsData());
    expect(result.current.loading).toBe(true);
  });

  it('loads data and sets loading=false', async () => {
    mockFetchResponse(200, {
      backgrounds: [{ name: 'Acolyte', id: 'acolyte' }],
      features: [
        {
          name: 'Shelter of the Faithful',
          backgroundName: 'Acolyte',
          description: 'desc',
        },
      ],
    });
    const { result } = renderHook(() => useBackgroundsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.backgrounds).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error (non-ok response)', async () => {
    mockFetchResponse(500, {});
    const { result } = renderHook(() => useBackgroundsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.backgrounds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useFeatsData — /api/feats
// ---------------------------------------------------------------------------
describe('useFeatsData', () => {
  beforeEach(() => {
    resetFetch();
  });

  it('starts with loading=true', () => {
    mockFetchResponse(200, { feats: [] });
    const { result } = renderHook(() => useFeatsData());
    expect(result.current.loading).toBe(true);
  });

  it('loads data and sets loading=false', async () => {
    mockFetchResponse(200, {
      feats: [
        {
          id: 'alert',
          name: 'Alert',
          description: 'Fast',
          prerequisites: [],
          tags: [],
        },
      ],
    });
    const { result } = renderHook(() => useFeatsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.feats).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error (non-ok response)', async () => {
    mockFetchResponse(500, {});
    const { result } = renderHook(() => useFeatsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.feats).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useClassData — /api/classes  (via apiClient.fetchClasses)
// apiClient swallows fetch errors — hook never throws, returns []
// ---------------------------------------------------------------------------
describe('useClassData', () => {
  beforeEach(() => {
    resetFetch();
  });

  it('starts with loading=true', async () => {
    mockFetchResponse(200, { classes: [], total: 0 });
    const { useClassData } = await import('@/hooks/useClassData');
    const { result } = renderHook(() => useClassData());
    expect(result.current.loading).toBe(true);
  });

  it('loads class data and sets loading=false', async () => {
    mockFetchResponse(200, {
      classes: [{ id: 'barbarian', name: 'Barbarian' }],
      total: 1,
    });
    const { useClassData } = await import('@/hooks/useClassData');
    const { result } = renderHook(() => useClassData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.classData).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('returns empty array and no error when fetch fails (apiClient swallows errors)', async () => {
    mockFetchResponse(500, {});
    const { useClassData } = await import('@/hooks/useClassData');
    const { result } = renderHook(() => useClassData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // apiClient.fetchClasses catches errors and returns [] — hook error stays null
    expect(result.current.classData).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useToolsData — /api/tools
// ---------------------------------------------------------------------------
describe('useToolsData', () => {
  beforeEach(() => {
    resetFetch();
  });

  it('starts with loading=true', () => {
    mockFetchResponse(200, { artisans: [], instruments: [] });
    const { result } = renderHook(() => useToolsData());
    expect(result.current.loading).toBe(true);
  });

  it('loads data and sets loading=false', async () => {
    mockFetchResponse(200, {
      artisans: ["Brewer's Supplies"],
      instruments: ['Lute'],
    });
    const { result } = renderHook(() => useToolsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error (non-ok response)', async () => {
    mockFetchResponse(500, {});
    const { result } = renderHook(() => useToolsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// useArmorDbData — /api/armor-db  (module-level cache — use resetModules)
// ---------------------------------------------------------------------------
describe('useArmorDbData', () => {
  beforeEach(() => {
    resetFetch();
    vi.resetModules();
  });

  it('starts with loading=true', async () => {
    mockFetchResponse(200, { items: [] });
    const { useArmorDbData } = await import('@/hooks/useArmorDbData');
    const { result } = renderHook(() => useArmorDbData());
    expect(result.current.loading).toBe(true);
  });

  it('loads data and sets loading=false', async () => {
    mockFetchResponse(200, {
      items: [{ id: 'leather', name: 'Leather Armor' }],
    });
    const { useArmorDbData } = await import('@/hooks/useArmorDbData');
    const { result } = renderHook(() => useArmorDbData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error (non-ok response)', async () => {
    mockFetchResponse(500, {});
    const { useArmorDbData } = await import('@/hooks/useArmorDbData');
    const { result } = renderHook(() => useArmorDbData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useWeaponsDbData — /api/weapons-db  (module-level cache — use resetModules)
// ---------------------------------------------------------------------------
describe('useWeaponsDbData', () => {
  beforeEach(() => {
    resetFetch();
    vi.resetModules();
  });

  it('starts with loading=true', async () => {
    mockFetchResponse(200, { items: [] });
    const { useWeaponsDbData } = await import('@/hooks/useWeaponsDbData');
    const { result } = renderHook(() => useWeaponsDbData());
    expect(result.current.loading).toBe(true);
  });

  it('loads data and sets loading=false', async () => {
    mockFetchResponse(200, {
      items: [{ id: 'longsword', name: 'Longsword' }],
    });
    const { useWeaponsDbData } = await import('@/hooks/useWeaponsDbData');
    const { result } = renderHook(() => useWeaponsDbData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error (non-ok response)', async () => {
    mockFetchResponse(500, {});
    const { useWeaponsDbData } = await import('@/hooks/useWeaponsDbData');
    const { result } = renderHook(() => useWeaponsDbData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useItemsData — /api/items  (module-level cache — use resetModules)
// ---------------------------------------------------------------------------
describe('useItemsData', () => {
  beforeEach(() => {
    resetFetch();
    vi.resetModules();
  });

  it('starts with loading=true', async () => {
    mockFetchResponse(200, { items: [] });
    const { useItemsData } = await import('@/hooks/useItemsData');
    const { result } = renderHook(() => useItemsData());
    expect(result.current.loading).toBe(true);
  });

  it('loads data and sets loading=false', async () => {
    mockFetchResponse(200, {
      items: [{ id: 'rope', name: 'Rope (50 feet)' }],
    });
    const { useItemsData } = await import('@/hooks/useItemsData');
    const { result } = renderHook(() => useItemsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error (non-ok response)', async () => {
    mockFetchResponse(500, {});
    const { useItemsData } = await import('@/hooks/useItemsData');
    const { result } = renderHook(() => useItemsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useMagicItemsData — /api/magic-items  (module-level cache — use resetModules)
// ---------------------------------------------------------------------------
describe('useMagicItemsData', () => {
  beforeEach(() => {
    resetFetch();
    vi.resetModules();
  });

  it('starts with loading=true', async () => {
    mockFetchResponse(200, { items: [] });
    const { useMagicItemsData } = await import('@/hooks/useMagicItemsData');
    const { result } = renderHook(() => useMagicItemsData());
    expect(result.current.loading).toBe(true);
  });

  it('loads data and sets loading=false', async () => {
    mockFetchResponse(200, {
      items: [{ id: 'bag-of-holding', name: 'Bag of Holding' }],
    });
    const { useMagicItemsData } = await import('@/hooks/useMagicItemsData');
    const { result } = renderHook(() => useMagicItemsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error (non-ok response)', async () => {
    mockFetchResponse(500, {});
    const { useMagicItemsData } = await import('@/hooks/useMagicItemsData');
    const { result } = renderHook(() => useMagicItemsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// useSensesData — /api/senses
// ---------------------------------------------------------------------------
describe('useSensesData', () => {
  beforeEach(() => {
    resetFetch();
  });

  it('starts with loading=true', () => {
    mockFetchResponse(200, { senses: [] });
    const { result } = renderHook(() => useSensesData());
    expect(result.current.loading).toBe(true);
  });

  it('loads data and sets loading=false', async () => {
    mockFetchResponse(200, {
      senses: [{ name: 'Darkvision', description: 'See in darkness' }],
    });
    const { result } = renderHook(() => useSensesData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.senses).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error (non-ok response)', async () => {
    mockFetchResponse(500, {});
    const { result } = renderHook(() => useSensesData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.senses).toHaveLength(0);
  });
});
