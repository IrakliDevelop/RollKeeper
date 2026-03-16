'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ProcessedSpell, SpellFilters } from '@/types/spells';
import { filterSpells } from '@/utils/spellFilters';
import { useCharacterStore } from '@/store/characterStore';
import {
  Search,
  Filter,
  BookOpen,
  Grid,
  List,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Badge } from '@/components/ui/layout/badge';
import SpellCard from '@/components/spellbook/SpellCard';
import SpellFiltersPanel from '@/components/spellbook/SpellFiltersPanel';
import PersonalSpellbook from '@/components/spellbook/PersonalSpellbook';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface SpellbookClientProps {
  initialSpells: ProcessedSpell[];
}

type ViewMode = 'browse' | 'spellbook';
type DisplayMode = 'grid' | 'list';

function SpellCardSkeleton({ displayMode }: { displayMode: DisplayMode }) {
  return (
    <div
      className={`border-divider bg-surface-raised animate-pulse rounded-lg border p-4 ${
        displayMode === 'grid' ? 'h-80' : 'h-32'
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-surface-secondary h-8 w-8 rounded-full" />
          <div className="bg-surface-secondary h-4 w-4 rounded" />
        </div>
        <div className="bg-surface-secondary h-6 w-16 rounded-full" />
      </div>
      <div className="bg-surface-secondary mb-3 h-6 w-3/4 rounded" />
      <div className="space-y-2">
        <div className="bg-surface-secondary h-4 w-full rounded" />
        <div className="bg-surface-secondary h-4 w-2/3 rounded" />
      </div>
    </div>
  );
}

export default function SpellbookClient({
  initialSpells,
}: SpellbookClientProps) {
  const [spells] = useState<ProcessedSpell[]>(initialSpells);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'level'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const {
    character,
    addSpellToSpellbook,
    removeSpellFromSpellbook,
    toggleSpellFavorite,
    prepareSpell,
    unprepareSpell,
  } = useCharacterStore();

  const [filters, setFilters] = useState<SpellFilters>({
    levels: [],
    schools: [],
    classes: [],
    sources: [],
    components: [],
    concentration: undefined,
    ritual: undefined,
    searchQuery: '',
    castingTime: [],
    duration: [],
  });

  const sortSpells = useCallback(
    (spellsToSort: ProcessedSpell[]) => {
      const sorted = [...spellsToSort].sort((a, b) => {
        if (sortBy === 'name') {
          const comparison = a.name.localeCompare(b.name);
          return sortOrder === 'asc' ? comparison : -comparison;
        } else if (sortBy === 'level') {
          const levelComparison = a.level - b.level;
          if (levelComparison === 0) return a.name.localeCompare(b.name);
          return sortOrder === 'asc' ? levelComparison : -levelComparison;
        }
        return 0;
      });
      return sorted;
    },
    [sortBy, sortOrder]
  );

  const filteredAndSortedSpells = useMemo(() => {
    const currentFilters = { ...filters, query: searchQuery };
    const filtered = filterSpells(spells, currentFilters);
    return sortSpells(filtered);
  }, [spells, filters, searchQuery, sortSpells]);

  const { displayedCount, hasMore, loadMoreRef } = useInfiniteScroll({
    totalItems: filteredAndSortedSpells.length,
  });

  const visibleSpells = filteredAndSortedSpells.slice(0, displayedCount);

  const availableSources = useMemo(() => {
    const sources = new Set(spells.map(spell => spell.source));
    return Array.from(sources).sort();
  }, [spells]);

  const handleFilterChange = (newFilters: Partial<SpellFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      levels: [],
      schools: [],
      classes: [],
      sources: [],
      components: [],
      concentration: undefined,
      ritual: undefined,
      searchQuery: '',
      castingTime: [],
      duration: [],
    });
    setSearchQuery('');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.levels.length > 0) count++;
    if (filters.schools.length > 0) count++;
    if (filters.classes.length > 0) count++;
    if (filters.sources.length > 0) count++;
    if (filters.components.length > 0) count++;
    if (filters.concentration !== undefined) count++;
    if (filters.ritual !== undefined) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [filters, searchQuery]);

  const isSpellInSpellbook = (spellId: string) =>
    character.spellbook?.knownSpells?.includes(spellId) || false;
  const isSpellFavorite = (spellId: string) =>
    character.spellbook?.favoriteSpells?.includes(spellId) || false;
  const isSpellPrepared = (spellId: string) =>
    character.spellbook?.preparedSpells?.includes(spellId) || false;

  return (
    <div className="space-y-6 pt-6">
      {/* Tab Navigation */}
      <div className="border-divider bg-surface-raised flex gap-1 rounded-xl border p-1">
        {[
          { key: 'browse' as const, label: 'Browse Spells', icon: BookOpen },
          {
            key: 'spellbook' as const,
            label: 'Personal Spellbook',
            icon: BookOpen,
          },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition-all sm:text-base ${
              viewMode === key
                ? 'bg-accent-purple-bg-strong text-accent-purple-text shadow-sm'
                : 'text-muted hover:bg-surface-hover hover:text-heading'
            }`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {viewMode === 'browse' ? (
        <div>
          {/* Sticky toolbar */}
          <div className="bg-surface-raised border-divider sticky top-0 z-20 -mx-4 mb-6 border-b px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 sm:gap-3">
                <div className="max-w-sm flex-1">
                  <Input
                    placeholder="Search spells..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    leftIcon={<Search size={16} />}
                    clearable
                    onClear={() => setSearchQuery('')}
                    aria-label="Search spells"
                  />
                </div>

                <div className="hidden items-center gap-2 sm:flex">
                  <SelectField
                    value={sortBy}
                    onValueChange={val => setSortBy(val as 'name' | 'level')}
                    triggerProps={{ className: 'min-w-[100px]' }}
                  >
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="level">Level</SelectItem>
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
                        ? 'bg-accent-purple-bg-strong text-accent-purple-text'
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
                        ? 'bg-accent-purple-bg-strong text-accent-purple-text'
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
              Showing {visibleSpells.length} of {filteredAndSortedSpells.length}{' '}
              spells
              {filteredAndSortedSpells.length !== spells.length && (
                <span> (filtered from {spells.length} total)</span>
              )}
            </p>
          </div>

          {/* Filters panel - top, not sidebar */}
          {showFilters && (
            <div className="mb-6">
              <SpellFiltersPanel
                filters={filters}
                availableSources={availableSources}
                onFilterChange={handleFilterChange}
                onClearFilters={clearFilters}
                spellCount={filteredAndSortedSpells.length}
                totalSpells={spells.length}
              />
            </div>
          )}

          {/* Spell grid */}
          <div>
            {visibleSpells.length > 0 ? (
              <>
                <div
                  className={
                    displayMode === 'grid'
                      ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : 'space-y-3'
                  }
                >
                  {visibleSpells.map(spell => (
                    <SpellCard
                      key={spell.id}
                      spell={spell}
                      displayMode={displayMode}
                      isInSpellbook={isSpellInSpellbook(spell.id)}
                      isFavorite={isSpellFavorite(spell.id)}
                      isPrepared={isSpellPrepared(spell.id)}
                      onAddToSpellbook={() => addSpellToSpellbook(spell.id)}
                      onRemoveFromSpellbook={() =>
                        removeSpellFromSpellbook(spell.id)
                      }
                      onToggleFavorite={() => toggleSpellFavorite(spell.id)}
                      onPrepareSpell={() => prepareSpell(spell.id)}
                      onUnprepareSpell={() => unprepareSpell(spell.id)}
                    />
                  ))}
                </div>

                {/* Infinite scroll sentinel */}
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
                  No spells found matching your criteria.
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <PersonalSpellbook
          allSpells={spells}
          displayMode={displayMode}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      )}
    </div>
  );
}
