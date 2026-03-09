'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProcessedMagicItem } from '@/types/items';

interface UseMagicItemsDataReturn {
  items: ProcessedMagicItem[];
  loading: boolean;
  error: Error | null;
  getItemById: (id: string) => ProcessedMagicItem | undefined;
  getItemByName: (name: string) => ProcessedMagicItem | undefined;
}

let cachedItems: ProcessedMagicItem[] | null = null;
let cachePromise: Promise<ProcessedMagicItem[]> | null = null;

async function fetchMagicItems(): Promise<ProcessedMagicItem[]> {
  if (cachedItems) return cachedItems;
  if (cachePromise) return cachePromise;

  cachePromise = fetch('/api/magic-items')
    .then(res => {
      if (!res.ok)
        throw new Error(`Failed to fetch magic items: ${res.statusText}`);
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

export function useMagicItemsData(): UseMagicItemsDataReturn {
  const [items, setItems] = useState<ProcessedMagicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchMagicItems();
        if (mounted) {
          setItems(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading magic items:', err);
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to load magic items')
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

  const getItemById = useCallback(
    (id: string) => items.find(item => item.id === id),
    [items]
  );

  const getItemByName = useCallback(
    (name: string) => {
      const lower = name.toLowerCase();
      return items.find(item => item.name.toLowerCase() === lower);
    },
    [items]
  );

  return { items, loading, error, getItemById, getItemByName };
}
