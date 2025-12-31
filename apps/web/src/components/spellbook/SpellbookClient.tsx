'use client';

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { ProcessedSpell, SpellFilters } from '@/types/spells';
import { filterSpells } from '@/utils/spellFilters';
import { useCharacterStore } from '@/store/characterStore';
import {
  Search,
  Filter,
  BookOpen,
  Grid,
  List,
  Loader2,
  ChevronDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import SpellCard from '@/components/spellbook/SpellCard';
import SpellFiltersPanel from '@/components/spellbook/SpellFiltersPanel';
import PersonalSpellbook from '@/components/spellbook/PersonalSpellbook';

interface SpellbookClientProps {
  initialSpells: ProcessedSpell[];
}

type ViewMode = 'browse' | 'spellbook';
type DisplayMode = 'grid' | 'list';

// Skeleton loading component for spell cards
function SpellCardSkeleton({ displayMode }: { displayMode: DisplayMode }) {
  return (
    <div
      className={`animate-pulse ${
        displayMode === 'grid'
          ? 'h-80 rounded-lg border border-slate-600/30 bg-slate-800/30 p-4'
          : 'h-32 rounded-lg border border-slate-600/30 bg-slate-800/30 p-4'
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-slate-600/50"></div>
          <div className="h-4 w-4 rounded bg-slate-600/50"></div>
        </div>
        <div className="h-6 w-16 rounded-full bg-slate-600/50"></div>
      </div>
      <div className="mb-3 h-6 w-3/4 rounded bg-slate-600/50"></div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-slate-600/50"></div>
        <div className="h-4 w-2/3 rounded bg-slate-600/50"></div>
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

  // Infinite scroll state
  const [displayedCount, setDisplayedCount] = useState(30); // Initial load
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_LOAD = 20;
  const SMALL_RESULT_THRESHOLD = 50;

  // Get character spellbook data and actions
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

  // Sort spells function
  const sortSpells = useCallback(
    (spells: ProcessedSpell[]) => {
      const sorted = [...spells].sort((a, b) => {
        if (sortBy === 'name') {
          const comparison = a.name.localeCompare(b.name);
          return sortOrder === 'asc' ? comparison : -comparison;
        } else if (sortBy === 'level') {
          const levelComparison = a.level - b.level;
          if (levelComparison === 0) {
            // If levels are equal, sort by name as secondary
            return a.name.localeCompare(b.name);
          }
          return sortOrder === 'asc' ? levelComparison : -levelComparison;
        }
        return 0;
      });
      return sorted;
    },
    [sortBy, sortOrder]
  );

  // Filter and sort spells based on current filters and search
  const filteredAndSortedSpells = useMemo(() => {
    const currentFilters = {
      ...filters,
      query: searchQuery,
    };

    const filtered = filterSpells(spells, currentFilters);
    return sortSpells(filtered);
  }, [spells, filters, searchQuery, sortSpells]);

  // Smart loading strategy: show all for small results, progressive for large
  const shouldUseInfiniteScroll =
    filteredAndSortedSpells.length > SMALL_RESULT_THRESHOLD;
  const visibleSpells = shouldUseInfiniteScroll
    ? filteredAndSortedSpells.slice(0, displayedCount)
    : filteredAndSortedSpells;
  const hasMoreSpells =
    shouldUseInfiniteScroll && displayedCount < filteredAndSortedSpells.length;

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedCount(30);
  }, [filteredAndSortedSpells.length]);

  // Load more spells function
  const loadMoreSpells = useCallback(async () => {
    if (isLoadingMore || !hasMoreSpells) return;

    setIsLoadingMore(true);

    // Simulate loading delay for smooth UX
    await new Promise(resolve => setTimeout(resolve, 300));

    setDisplayedCount(prev =>
      Math.min(prev + ITEMS_PER_LOAD, filteredAndSortedSpells.length)
    );
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMoreSpells, filteredAndSortedSpells.length]);

  // Intersection Observer for automatic loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMoreSpells && !isLoadingMore) {
          loadMoreSpells();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef && shouldUseInfiniteScroll) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMoreSpells, isLoadingMore, loadMoreSpells, shouldUseInfiniteScroll]);

  // Get unique sources for filter options
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

  // Helper functions to check spell status
  const isSpellInSpellbook = (spellId: string) => {
    return character.spellbook?.knownSpells?.includes(spellId) || false;
  };

  const isSpellFavorite = (spellId: string) => {
    return character.spellbook?.favoriteSpells?.includes(spellId) || false;
  };

  const isSpellPrepared = (spellId: string) => {
    return character.spellbook?.preparedSpells?.includes(spellId) || false;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative mb-8">
        {/* Background decorative elements */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5" />
        <div className="absolute top-0 right-1/4 left-1/4 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

        <div className="relative rounded-lg border border-slate-600/50 bg-slate-800/30 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Grimoire icon */}
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-amber-500/30 bg-gradient-to-br from-amber-600/20 to-amber-800/20 shadow-lg">
                <BookOpen className="h-8 w-8 text-amber-400" />
              </div>

              <div>
                <h1 className="mb-2 text-4xl font-bold tracking-wide text-white">
                  Spell Grimoire
                </h1>
                <p className="text-lg text-slate-300">
                  Discover and manage your magical repertoire
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-4">
              <div className="flex items-center rounded-lg border border-slate-600/50 bg-slate-700/50 p-1">
                <button
                  onClick={() => setDisplayMode('grid')}
                  className={`rounded-md p-3 transition-all ${
                    displayMode === 'grid'
                      ? 'bg-amber-600 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-600/50 hover:text-white'
                  }`}
                  title="Grid View"
                >
                  <Grid size={20} />
                </button>
                <button
                  onClick={() => setDisplayMode('list')}
                  className={`rounded-md p-3 transition-all ${
                    displayMode === 'list'
                      ? 'bg-amber-600 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-600/50 hover:text-white'
                  }`}
                  title="List View"
                >
                  <List size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom accent line */}
          <div className="absolute right-1/3 bottom-0 left-1/3 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative mb-8">
        <div className="flex space-x-1 rounded-lg border border-slate-600/50 bg-slate-800/50 p-1 shadow-lg backdrop-blur-sm">
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
              className={`flex items-center gap-3 rounded-md px-6 py-4 font-medium transition-all ${
                viewMode === key
                  ? 'scale-[1.02] transform bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
              {viewMode === key && (
                <div className="h-2 w-2 animate-pulse rounded-full bg-amber-200" />
              )}
            </button>
          ))}
        </div>

        {/* Tab indicator line */}
        <div className="absolute right-0 bottom-0 left-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
      </div>

      {/* Content based on view mode */}
      {viewMode === 'browse' ? (
        <div>
          {/* Filters Toggle */}
          <div className="mb-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-4">
                {/* Search Bar */}
                <div className="relative max-w-md flex-1">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search spells..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-slate-600/50 bg-slate-800/50 py-2 pr-4 pl-10 text-white placeholder-slate-400 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 focus:outline-none"
                  />
                </div>

                {/* Sort Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-sm whitespace-nowrap text-slate-400">
                    Sort by:
                  </span>
                  <select
                    value={sortBy}
                    onChange={e =>
                      setSortBy(e.target.value as 'name' | 'level')
                    }
                    className="rounded-lg border border-slate-600/50 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 focus:outline-none"
                  >
                    <option value="name">Name</option>
                    <option value="level">Level</option>
                  </select>
                  <button
                    onClick={() =>
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    }
                    className="rounded-lg border border-slate-600/50 bg-slate-800/50 p-2 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white"
                    title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                  >
                    {sortOrder === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Filter Toggle Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
                  showFilters
                    ? 'bg-amber-600 text-white shadow-lg'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white'
                }`}
              >
                <Filter size={16} />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-amber-500/30 px-2 py-0.5 text-xs text-amber-200">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Results Summary */}
            <p className="mt-3 text-sm text-slate-400">
              {shouldUseInfiniteScroll ? (
                <>
                  Showing {visibleSpells.length} of{' '}
                  {filteredAndSortedSpells.length} spells
                  {filteredAndSortedSpells.length !== spells.length && (
                    <span> (filtered from {spells.length} total)</span>
                  )}
                </>
              ) : (
                <>
                  Found {filteredAndSortedSpells.length} spell
                  {filteredAndSortedSpells.length !== 1 ? 's' : ''}
                  {filteredAndSortedSpells.length !== spells.length && (
                    <span> (filtered from {spells.length} total)</span>
                  )}
                </>
              )}
            </p>
          </div>

          {/* Search and Results */}
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Filters Sidebar */}
            {showFilters && (
              <div className="lg:w-80">
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

            {/* Spells Grid/List */}
            <div className="flex-1">
              {visibleSpells.length > 0 ? (
                <>
                  {/* Spells Grid */}
                  <div
                    className={
                      displayMode === 'grid'
                        ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        : 'space-y-3'
                    }
                  >
                    {visibleSpells.map((spell, index) => (
                      <div
                        key={spell.id}
                        className="animate-in fade-in-0 duration-300"
                        style={{
                          animationDelay: `${(index % ITEMS_PER_LOAD) * 50}ms`,
                        }}
                      >
                        <SpellCard
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
                      </div>
                    ))}
                  </div>

                  {/* Loading More Indicator and Load More Button */}
                  {shouldUseInfiniteScroll && (
                    <div
                      ref={loadMoreRef}
                      className="mt-8 flex flex-col items-center"
                    >
                      {isLoadingMore && (
                        <div
                          className={
                            displayMode === 'grid'
                              ? 'mb-6 grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                              : 'mb-6 w-full space-y-3'
                          }
                        >
                          {Array.from({
                            length: Math.min(
                              ITEMS_PER_LOAD,
                              filteredAndSortedSpells.length - displayedCount
                            ),
                          }).map((_, i) => (
                            <SpellCardSkeleton
                              key={i}
                              displayMode={displayMode}
                            />
                          ))}
                        </div>
                      )}

                      {hasMoreSpells && !isLoadingMore && (
                        <button
                          onClick={loadMoreSpells}
                          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-600/20 px-6 py-3 text-amber-300 backdrop-blur-sm transition-all hover:scale-105 hover:bg-amber-600/30"
                        >
                          <ChevronDown className="h-4 w-4" />
                          Load More Spells
                          <span className="text-xs opacity-80">
                            ({filteredAndSortedSpells.length - displayedCount}{' '}
                            remaining)
                          </span>
                        </button>
                      )}

                      {isLoadingMore && (
                        <div className="flex items-center gap-2 text-amber-300">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading more spells...</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-lg text-slate-400">
                    No spells found matching your criteria.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-white transition-colors hover:bg-amber-700"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
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
