'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  buildToolCategories,
  ToolCategoryDef,
  GAMING_SETS,
  OTHER_TOOLS,
  VEHICLES,
} from '@/utils/toolProficiencyData';

interface UseToolsDataReturn {
  categories: ToolCategoryDef[];
  loading: boolean;
  error: Error | null;
}

export function useToolsData(): UseToolsDataReturn {
  const [artisans, setArtisans] = useState<string[]>([]);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const response = await fetch('/api/tools');
        if (!response.ok) {
          throw new Error(`Failed to fetch tools: ${response.statusText}`);
        }
        const data = await response.json();
        if (mounted) {
          setArtisans(data.artisans || []);
          setInstruments(data.instruments || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading tools:', err);
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to load tools')
          );
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    if (loading && artisans.length === 0) {
      return buildToolCategories([], []);
    }
    return buildToolCategories(artisans, instruments);
  }, [artisans, instruments, loading]);

  const categoriesWithFallback = useMemo(() => {
    if (loading && artisans.length === 0) {
      return [
        { id: 'gaming' as const, label: 'Gaming Sets', items: GAMING_SETS },
        {
          id: 'other' as const,
          label: 'Other Tools & Kits',
          items: OTHER_TOOLS,
        },
        { id: 'vehicles' as const, label: 'Vehicles', items: VEHICLES },
      ];
    }
    return categories;
  }, [categories, loading, artisans]);

  return {
    categories: categoriesWithFallback,
    loading,
    error,
  };
}
