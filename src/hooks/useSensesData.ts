'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProcessedSense } from '@/utils/sensesDataLoader';

interface UseSensesDataReturn {
  senses: ProcessedSense[];
  loading: boolean;
  error: Error | null;
  searchResults: (query: string) => ProcessedSense[];
  getSenseByName: (name: string) => ProcessedSense | undefined;
}

export function useSensesData(): UseSensesDataReturn {
  const [senses, setSenses] = useState<ProcessedSense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/senses');
        if (!response.ok) {
          throw new Error(`Failed to fetch senses: ${response.statusText}`);
        }

        const data = await response.json();

        if (mounted) {
          setSenses(data.senses || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading senses:', err);
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to load senses')
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

  const searchResults = useCallback(
    (query: string): ProcessedSense[] => {
      if (!query.trim()) return senses;
      const queryLower = query.toLowerCase().trim();
      return senses.filter(
        sense =>
          sense.name.toLowerCase().includes(queryLower) ||
          sense.description.toLowerCase().includes(queryLower)
      );
    },
    [senses]
  );

  const getSenseByName = useCallback(
    (name: string): ProcessedSense | undefined => {
      const nameLower = name.toLowerCase();
      return senses.find(s => s.name.toLowerCase() === nameLower);
    },
    [senses]
  );

  return {
    senses,
    loading,
    error,
    searchResults,
    getSenseByName,
  };
}
