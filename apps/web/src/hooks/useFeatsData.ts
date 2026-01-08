/**
 * Hook for loading and managing feat data
 * Similar to useSpellsData
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProcessedFeat } from '@/utils/featDataLoader';

interface UseFeatsDataReturn {
  feats: ProcessedFeat[];
  loading: boolean;
  error: Error | null;
  searchResults: (query: string) => ProcessedFeat[];
  getFeatByName: (name: string) => ProcessedFeat | undefined;
}

/**
 * Hook to load and manage feat data
 */
export function useFeatsData(): UseFeatsDataReturn {
  const [feats, setFeats] = useState<ProcessedFeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load feats on mount
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/feats');
        if (!response.ok) {
          throw new Error(`Failed to fetch feats: ${response.statusText}`);
        }

        const data = await response.json();

        if (mounted) {
          setFeats(data.feats || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading feats:', err);
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to load feats')
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

  // Search feats by query
  const searchResults = useCallback(
    (query: string): ProcessedFeat[] => {
      if (!query.trim()) return feats;

      const queryLower = query.toLowerCase().trim();

      return feats.filter(
        feat =>
          feat.name.toLowerCase().includes(queryLower) ||
          feat.description.toLowerCase().includes(queryLower) ||
          feat.prerequisites.some(p => p.toLowerCase().includes(queryLower)) ||
          feat.tags.some(t => t.toLowerCase().includes(queryLower))
      );
    },
    [feats]
  );

  // Get feat by name (case-insensitive)
  const getFeatByName = useCallback(
    (name: string): ProcessedFeat | undefined => {
      const nameLower = name.toLowerCase();
      return feats.find(feat => feat.name.toLowerCase() === nameLower);
    },
    [feats]
  );

  return {
    feats,
    loading,
    error,
    searchResults,
    getFeatByName,
  };
}
