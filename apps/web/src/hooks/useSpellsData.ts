/**
 * Hook for loading and managing spell data from spellbook
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProcessedSpell } from '@/types/spells';
import { searchSpells } from '@/utils/spellConversion';

interface UseSpellsDataReturn {
  spells: ProcessedSpell[];
  loading: boolean;
  error: Error | null;
  searchResults: (query: string) => ProcessedSpell[];
  getSpellById: (id: string) => ProcessedSpell | undefined;
  getSpellByName: (name: string) => ProcessedSpell | undefined;
}

// Cache spells in memory for the session
let cachedSpells: ProcessedSpell[] | null = null;
let cachePromise: Promise<ProcessedSpell[]> | null = null;

/**
 * Fetch spells from the API
 */
async function fetchSpells(): Promise<ProcessedSpell[]> {
  // Return cached spells if available
  if (cachedSpells) {
    return cachedSpells;
  }

  // If already fetching, return the existing promise
  if (cachePromise) {
    return cachePromise;
  }

  // Start fetching
  cachePromise = fetch('/api/spells')
    .then(res => {
      if (!res.ok) {
        throw new Error(`Failed to fetch spells: ${res.statusText}`);
      }
      return res.json();
    })
    .then(data => {
      cachedSpells = data.spells;
      cachePromise = null;
      return cachedSpells!;
    })
    .catch(error => {
      cachePromise = null;
      throw error;
    });

  return cachePromise;
}

/**
 * Hook to load and manage spell data
 * Loads spells in the background on mount
 */
export function useSpellsData(): UseSpellsDataReturn {
  const [spells, setSpells] = useState<ProcessedSpell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load spells on mount
  useEffect(() => {
    let mounted = true;

    const loadSpells = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchSpells();

        if (mounted) {
          setSpells(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading spells:', err);
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to load spells')
          );
          setLoading(false);
        }
      }
    };

    loadSpells();

    return () => {
      mounted = false;
    };
  }, []);

  // Search spells by query
  const searchResults = useCallback(
    (query: string): ProcessedSpell[] => {
      return searchSpells(spells, query);
    },
    [spells]
  );

  // Get spell by ID
  const getSpellById = useCallback(
    (id: string): ProcessedSpell | undefined => {
      return spells.find(spell => spell.id === id);
    },
    [spells]
  );

  // Get spell by name (case-insensitive)
  const getSpellByName = useCallback(
    (name: string): ProcessedSpell | undefined => {
      const nameLower = name.toLowerCase();
      return spells.find(spell => spell.name.toLowerCase() === nameLower);
    },
    [spells]
  );

  return {
    spells,
    loading,
    error,
    searchResults,
    getSpellById,
    getSpellByName,
  };
}

/**
 * Clear the spell cache (useful for testing or when data is updated)
 */
export function clearSpellCache(): void {
  cachedSpells = null;
  cachePromise = null;
}
