'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { MonsterSearch } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/MonsterSearch';
import { useMonsterSearch } from '@/hooks/useMonsterSearch';
import type { ProcessedMonster } from '@/types/bestiary';

interface BestiaryImportProps {
  /** Name of the creature the form was filled from, if any. */
  sourceName: string | null;
  onSelect: (monster: ProcessedMonster) => void;
  onClear: () => void;
}

export function BestiaryImport({
  sourceName,
  onSelect,
  onClear,
}: BestiaryImportProps) {
  const search = useMonsterSearch();
  const containerRef = useRef<HTMLElement>(null);
  const focusSearchAfterClear = useRef(false);

  // "Clear import" unmounts, so the keyboard position moves to the search field.
  useEffect(() => {
    if (sourceName || !focusSearchAfterClear.current) return;
    focusSearchAfterClear.current = false;
    containerRef.current?.querySelector('input')?.focus();
  }, [sourceName]);

  const handleClear = () => {
    focusSearchAfterClear.current = true;
    onClear();
  };

  const handleSelect = (monster: ProcessedMonster) => {
    onSelect(monster);
    search.setQuery('');
  };

  return (
    <Section
      ref={containerRef}
      level={3}
      heading="Import from the bestiary"
      contentClassName="space-y-3"
    >
      <p className="type-small text-muted">
        Picking a creature fills in this form. You can change every field after.
      </p>
      {sourceName && (
        <div className="flex items-center gap-1">
          <p className="type-small text-muted">Imported from {sourceName}</p>
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label={`Clear import from ${sourceName}`}
            onClick={handleClear}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
      <MonsterSearch
        query={search.query}
        onQueryChange={search.setQuery}
        results={search.results}
        total={search.total}
        hasMore={search.hasMore}
        loading={search.loading}
        loadingMore={search.loadingMore}
        loadMoreError={search.loadMoreError}
        error={search.error}
        onRetry={search.retry}
        onSelect={handleSelect}
        onLoadMore={search.loadMore}
        onRetryLoadMore={search.retryLoadMore}
      />
    </Section>
  );
}
