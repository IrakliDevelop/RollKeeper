'use client';

import React, { useState, useMemo } from 'react';
import { ProcessedClass, ClassFilters } from '@/types/classes';
import {
  filterClasses,
  getClassSources,
  getSpellcastingTypes,
  getHitDiceTypes,
} from '@/utils/classFilters';
import { Search, Filter, Shield, Users, Grid, List } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import ClassCard from './ClassCard';
import ClassFiltersPanel from './ClassFiltersPanel';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

type ViewMode = 'classes' | 'subclasses';
type DisplayMode = 'grid' | 'list';

interface ClassCompendiumClientProps {
  initialClasses: ProcessedClass[];
}

export default function ClassCompendiumClient({
  initialClasses,
}: ClassCompendiumClientProps) {
  const [classes] = useState<ProcessedClass[]>(initialClasses);
  const [viewMode, setViewMode] = useState<ViewMode>('classes');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [filters, setFilters] = useState<ClassFilters>({
    sources: [],
    spellcastingTypes: [],
    spellcastingAbilities: [],
    hitDiceTypes: [],
    primaryAbilities: [],
    searchQuery: '',
  });

  const filteredClasses = useMemo(() => {
    return filterClasses(classes, { ...filters, searchQuery });
  }, [classes, filters, searchQuery]);

  const { displayedCount, hasMore, loadMoreRef } = useInfiniteScroll({
    totalItems: filteredClasses.length,
  });

  const visibleClasses = filteredClasses.slice(0, displayedCount);

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

  const filterOptions = useMemo(
    () => ({
      sources: getClassSources(classes),
      spellcastingTypes: getSpellcastingTypes(classes),
      hitDiceTypes: getHitDiceTypes(classes),
    }),
    [classes]
  );

  return (
    <div className="space-y-6 pt-6">
      {/* Tab Navigation */}
      <div className="border-divider bg-surface-raised flex gap-1 rounded-xl border p-1">
        {[
          { key: 'classes' as const, label: 'Browse Classes', icon: Shield },
          {
            key: 'subclasses' as const,
            label: 'Browse Subclasses',
            icon: Users,
          },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition-all sm:text-base ${
              viewMode === key
                ? 'bg-accent-emerald-bg-strong text-accent-emerald-text shadow-sm'
                : 'text-muted hover:bg-surface-hover hover:text-heading'
            }`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {viewMode === 'classes' ? (
        <div>
          {/* Sticky toolbar */}
          <div className="bg-surface-raised border-divider sticky top-0 z-20 -mx-4 mb-6 border-b px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 sm:gap-3">
                <div className="max-w-sm flex-1">
                  <Input
                    placeholder="Search classes..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    leftIcon={<Search size={16} />}
                    clearable
                    onClear={() => setSearchQuery('')}
                    aria-label="Search classes"
                  />
                </div>
                <span className="text-muted hidden text-sm sm:inline">
                  {filteredClasses.length}{' '}
                  {filteredClasses.length === 1 ? 'class' : 'classes'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="border-divider bg-surface flex gap-0.5 rounded-lg border p-0.5">
                  <button
                    onClick={() => setDisplayMode('grid')}
                    className={`min-h-[36px] min-w-[36px] rounded-md p-2 transition-all ${
                      displayMode === 'grid'
                        ? 'bg-accent-emerald-bg-strong text-accent-emerald-text'
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
                        ? 'bg-accent-emerald-bg-strong text-accent-emerald-text'
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
                </Button>
              </div>
            </div>
          </div>

          {/* Filters panel - top, not sidebar */}
          {showFilters && (
            <ClassFiltersPanel
              filters={filters}
              onFiltersChange={setFilters}
              filterOptions={filterOptions}
              onClearFilters={clearFilters}
            />
          )}

          {/* Class grid */}
          <div className="mt-6">
            {visibleClasses.length > 0 ? (
              <>
                <div
                  className={
                    displayMode === 'grid'
                      ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : 'space-y-4'
                  }
                >
                  {visibleClasses.map(classData => (
                    <ClassCard
                      key={classData.id}
                      classData={classData}
                      displayMode={displayMode}
                    />
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
                  No classes found matching your criteria.
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-16 text-center">
          <Users className="text-muted mx-auto mb-4 h-16 w-16" />
          <h3 className="text-heading mb-2 text-xl font-semibold">
            Subclass Browser
          </h3>
          <p className="text-muted">
            Subclass browsing feature coming soon! For now, explore subclasses
            within their parent classes.
          </p>
        </div>
      )}
    </div>
  );
}
