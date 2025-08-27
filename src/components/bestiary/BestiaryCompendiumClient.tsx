'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ProcessedMonster, BestiaryFilters } from '@/types/bestiary';
import MonsterCard from './MonsterCard';
import MonsterModal from './MonsterModal';
import BestiaryFiltersPanel from './BestiaryFiltersPanel';
import CustomDropdown, {
  DropdownOption,
} from '@/components/ui/forms/CustomDropdown';
import { filterMonsters } from '@/utils/bestiaryFilters';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Loader2,
  ChevronDown,
  Search,
  Filter,
  ArrowUpAZ,
  ArrowDownAZ,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface BestiaryCompendiumClientProps {
  initialMonsters: ProcessedMonster[];
}

const PAGE_SIZE = 12;
const ITEMS_PER_LOAD = 16;
const SMALL_RESULT_THRESHOLD = 50;

// Skeleton loading component for monster cards
function MonsterCardSkeleton() {
  return (
    <div className="h-60 animate-pulse rounded-lg border border-slate-600/30 bg-slate-800/30 p-5">
      <div className="mb-3 flex items-start justify-between">
        <div className="h-6 w-3/4 rounded bg-slate-600/50"></div>
        <div className="h-6 w-16 rounded-full bg-slate-600/50"></div>
      </div>
      <div className="mb-4 h-4 w-2/3 rounded bg-slate-600/50"></div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-slate-600/50"></div>
          <div className="h-4 w-12 rounded bg-slate-600/50"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-slate-600/50"></div>
          <div className="h-4 w-12 rounded bg-slate-600/50"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-slate-600/50"></div>
          <div className="h-4 w-16 rounded bg-slate-600/50"></div>
        </div>
      </div>
    </div>
  );
}

const parseCr = (cr: string): number => {
  if (cr.includes('/')) {
    const [a, b] = cr.split('/');
    return parseInt(a, 10) / parseInt(b, 10);
  }
  return parseInt(cr, 10);
};

