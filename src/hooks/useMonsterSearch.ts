'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProcessedMonster } from '@/types/bestiary';

const PAGE_SIZE = 20;
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

interface SearchResponse {
  monsters?: ProcessedMonster[];
  total?: number;
  hasMore?: boolean;
}

/**
 * Debounced bestiary search with load-more pagination for the
 * Add Combatant monster tab. Results come back relevance-ranked
 * from /api/bestiary/search.
 */
export function useMonsterSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProcessedMonster[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Incremented per new search so stale responses are ignored.
  const searchIdRef = useRef(0);

  const search = useCallback(async (q: string) => {
    const searchId = ++searchIdRef.current;
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setTotal(0);
      setHasMore(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bestiary/search?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}`
      );
      if (res.ok && searchId === searchIdRef.current) {
        const data: SearchResponse = await res.json();
        setResults(data.monsters ?? []);
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
      }
    } catch {
      // silently fail
    } finally {
      if (searchId === searchIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const searchId = searchIdRef.current;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/bestiary/search?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=${results.length}`
      );
      if (res.ok && searchId === searchIdRef.current) {
        const data: SearchResponse = await res.json();
        setResults(prev => [...prev, ...(data.monsters ?? [])]);
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
      }
    } catch {
      // silently fail
    } finally {
      if (searchId === searchIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [query, results.length, hasMore, loading, loadingMore]);

  useEffect(() => {
    const t = setTimeout(() => search(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, search]);

  return {
    query,
    setQuery,
    results,
    total,
    hasMore,
    loading,
    loadingMore,
    loadMore,
  };
}
