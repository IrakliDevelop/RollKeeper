'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { ProcessedFeat } from '@/utils/featDataLoader';
import { Search, Filter, Grid, List, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Badge } from '@/components/ui/layout/badge';
import FeatCard from './FeatCard';
import FeatsFiltersPanel, { type FeatFilters } from './FeatsFiltersPanel';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface FeatsCompendiumClientProps {
  initialFeats: ProcessedFeat[];
}

type DisplayMode = 'grid' | 'list';
type SortBy = 'name' | 'source';

export default function FeatsCompendiumClient({
  initialFeats,
}: FeatsCompendiumClientProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [filters, setFilters] = useState<FeatFilters>({
    sources: [],
    hasPrerequisites: undefined,
    hasAbilityIncrease: undefined,
    grantsSpells: undefined,
    repeatable: undefined,
  });

  const sortFeats = useCallback(
    (feats: ProcessedFeat[]) => {
      return [...feats].sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (sortBy === 'source') {
          comparison = a.source.localeCompare(b.source);
          if (comparison === 0) comparison = a.name.localeCompare(b.name);
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    },
    [sortBy, sortOrder]
  );

  const filteredAndSortedFeats = useMemo(() => {
    let result = initialFeats;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        feat =>
          feat.name.toLowerCase().includes(q) ||
          feat.description.toLowerCase().includes(q) ||
          feat.prerequisites.some(p => p.toLowerCase().includes(q)) ||
          feat.source.toLowerCase().includes(q)
      );
    }

    if (filters.sources.length > 0) {
      result = result.filter(feat => filters.sources.includes(feat.source));
    }
    if (filters.hasPrerequisites === true) {
      result = result.filter(feat => feat.prerequisites.length > 0);
    }
    if (filters.hasPrerequisites === false) {
      result = result.filter(feat => feat.prerequisites.length === 0);
    }
    if (filters.hasAbilityIncrease === true) {
      result = result.filter(feat => !!feat.abilityIncreases);
    }
    if (filters.grantsSpells === true) {
      result = result.filter(feat => feat.grantsSpells);
    }
    if (filters.repeatable === true) {
      result = result.filter(feat => feat.repeatable);
    }

    return sortFeats(result);
  }, [initialFeats, searchQuery, filters, sortFeats]);

  const { displayedCount, hasMore, loadMoreRef } = useInfiniteScroll({
    totalItems: filteredAndSortedFeats.length,
  });

  const visibleFeats = filteredAndSortedFeats.slice(0, displayedCount);

  const availableSources = useMemo(() => {
    const sources = new Set(initialFeats.map(f => f.source));
    return Array.from(sources).sort();
  }, [initialFeats]);

  const handleFilterChange = (newFilters: Partial<FeatFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      sources: [],
      hasPrerequisites: undefined,
      hasAbilityIncrease: undefined,
      grantsSpells: undefined,
      repeatable: undefined,
    });
    setSearchQuery('');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sources.length > 0) count++;
    if (filters.hasPrerequisites !== undefined) count++;
    if (filters.hasAbilityIncrease !== undefined) count++;
    if (filters.grantsSpells !== undefined) count++;
    if (filters.repeatable !== undefined) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [filters, searchQuery]);

  return (
    <div className="pt-6">
      {/* Sticky toolbar */}
      <div className="bg-surface-raised border-divider sticky top-0 z-20 -mx-4 mb-6 border-b px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 sm:gap-3">
            <div className="max-w-sm flex-1">
              <Input
                placeholder="Search feats..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                leftIcon={<Search size={16} />}
                clearable
                onClear={() => setSearchQuery('')}
                aria-label="Search feats"
              />
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <SelectField
                value={sortBy}
                onValueChange={val => setSortBy(val as SortBy)}
                triggerProps={{ className: 'min-w-[100px]' }}
              >
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="source">Source</SelectItem>
              </SelectField>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                }
                aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                {sortOrder === 'asc' ? (
                  <ArrowUp size={16} />
                ) : (
                  <ArrowDown size={16} />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="border-divider bg-surface flex gap-0.5 rounded-lg border p-0.5">
              <button
                onClick={() => setDisplayMode('grid')}
                className={`min-h-[36px] min-w-[36px] rounded-md p-2 transition-all ${
                  displayMode === 'grid'
                    ? 'bg-accent-amber-bg-strong text-accent-amber-text'
                    : 'text-muted hover:text-heading'
                }`}
                aria-label="Grid view"
                aria-pressed={displayMode === 'grid'}
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => setDisplayMode('list')}
                className={`min-h-[36px] min-w-[36px] rounded-md p-2 transition-all ${
                  displayMode === 'list'
                    ? 'bg-accent-amber-bg-strong text-accent-amber-text'
                    : 'text-muted hover:text-heading'
                }`}
                aria-label="List view"
                aria-pressed={displayMode === 'list'}
              >
                <List size={18} />
              </button>
            </div>

            <Button
              variant={showFilters ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              leftIcon={<Filter size={16} />}
              aria-expanded={showFilters}
            >
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="info" size="sm" className="ml-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        <p className="text-muted mt-2 text-sm">
          Showing {visibleFeats.length} of {filteredAndSortedFeats.length} feats
          {filteredAndSortedFeats.length !== initialFeats.length && (
            <span> (filtered from {initialFeats.length} total)</span>
          )}
        </p>
      </div>

      {/* Filters panel - top */}
      {showFilters && (
        <div className="mb-6">
          <FeatsFiltersPanel
            filters={filters}
            availableSources={availableSources}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
            featCount={filteredAndSortedFeats.length}
            totalFeats={initialFeats.length}
          />
        </div>
      )}

      {/* Feats grid */}
      <div>
        {visibleFeats.length > 0 ? (
          <>
            <div
              className={
                displayMode === 'grid'
                  ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'space-y-3'
              }
            >
              {visibleFeats.map(feat => (
                <FeatCard key={feat.id} feat={feat} displayMode={displayMode} />
              ))}
            </div>

            <div ref={loadMoreRef} className="h-10" />

            {hasMore && (
              <div className="flex justify-center py-4">
                <div className="bg-surface-secondary h-8 w-8 animate-pulse rounded-full" />
              </div>
            )}
          </>
        ) : (
          <div className="py-16 text-center">
            <p className="text-muted mb-4 text-lg">
              No feats found matching your criteria.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
