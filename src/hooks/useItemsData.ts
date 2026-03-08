'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProcessedItem } from '@/types/items';

interface UseItemsDataReturn {
  items: ProcessedItem[];
  loading: boolean;
  error: Error | null;
  getItemById: (id: string) => ProcessedItem | undefined;
  getItemByName: (name: string) => ProcessedItem | undefined;
}

let cachedItems: ProcessedItem[] | null = null;
let cachePromise: Promise<ProcessedItem[]> | null = null;

async function fetchItems(): Promise<ProcessedItem[]> {
  if (cachedItems) return cachedItems;
  if (cachePromise) return cachePromise;

  cachePromise = fetch('/api/items')
    .then(res => {
      if (!res.ok) throw new Error(`Failed to fetch items: ${res.statusText}`);
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

export function useItemsData(): UseItemsDataReturn {
  const [items, setItems] = useState<ProcessedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchItems();
        if (mounted) {
          setItems(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading items:', err);
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to load items')
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
