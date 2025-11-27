/**
 * Hook for loading and managing background data
 * Similar to useSpellsData
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  ProcessedBackground,
  ProcessedBackgroundFeature,
} from '@/utils/backgroundDataLoader';

interface UseBackgroundsDataReturn {
  backgrounds: ProcessedBackground[];
  features: ProcessedBackgroundFeature[];
  loading: boolean;
  error: Error | null;
  getBackgroundByName: (name: string) => ProcessedBackground | undefined;
  searchFeatures: (query: string) => ProcessedBackgroundFeature[];
}

/**
 * Hook to load and manage background data
 */
export function useBackgroundsData(): UseBackgroundsDataReturn {
  const [backgrounds, setBackgrounds] = useState<ProcessedBackground[]>([]);
  const [features, setFeatures] = useState<ProcessedBackgroundFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load backgrounds on mount
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/backgrounds');
        if (!response.ok) {
          throw new Error(
            `Failed to fetch backgrounds: ${response.statusText}`
          );
        }

        const data = await response.json();

        if (mounted) {
          setBackgrounds(data.backgrounds || []);
          setFeatures(data.features || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading backgrounds:', err);
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to load backgrounds')
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

  // Get background by name
  const getBackgroundByName = useCallback(
    (name: string): ProcessedBackground | undefined => {
      const nameLower = name.toLowerCase();
      return backgrounds.find(bg => bg.name.toLowerCase() === nameLower);
    },
    [backgrounds]
  );

  // Search features by query
  const searchFeatures = useCallback(
    (query: string): ProcessedBackgroundFeature[] => {
      if (!query.trim()) return features;

      const queryLower = query.toLowerCase().trim();

      return features.filter(
        feature =>
          feature.name.toLowerCase().includes(queryLower) ||
          feature.backgroundName.toLowerCase().includes(queryLower) ||
          feature.description.toLowerCase().includes(queryLower)
      );
    },
    [features]
  );

  return {
    backgrounds,
    features,
    loading,
    error,
    getBackgroundByName,
    searchFeatures,
  };
}
