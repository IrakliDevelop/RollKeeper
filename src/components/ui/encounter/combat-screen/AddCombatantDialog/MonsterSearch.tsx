'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import type { ProcessedMonster } from '@/types/bestiary';

interface MonsterSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: ProcessedMonster[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  onSelect: (m: ProcessedMonster) => void;
  onLoadMore: () => void;
}

export function MonsterSearch({
  query,
  onQueryChange,
  results,
  total,
  hasMore,
  loading,
  loadingMore,
  onSelect,
  onLoadMore,
}: MonsterSearchProps) {
  return (
    <div className="space-y-3 pb-4">
      <div className="relative">
        <Search
          size={14}
          className="text-muted absolute top-1/2 left-[14px] -translate-y-1/2"
        />
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Search the bestiary…"
          className="border-divider bg-surface-raised focus:border-accent-amber-border w-full rounded-[11px] border-[1.5px] py-3 pr-3 pl-9 text-sm focus:outline-none"
        />
      </div>

      {loading && (
        <p className="text-muted py-8 text-center text-sm">Searching…</p>
      )}
      {!loading && results.length === 0 && query.length >= 2 && (
        <p className="text-muted py-8 text-center text-sm">
          No creatures match &ldquo;{query}&rdquo;.
        </p>
      )}

      <div className="space-y-2">
        {results.map(m => {
          const mType = typeof m.type === 'string' ? m.type : m.type.type;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              className="border-divider bg-surface-raised hover:border-accent-purple-border hover:bg-accent-purple-bg w-full rounded-[13px] border-[1.5px] px-[14px] py-3 text-left transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-heading text-[14.5px] font-bold">
                  {m.name}
                </span>
                <span className="bg-accent-purple-bg text-accent-purple-text rounded-full px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap">
                  CR {m.cr}
                </span>
              </div>
              <div className="text-muted mt-0.5 text-xs font-medium">
                {m.hp} HP · AC {m.ac} · {mType}
              </div>
            </button>
          );
        })}
      </div>

      {!loading && hasMore && (
        <div className="flex flex-col items-center gap-1 pt-1">
          <p className="text-muted text-xs font-medium">
            Showing {results.length} of {total}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
