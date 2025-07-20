'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProcessedClass, ClassFilters } from '@/types/classes';
import { filterClasses, getClassSources, getSpellcastingTypes, getHitDiceTypes } from '@/utils/classFilters';
import { Search, Filter, Shield, Users, Grid, List, Loader2, ChevronDown } from 'lucide-react';
import ClassCard from './ClassCard';
import ClassFiltersPanel from './ClassFiltersPanel';

type ViewMode = 'classes' | 'subclasses';
type DisplayMode = 'grid' | 'list';

interface ClassCompendiumClientProps {
  initialClasses: ProcessedClass[];
}

export default function ClassCompendiumClient({ initialClasses }: ClassCompendiumClientProps) {
  const [classes] = useState<ProcessedClass[]>(initialClasses);
  const [viewMode, setViewMode] = useState<ViewMode>('classes');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Infinite scroll state
  const [displayedCount, setDisplayedCount] = useState(20); // Initial load
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_LOAD = 15;
  const SMALL_RESULT_THRESHOLD = 30;

  const [filters, setFilters] = useState<ClassFilters>({
    sources: [],
    spellcastingTypes: [],
    spellcastingAbilities: [],
    hitDiceTypes: [],
    primaryAbilities: [],
    searchQuery: '',
  });

  // Filter classes based on current filters and search
  const filteredClasses = useMemo(() => {
    const currentFilters = {
      ...filters,
      searchQuery: searchQuery
    };
    
    return filterClasses(classes, currentFilters);
  }, [classes, filters, searchQuery]);

  // Smart loading strategy: show all for small results, progressive for large
  const shouldUseInfiniteScroll = filteredClasses.length > SMALL_RESULT_THRESHOLD;
  const visibleClasses = shouldUseInfiniteScroll 
    ? filteredClasses.slice(0, displayedCount)
    : filteredClasses;
  const hasMoreClasses = shouldUseInfiniteScroll && displayedCount < filteredClasses.length;

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedCount(20);
  }, [filteredClasses.length]);

  // Infinite scroll effect
  useEffect(() => {
    if (!shouldUseInfiniteScroll) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && hasMoreClasses && !isLoadingMore) {
          setIsLoadingMore(true);
          
          // Simulate loading delay for better UX
          await new Promise(resolve => setTimeout(resolve, 300));
          
          setDisplayedCount(prev => Math.min(prev + ITEMS_PER_LOAD, filteredClasses.length));
          setIsLoadingMore(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMoreClasses, isLoadingMore, shouldUseInfiniteScroll, filteredClasses.length]);

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      sources: [],
      spellcastingTypes: [],
      spellcastingAbilities: [],
      hitDiceTypes: [],
      primaryAbilities: [],
      searchQuery: '',
    });
    setSearchQuery('');
  };

  // Get filter options from available classes
  const filterOptions = useMemo(() => ({
    sources: getClassSources(classes),
    spellcastingTypes: getSpellcastingTypes(classes),
    hitDiceTypes: getHitDiceTypes(classes),
  }), [classes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative mb-8">
        {/* Background decorative elements */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5 rounded-lg" />
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        
        <div className="relative bg-slate-800/30 backdrop-blur-sm border border-slate-600/50 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Class icon */}
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border-2 border-emerald-500/30 rounded-lg shadow-lg">
                <Shield className="h-8 w-8 text-emerald-400" />
              </div>
              
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-wide">
                  Class Compendium
                </h1>
                <p className="text-slate-300 text-lg">
                  Explore the paths of adventure and mastery
                </p>
              </div>
            </div>

            {/* Display Mode Toggle */}
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-600/50">
                <button
                  onClick={() => setDisplayMode('grid')}
                  className={`p-2 rounded-md transition-all ${
                    displayMode === 'grid'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                  title="Grid View"
                >
                  <Grid size={18} />
                </button>
                <button
                  onClick={() => setDisplayMode('list')}
                  className={`p-2 rounded-md transition-all ${
                    displayMode === 'list'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                  title="List View"
                >
                  <List size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Navigation */}
      <div className="relative mb-8">
        <div className="flex space-x-1 bg-slate-800/50 backdrop-blur-sm p-1 rounded-lg border border-slate-600/50 shadow-lg">
          {[
            { key: 'classes' as const, label: 'Browse Classes', icon: Shield },
            { key: 'subclasses' as const, label: 'Browse Subclasses', icon: Users }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`flex items-center gap-3 px-6 py-4 rounded-md transition-all font-medium ${
                viewMode === key
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg transform scale-[1.02]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
              {viewMode === key && (
                <div className="w-2 h-2 bg-emerald-200 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
        
        {/* Tab indicator line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      </div>

      {/* Content based on view mode */}
      {viewMode === 'classes' ? (
        <div className="space-y-6">
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search classes, abilities, hit dice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-3">
              {/* Results count */}
              <div className="text-sm text-slate-400 whitespace-nowrap">
                {filteredClasses.length} {filteredClasses.length === 1 ? 'class' : 'classes'}
              </div>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border backdrop-blur-sm ${
                  showFilters
                    ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800/50 border-slate-600/50 text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Filter size={16} />
                <span>Filters</span>
                <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <ClassFiltersPanel
              filters={filters}
              onFiltersChange={setFilters}
              filterOptions={filterOptions}
              onClearFilters={clearFilters}
            />
          )}

          {/* Classes Grid/List */}
          <div className="space-y-6">
            <div className="flex-1">
              {visibleClasses.length > 0 ? (
                <>
                  {/* Classes Grid */}
                  <div className={displayMode === 'grid' 
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                    : 'space-y-4'
                  }>
                    {visibleClasses.map((classData, index) => (
                      <div
                        key={classData.id}
                        className="animate-in fade-in-0 duration-300"
                        style={{ animationDelay: `${(index % ITEMS_PER_LOAD) * 50}ms` }}
                      >
                        <ClassCard
                          classData={classData}
                          displayMode={displayMode}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Loading More Indicator and Load More Button */}
                  {shouldUseInfiniteScroll && (
                    <div className="mt-8 flex flex-col items-center space-y-4">
                      {hasMoreClasses && (
                        <div
                          ref={loadMoreRef}
                          className="flex items-center space-x-2 text-slate-400"
                        >
                          {isLoadingMore ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                              <span>Loading more classes...</span>
                            </>
                          ) : (
                            <span>Scroll to load more classes</span>
                          )}
                        </div>
                      )}
                      
                      {!hasMoreClasses && filteredClasses.length > SMALL_RESULT_THRESHOLD && (
                        <div className="text-slate-400 text-center">
                          <p>All {filteredClasses.length} classes loaded</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-400 text-lg">No classes found matching your criteria.</p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Subclass Browser</h3>
          <p className="text-slate-400">
            Subclass browsing feature coming soon! For now, explore subclasses within their parent classes.
          </p>
        </div>
      )}
    </div>
  );
} 