'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ProcessedSpell, SpellFilters, SPELL_SCHOOLS } from '@/types/spells';
import { filterSpells } from '@/utils/spellFilters';
import { useCharacterStore } from '@/store/characterStore';
import { Search, Filter, BookOpen, Star, Settings, Grid, List, Loader2, ChevronDown } from 'lucide-react';
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
    <div className={`animate-pulse ${
      displayMode === 'grid' 
        ? 'bg-slate-800/30 border border-slate-600/30 rounded-lg p-4 h-80'
        : 'bg-slate-800/30 border border-slate-600/30 rounded-lg p-4 h-32'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-600/50 rounded-full"></div>
          <div className="w-4 h-4 bg-slate-600/50 rounded"></div>
        </div>
        <div className="w-16 h-6 bg-slate-600/50 rounded-full"></div>
      </div>
      <div className="w-3/4 h-6 bg-slate-600/50 rounded mb-3"></div>
      <div className="space-y-2">
        <div className="w-full h-4 bg-slate-600/50 rounded"></div>
        <div className="w-2/3 h-4 bg-slate-600/50 rounded"></div>
      </div>
    </div>
  );
}

export default function SpellbookClient({ initialSpells }: SpellbookClientProps) {
  const [spells] = useState<ProcessedSpell[]>(initialSpells);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
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
    unprepareSpell
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
    duration: []
  });

  // Filter spells based on current filters and search
  const filteredSpells = useMemo(() => {
    const currentFilters = {
      ...filters,
      query: searchQuery
    };
    
    return filterSpells(spells, currentFilters);
  }, [spells, filters, searchQuery]);

  // Smart loading strategy: show all for small results, progressive for large
  const shouldUseInfiniteScroll = filteredSpells.length > SMALL_RESULT_THRESHOLD;
  const visibleSpells = shouldUseInfiniteScroll 
    ? filteredSpells.slice(0, displayedCount)
    : filteredSpells;
  const hasMoreSpells = shouldUseInfiniteScroll && displayedCount < filteredSpells.length;

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedCount(30);
  }, [filteredSpells.length]);

  // Load more spells function
  const loadMoreSpells = useCallback(async () => {
    if (isLoadingMore || !hasMoreSpells) return;
    
    setIsLoadingMore(true);
    
    // Simulate loading delay for smooth UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setDisplayedCount(prev => Math.min(prev + ITEMS_PER_LOAD, filteredSpells.length));
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMoreSpells, filteredSpells.length]);

  // Intersection Observer for automatic loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMoreSpells && !isLoadingMore) {
          loadMoreSpells();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
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
      duration: []
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
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 rounded-lg" />
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        
        <div className="relative bg-slate-800/30 backdrop-blur-sm border border-slate-600/50 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Grimoire icon */}
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-600/20 to-amber-800/20 border-2 border-amber-500/30 rounded-lg shadow-lg">
                <BookOpen className="h-8 w-8 text-amber-400" />
              </div>
              
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-wide">
                  Spell Grimoire
                </h1>
                <p className="text-slate-300 text-lg">
                  Discover and manage your magical repertoire
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-slate-700/50 rounded-lg p-1 border border-slate-600/50">
                <button
                  onClick={() => setDisplayMode('grid')}
                  className={`p-3 rounded-md transition-all ${
                    displayMode === 'grid'
                      ? 'bg-amber-600 text-white shadow-lg'
                      : 'text-slate-300 hover:text-white hover:bg-slate-600/50'
                  }`}
                  title="Grid View"
                >
                  <Grid size={20} />
                </button>
                <button
                  onClick={() => setDisplayMode('list')}
                  className={`p-3 rounded-md transition-all ${
                    displayMode === 'list'
                      ? 'bg-amber-600 text-white shadow-lg'
                      : 'text-slate-300 hover:text-white hover:bg-slate-600/50'
                  }`}
                  title="List View"
                >
                  <List size={20} />
                </button>
              </div>
            </div>
          </div>
          
          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative mb-8">
        <div className="flex space-x-1 bg-slate-800/50 backdrop-blur-sm p-1 rounded-lg border border-slate-600/50 shadow-lg">
          {[
            { key: 'browse' as const, label: 'Browse Spells', icon: BookOpen },
            { key: 'spellbook' as const, label: 'Personal Spellbook', icon: BookOpen }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`flex items-center gap-3 px-6 py-4 rounded-md transition-all font-medium ${
                viewMode === key
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg transform scale-[1.02]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
              {viewMode === key && (
                <div className="w-2 h-2 bg-amber-200 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
        
        {/* Tab indicator line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
      </div>

      {/* Content based on view mode */}
      {viewMode === 'browse' ? (
        <div>
          {/* Filters Toggle */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search spells..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                />
              </div>

              {/* Filter Toggle Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  showFilters
                    ? 'bg-amber-600 text-white shadow-lg'
                    : 'bg-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-600/50'
                }`}
              >
                <Filter size={16} />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 bg-amber-500/30 text-amber-200 rounded-full text-xs">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Results Summary */}
            <p className="text-slate-400 text-sm mt-3">
              {shouldUseInfiniteScroll ? (
                <>
                  Showing {visibleSpells.length} of {filteredSpells.length} spells
                  {filteredSpells.length !== spells.length && (
                    <span> (filtered from {spells.length} total)</span>
                  )}
                </>
              ) : (
                <>
                  Found {filteredSpells.length} spell{filteredSpells.length !== 1 ? 's' : ''}
                  {filteredSpells.length !== spells.length && (
                    <span> (filtered from {spells.length} total)</span>
                  )}
                </>
              )}
            </p>
          </div>

          {/* Search and Results */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Filters Sidebar */}
            {showFilters && (
              <div className="lg:w-80">
                <SpellFiltersPanel
                  filters={filters}
                  availableSources={availableSources}
                  onFilterChange={handleFilterChange}
                  onClearFilters={clearFilters}
                  spellCount={filteredSpells.length}
                  totalSpells={spells.length}
                />
              </div>
            )}

            {/* Spells Grid/List */}
            <div className="flex-1">
              {visibleSpells.length > 0 ? (
                <>
                  {/* Spells Grid */}
                  <div className={displayMode === 'grid' 
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                    : 'space-y-3'
                  }>
                    {visibleSpells.map((spell, index) => (
                      <div
                        key={spell.id}
                        className="animate-in fade-in-0 duration-300"
                        style={{ animationDelay: `${(index % ITEMS_PER_LOAD) * 50}ms` }}
                      >
                        <SpellCard
                          spell={spell}
                          displayMode={displayMode}
                          isInSpellbook={isSpellInSpellbook(spell.id)}
                          isFavorite={isSpellFavorite(spell.id)}
                          isPrepared={isSpellPrepared(spell.id)}
                          onAddToSpellbook={() => addSpellToSpellbook(spell.id)}
                          onRemoveFromSpellbook={() => removeSpellFromSpellbook(spell.id)}
                          onToggleFavorite={() => toggleSpellFavorite(spell.id)}
                          onPrepareSpell={() => prepareSpell(spell.id)}
                          onUnprepareSpell={() => unprepareSpell(spell.id)}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Loading More Indicator and Load More Button */}
                  {shouldUseInfiniteScroll && (
                    <div ref={loadMoreRef} className="mt-8 flex flex-col items-center">
                      {isLoadingMore && (
                        <div className={displayMode === 'grid' 
                          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full mb-6'
                          : 'space-y-3 w-full mb-6'
                        }>
                          {Array.from({ length: Math.min(ITEMS_PER_LOAD, filteredSpells.length - displayedCount) }).map((_, i) => (
                            <SpellCardSkeleton key={i} displayMode={displayMode} />
                          ))}
                        </div>
                      )}
                      
                      {hasMoreSpells && !isLoadingMore && (
                        <button
                          onClick={loadMoreSpells}
                          className="flex items-center gap-2 px-6 py-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 rounded-lg transition-all hover:scale-105 backdrop-blur-sm"
                        >
                          <ChevronDown className="h-4 w-4" />
                          Load More Spells
                          <span className="text-xs opacity-80">
                            ({filteredSpells.length - displayedCount} remaining)
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
                <div className="text-center py-12">
                  <p className="text-slate-400 text-lg">No spells found matching your criteria.</p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <PersonalSpellbook allSpells={spells} displayMode={displayMode} />
      )}
    </div>
  );
} 