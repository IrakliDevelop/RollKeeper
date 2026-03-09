'use client';

import { useState, useEffect } from 'react';
import { ProcessedArmor } from '@/types/items';

interface UseArmorDbDataReturn {
  items: ProcessedArmor[];
  loading: boolean;
  error: Error | null;
}

let cachedItems: ProcessedArmor[] | null = null;
let cachePromise: Promise<ProcessedArmor[]> | null = null;

async function fetchArmors(): Promise<ProcessedArmor[]> {
  if (cachedItems) return cachedItems;
  if (cachePromise) return cachePromise;

  cachePromise = fetch('/api/armor-db')
    .then(res => {
      if (!res.ok) throw new Error(`Failed to fetch armors: ${res.statusText}`);
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

export function useArmorDbData(): UseArmorDbDataReturn {
  const [items, setItems] = useState<ProcessedArmor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchArmors();
        if (mounted) {
          setItems(data);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to load armors')
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
