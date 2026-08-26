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

export interface UseMonsterSearchResult {
  query: string;
  setQuery: (q: string) => void;
  results: ProcessedMonster[];
  total: number;
  hasMore: boolean;
  /** Initial search in flight. */
  loading: boolean;
  /** Load-more request in flight. */
  loadingMore: boolean;
  loadMore: () => void;
}

/**
 * Debounced bestiary search with load-more pagination for the
 * Add Combatant monster tab. Results come back relevance-ranked
 * from /api/bestiary/search.
 */
export function useMonsterSearch(): UseMonsterSearchResult {
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
      if (res.ok) {
        // Parse first, then guard: json() awaits the body, and a newer
        // search may supersede this one while it is still parsing.
        const data: SearchResponse = await res.json();
        if (searchId === searchIdRef.current) {
          setResults(data.monsters ?? []);
          setTotal(data.total ?? 0);
          setHasMore(data.hasMore ?? false);
        }
      }
    } catch {
      // silently fail
    } finally {
      // Unconditional: a superseded search must never leave the flag
      // stuck (the stale-response guard above still protects the data).
      setLoading(false);
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
      if (res.ok) {
        // Parse first, then guard: json() awaits the body, and a newer
        // search may supersede this request while it is still parsing.
        const data: SearchResponse = await res.json();
        if (searchId === searchIdRef.current) {
          setResults(prev => [...prev, ...(data.monsters ?? [])]);
          setTotal(data.total ?? 0);
          setHasMore(data.hasMore ?? false);
        }
      }
    } catch {
      // silently fail
    } finally {
      // Unconditional: if a new query superseded this request, the
      // searchId guard above already ignored its data, but the flag
      // must still clear or loadMore would be blocked forever.
      setLoadingMore(false);
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
