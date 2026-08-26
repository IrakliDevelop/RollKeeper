'use client';

import { useState, useMemo, useEffect } from 'react';
import { ProcessedMonster, BestiaryFilters } from '@/types/bestiary';
import MonsterCard from './MonsterCard';
import MonsterModal from './MonsterModal';
import BestiaryFiltersPanel from './BestiaryFiltersPanel';
import { filterMonsters } from '@/utils/bestiaryFilters';
import { Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Badge } from '@/components/ui/layout/badge';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface BestiaryCompendiumClientProps {
  initialMonsters: ProcessedMonster[];
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

  useEffect(() => {
    setFilters(prev => ({ ...prev, searchQuery: searchTerm }));
  }, [searchTerm]);

  const filteredAndSortedMonsters = useMemo(() => {
    const monsters = filterMonsters(initialMonsters, filters);
    monsters.sort((a, b) => {
      switch (sortOrder) {
        case 'cr-asc':
          return (parseCr(a.cr) || 0) - (parseCr(b.cr) || 0);
        case 'cr-desc':
          return (parseCr(b.cr) || 0) - (parseCr(a.cr) || 0);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return monsters;
  }, [initialMonsters, filters, sortOrder]);

  const { displayedCount, hasMore, loadMoreRef } = useInfiniteScroll({
    totalItems: filteredAndSortedMonsters.length,
  });

  const visibleMonsters = filteredAndSortedMonsters.slice(0, displayedCount);

  const availableSources = useMemo(() => {
    const sources = new Set(initialMonsters.map(m => m.source));
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

  return (
    <div className="pt-6">
      {/* Sticky toolbar */}
      <div className="bg-surface-raised border-divider sticky top-0 z-20 -mx-4 mb-6 border-b px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 sm:gap-3">
            <div className="max-w-sm flex-1">
              <Input
                placeholder="Search monsters..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                leftIcon={<Search size={16} />}
                clearable
                onClear={() => setSearchTerm('')}
                aria-label="Search monsters"
              />
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <SelectField
                value={sortOrder}
                onValueChange={val => setSortOrder(val)}
                triggerProps={{ className: 'min-w-[140px]' }}
              >
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="cr-asc">CR (Low-High)</SelectItem>
                <SelectItem value="cr-desc">CR (High-Low)</SelectItem>
              </SelectField>
            </div>
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

        <p className="text-muted mt-2 text-sm">
          Showing {visibleMonsters.length} of {filteredAndSortedMonsters.length}{' '}
          monsters
          {filteredAndSortedMonsters.length !== initialMonsters.length && (
            <span> (filtered from {initialMonsters.length} total)</span>
          )}
        </p>
      </div>

      {/* Filters panel - top, not sidebar */}
      {showFilters && (
        <div className="mb-6">
          <BestiaryFiltersPanel
            filters={filters}
            availableSources={availableSources}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
            monsterCount={filteredAndSortedMonsters.length}
            totalMonsters={initialMonsters.length}
          />
        </div>
      )}

      {/* Monster grid */}
      <div>
        {visibleMonsters.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleMonsters.map(monster => (
                <MonsterCard
                  key={monster.id}
                  monster={monster}
                  onClick={() => setSelectedMonster(monster)}
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
              No monsters found matching your criteria.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      <MonsterModal
        monster={selectedMonster}
        onOpenChange={open => !open && setSelectedMonster(null)}
      />
    </div>
  );
}
