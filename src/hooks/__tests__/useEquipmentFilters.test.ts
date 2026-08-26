import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEquipmentFilters } from '@/hooks/useEquipmentFilters';

const items = [
  {
    name: 'Longsword',
    isEquipped: true,
    isAttuned: false,
    category: 'martial',
    rarity: 'common',
    chargePool: null,
    charges: null,
  },
  {
    name: 'Shield +1',
    isEquipped: true,
    isAttuned: true,
    category: 'shield',
    rarity: 'uncommon',
    chargePool: null,
    charges: null,
  },
  {
    name: 'Wand of Fireballs',
    isEquipped: false,
    isAttuned: true,
    category: 'wand',
    rarity: 'rare',
    chargePool: { maxCharges: 7 },
    charges: null,
  },
  {
    name: 'Dagger',
    isEquipped: false,
    isAttuned: false,
    category: 'simple',
    rarity: 'common',
    chargePool: null,
    charges: null,
  },
];

describe('useEquipmentFilters', () => {
  it('returns all items by default', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    expect(result.current.filteredItems).toHaveLength(4);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('filters by search term (case-insensitive)', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('search', 'sword');
    });
    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].name).toBe('Longsword');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('filters equipped only', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('equipped', 'equipped');
    });
    expect(result.current.filteredItems).toHaveLength(2);
  });

  it('filters unequipped only', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('equipped', 'unequipped');
    });
    expect(result.current.filteredItems).toHaveLength(2);
  });

  it('filters attuned only', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('attuned', 'attuned');
    });
    expect(result.current.filteredItems).toHaveLength(2);
  });

  it('filters by category', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('category', 'martial');
    });
    expect(result.current.filteredItems).toHaveLength(1);
  });

  it('filters by rarity', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('rarity', 'rare');
    });
    expect(result.current.filteredItems).toHaveLength(1);
  });

  it('filters with charges', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('hasCharges', 'with');
    });
    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].name).toBe('Wand of Fireballs');
  });

  it('filters without charges', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('hasCharges', 'without');
    });
    expect(result.current.filteredItems).toHaveLength(3);
  });

  it('combines multiple filters', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('equipped', 'equipped');
      result.current.updateFilter('rarity', 'common');
    });
    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].name).toBe('Longsword');
  });

  it('resets all filters', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('search', 'sword');
      result.current.resetFilters();
    });
    expect(result.current.filteredItems).toHaveLength(4);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('skips attuned filter when showAttuned is false', () => {
    const { result } = renderHook(() =>
      useEquipmentFilters(items, { showAttuned: false })
    );
    act(() => {
      result.current.updateFilter('attuned', 'attuned');
    });
    expect(result.current.filteredItems).toHaveLength(4);
  });
});
