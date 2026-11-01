'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Badge } from '@/components/ui/layout/badge';
import type { ProcessedMonster } from '@/types/bestiary';

interface MonsterSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: ProcessedMonster[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  onRetry: () => void;
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
  error,
  onRetry,
  onSelect,
  onLoadMore,
}: MonsterSearchProps) {
  return (
    <div className="space-y-3 pb-4">
      <Input
        value={query}
        onChange={event => onQueryChange(event.target.value)}
        placeholder="Search the bestiary…"
        aria-label="Search the bestiary"
        leftIcon={<Search size={16} />}
        size="sm"
      />

      {loading && (
        <p className="text-muted py-8 text-center text-sm">Searching…</p>
      )}
      {!loading && error && (
        <div className="py-6 text-center">
          <p className="text-body text-sm">Bestiary didn&apos;t load.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            className="mt-2"
          >
            Retry search
          </Button>
        </div>
      )}
      {!loading && !error && results.length === 0 && query.length >= 2 && (
        <p className="text-muted py-8 text-center text-sm">
          No creatures match &ldquo;{query}&rdquo;.
        </p>
      )}

      <div className="border-divider border-t">
        {results.map(m => {
          const mType = typeof m.type === 'string' ? m.type : m.type.type;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              className="hover:bg-surface-hover border-divider w-full border-b py-3 text-left pointer-coarse:min-h-11"
            >
              <div className="flex items-center justify-between">
                <span className="text-heading text-[14.5px] font-bold">
                  {m.name}
                </span>
                <Badge variant="neutral" size="sm">
                  CR {m.cr}
                </Badge>
              </div>
              <div className="text-muted mt-0.5 text-xs font-medium">
                {m.hp} HP · AC {m.ac} · {mType}
              </div>
            </button>
          );
        })}
      </div>

      {!loading && !error && hasMore && (
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
