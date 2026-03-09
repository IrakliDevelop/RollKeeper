import { useMemo, useState, useCallback } from 'react';

export interface EquipmentFilters {
  search: string;
  equipped: 'all' | 'equipped' | 'unequipped';
  attuned: 'all' | 'attuned' | 'unattuned';
  category: string;
  rarity: string;
  hasCharges: 'all' | 'with' | 'without';
}

const DEFAULT_FILTERS: EquipmentFilters = {
  search: '',
  equipped: 'all',
  attuned: 'all',
  category: 'all',
  rarity: 'all',
  hasCharges: 'all',
};

interface FilterableItem {
  name: string;
  isEquipped?: boolean;
  isAttuned?: boolean;
  requiresAttunement?: boolean;
  category?: string;
  rarity?: string;
  chargePool?: { maxCharges: number } | null;
  charges?: unknown[] | null;
}

export function useEquipmentFilters<T extends FilterableItem>(
  items: T[],
  config?: {
    showAttuned?: boolean;
    showHasCharges?: boolean;
  }
) {
  const [filters, setFilters] = useState<EquipmentFilters>(DEFAULT_FILTERS);

  const updateFilter = useCallback(
    <K extends keyof EquipmentFilters>(key: K, value: EquipmentFilters[K]) => {
      setFilters(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (
        filters.search &&
        !item.name.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      if (filters.equipped === 'equipped' && !item.isEquipped) return false;
      if (filters.equipped === 'unequipped' && item.isEquipped) return false;

      if (config?.showAttuned !== false) {
        if (filters.attuned === 'attuned' && !item.isAttuned) return false;
        if (filters.attuned === 'unattuned' && item.isAttuned) return false;
      }

      if (
        filters.category !== 'all' &&
        item.category?.toLowerCase() !== filters.category.toLowerCase()
      ) {
        return false;
      }

      if (
        filters.rarity !== 'all' &&
        item.rarity?.toLowerCase() !== filters.rarity.toLowerCase()
      ) {
        return false;
      }

      if (config?.showHasCharges !== false) {
        const hasPoolOrCharges =
          (item.chargePool && item.chargePool.maxCharges > 0) ||
          (item.charges && item.charges.length > 0);
        if (filters.hasCharges === 'with' && !hasPoolOrCharges) return false;
        if (filters.hasCharges === 'without' && hasPoolOrCharges) return false;
      }

      return true;
    });
  }, [items, filters, config?.showAttuned, config?.showHasCharges]);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.equipped !== 'all' ||
    filters.attuned !== 'all' ||
    filters.category !== 'all' ||
    filters.rarity !== 'all' ||
    filters.hasCharges !== 'all';

  return {
    filters,
    updateFilter,
    resetFilters,
    filteredItems,
    hasActiveFilters,
  };
}