export default function BestiaryCompendiumClient({
  initialMonsters,
}: BestiaryCompendiumClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('name-asc');
  const [selectedMonster, setSelectedMonster] =
    useState<ProcessedMonster | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Infinite scroll state
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Filter state
  const [filters, setFilters] = useState<BestiaryFilters>({
    sizes: [],
    types: [],
    alignments: [],
    crRange: {},
    sources: [],
    searchQuery: '',
    hasLegendaryActions: undefined,
    hasSpellcasting: undefined,
    hasConditionImmunities: undefined,
    hasDamageResistances: undefined,
  });

  // Update filters when search term changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      searchQuery: searchTerm,
    }));
  }, [searchTerm]);

  const filteredAndSortedMonsters = useMemo(() => {
    // Apply filters first
    const monsters = filterMonsters(initialMonsters, filters);

    // Then sort
    monsters.sort((a, b) => {
      switch (sortOrder) {
        case 'cr-asc':
          return (parseCr(a.cr) || 0) - (parseCr(b.cr) || 0);
        case 'cr-desc':
          return (parseCr(b.cr) || 0) - (parseCr(a.cr) || 0);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'name-asc':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return monsters;
  }, [initialMonsters, filters, sortOrder]);

  // Smart loading strategy: show all for small results, progressive for large
  const shouldUseInfiniteScroll =
    filteredAndSortedMonsters.length > SMALL_RESULT_THRESHOLD;
  const visibleMonsters = shouldUseInfiniteScroll
    ? filteredAndSortedMonsters.slice(0, displayedCount)
    : filteredAndSortedMonsters;
  const hasMoreMonsters =
    shouldUseInfiniteScroll &&
    displayedCount < filteredAndSortedMonsters.length;

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedCount(PAGE_SIZE);
  }, [filteredAndSortedMonsters.length]);

  // Load more monsters function
  const loadMoreMonsters = useCallback(async () => {
    if (isLoadingMore || !hasMoreMonsters) return;

    setIsLoadingMore(true);

    // Simulate loading delay for smooth UX
    await new Promise(resolve => setTimeout(resolve, 300));

    setDisplayedCount(prev =>
      Math.min(prev + ITEMS_PER_LOAD, filteredAndSortedMonsters.length)
    );
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMoreMonsters, filteredAndSortedMonsters.length]);

  // Intersection Observer for automatic loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMoreMonsters && !isLoadingMore) {
          loadMoreMonsters();
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
  }, [
    hasMoreMonsters,
    isLoadingMore,
    loadMoreMonsters,
    shouldUseInfiniteScroll,
  ]);

  // Get unique sources for filter options
  const availableSources = useMemo(() => {
    const sources = new Set(initialMonsters.map(monster => monster.source));
    return Array.from(sources).sort();
  }, [initialMonsters]);

  const handleFilterChange = (newFilters: Partial<BestiaryFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      sizes: [],
      types: [],
      alignments: [],
      crRange: {},
      sources: [],
      searchQuery: '',
      hasLegendaryActions: undefined,
      hasSpellcasting: undefined,
      hasConditionImmunities: undefined,
      hasDamageResistances: undefined,
    });
    setSearchTerm('');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sizes.length > 0) count++;
    if (filters.types.length > 0) count++;
    if (filters.alignments.length > 0) count++;
    if (filters.crRange.min !== undefined || filters.crRange.max !== undefined)
      count++;
    if (filters.sources.length > 0) count++;
    if (searchTerm.trim()) count++;
    if (filters.hasLegendaryActions) count++;
    if (filters.hasSpellcasting) count++;
    if (filters.hasConditionImmunities) count++;
    if (filters.hasDamageResistances) count++;
    return count;
  }, [filters, searchTerm]);

  // Sort options for the dropdown
  const sortOptions: DropdownOption[] = [
    {
      value: 'name-asc',
      label: 'Name (A-Z)',
      icon: <ArrowUpAZ className="h-4 w-4" />,
      description: 'Sort alphabetically ascending',
    },
    {
      value: 'name-desc',
      label: 'Name (Z-A)',
      icon: <ArrowDownAZ className="h-4 w-4" />,
      description: 'Sort alphabetically descending',
    },
    {
      value: 'cr-asc',
      label: 'CR (Low to High)',
      icon: <TrendingUp className="h-4 w-4" />,
      description: 'Sort by challenge rating ascending',
    },
    {
      value: 'cr-desc',
      label: 'CR (High to Low)',
      icon: <TrendingDown className="h-4 w-4" />,
      description: 'Sort by challenge rating descending',
    },
  ];

  return (
    <div>
      {/* Enhanced Search and Filter Controls */}
      <div className="mb-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-4">
            {/* Search Bar */}
            <div className="relative max-w-md flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
              <input
                type="text"
                placeholder="Search monsters..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-800/50 py-3 pr-4 pl-10 text-white placeholder-slate-400 transition-all focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-3">
              <span className="text-sm whitespace-nowrap text-slate-400">
                Sort:
              </span>
              <CustomDropdown
                options={sortOptions}
                value={sortOrder}
                onChange={setSortOrder}
                width="auto"
                className="min-w-[200px]"
              />
            </div>
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg px-4 py-3 transition-all ${
              showFilters
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white'
            }`}
          >
            <Filter size={16} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-emerald-500/30 px-2 py-0.5 text-xs text-emerald-200">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-6">
        <p className="text-sm text-slate-400">
          {shouldUseInfiniteScroll ? (
            <>
              Showing {visibleMonsters.length} of{' '}
              {filteredAndSortedMonsters.length} monsters
              {filteredAndSortedMonsters.length !== initialMonsters.length && (
                <span> (filtered from {initialMonsters.length} total)</span>
              )}
            </>
          ) : (
            <>
              Found {filteredAndSortedMonsters.length} monster
              {filteredAndSortedMonsters.length !== 1 ? 's' : ''}
              {filteredAndSortedMonsters.length !== initialMonsters.length && (
                <span> (filtered from {initialMonsters.length} total)</span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col gap-6 xl:flex-row">
        {/* Filters Sidebar */}
        {showFilters && (
          <div className="w-full xl:w-80 xl:flex-shrink-0">
            <div className="sticky top-4">
              <BestiaryFiltersPanel
                filters={filters}
                availableSources={availableSources}
                onFilterChange={handleFilterChange}
                onClearFilters={clearFilters}
                monsterCount={filteredAndSortedMonsters.length}
                totalMonsters={initialMonsters.length}
              />
            </div>
          </div>
        )}

        {/* Monsters Grid */}
        <div className="min-w-0 flex-1">
          {visibleMonsters.length > 0 ? (
            <>
              <AnimatePresence>
                <motion.div
                  className={`grid gap-6 ${
                    showFilters
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  }`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {visibleMonsters.map((monster, i) => (
                    <motion.div
                      key={monster.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <MonsterCard
                        monster={monster}
                        onClick={() => setSelectedMonster(monster)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* Loading More Indicator and Load More Button */}
              {shouldUseInfiniteScroll && (
                <div
                  ref={loadMoreRef}
                  className="mt-8 flex flex-col items-center"
                >
                  {isLoadingMore && (
                    <div
                      className={`mb-6 grid w-full gap-6 ${
                        showFilters
                          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3'
                          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      }`}
                    >
                      {Array.from({
                        length: Math.min(
                          ITEMS_PER_LOAD,
                          filteredAndSortedMonsters.length - displayedCount
                        ),
                      }).map((_, i) => (
                        <MonsterCardSkeleton key={i} />
                      ))}
                    </div>
                  )}

                  {hasMoreMonsters && !isLoadingMore && (
                    <button
                      onClick={loadMoreMonsters}
                      className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-6 py-3 text-emerald-300 backdrop-blur-sm transition-all hover:scale-105 hover:bg-emerald-600/30"
                    >
                      <ChevronDown className="h-4 w-4" />
                      Load More Monsters
                      <span className="text-xs opacity-80">
                        ({filteredAndSortedMonsters.length - displayedCount}{' '}
                        remaining)
                      </span>
                    </button>
                  )}

                  {isLoadingMore && (
                    <div className="flex items-center gap-2 text-emerald-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading more monsters...</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-lg text-slate-400">
                No monsters found matching your criteria.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <MonsterModal
        monster={selectedMonster}
        onOpenChange={open => !open && setSelectedMonster(null)}
      />
    </div>
  );
}
