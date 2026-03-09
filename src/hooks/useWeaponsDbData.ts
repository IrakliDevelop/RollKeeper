'use client';

import { useState, useEffect } from 'react';
import { ProcessedWeapon } from '@/types/items';

interface UseWeaponsDbDataReturn {
  items: ProcessedWeapon[];
  loading: boolean;
  error: Error | null;
}

let cachedItems: ProcessedWeapon[] | null = null;
let cachePromise: Promise<ProcessedWeapon[]> | null = null;

async function fetchWeapons(): Promise<ProcessedWeapon[]> {
  if (cachedItems) return cachedItems;
  if (cachePromise) return cachePromise;

  cachePromise = fetch('/api/weapons-db')
    .then(res => {
      if (!res.ok)
        throw new Error(`Failed to fetch weapons: ${res.statusText}`);
      return res.json();
    })
    .then(data => {
      cachedItems = data.items;
      cachePromise = null;
      return cachedItems!;
    })
    .catch(error => {
      cachePromise = null;
      throw error;
    });

  return cachePromise;
}

export function useWeaponsDbData(): UseWeaponsDbDataReturn {
  const [items, setItems] = useState<ProcessedWeapon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchWeapons();
        if (mounted) {
          setItems(data);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to load weapons')
          );
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return { items, loading, error };
}
