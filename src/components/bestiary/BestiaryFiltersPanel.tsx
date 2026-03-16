'use client';

import React from 'react';
import {
  BestiaryFilters,
  CREATURE_TYPES,
  ALIGNMENTS,
  SIZES,
} from '@/types/bestiary';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Card, CardContent } from '@/components/ui/layout/card';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Filter, Skull, X } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';

interface BestiaryFiltersPanelProps {
  filters: BestiaryFilters;
  availableSources: string[];
  onFilterChange: (filters: Partial<BestiaryFilters>) => void;
  onClearFilters: () => void;
  monsterCount: number;
  totalMonsters: number;
}

export default function BestiaryFiltersPanel({
  filters,
  availableSources,
  onFilterChange,
  onClearFilters,
  monsterCount,
  totalMonsters,
}: BestiaryFiltersPanelProps) {
  const handleSizeToggle = (size: string) => {
    const newSizes = filters.sizes.includes(size)
      ? filters.sizes.filter(s => s !== size)
      : [...filters.sizes, size];
    onFilterChange({ sizes: newSizes });
  };

  const handleTypeToggle = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    onFilterChange({ types: newTypes });
  };

  const handleAlignmentToggle = (alignment: string) => {
    const newAlignments = filters.alignments.includes(alignment)
      ? filters.alignments.filter(a => a !== alignment)
      : [...filters.alignments, alignment];
    onFilterChange({ alignments: newAlignments });
  };

  const handleCRRangeChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    onFilterChange({ crRange: { ...filters.crRange, [type]: numValue } });
  };

  const crOptions = [
    { label: '0-1', min: 0, max: 1 },
    { label: '2-5', min: 2, max: 5 },
    { label: '6-10', min: 6, max: 10 },
    { label: '11-15', min: 11, max: 15 },
    { label: '16-20', min: 16, max: 20 },
    { label: '21+', min: 21, max: undefined },
  ];

  const handleCRQuickSelect = (min: number, max?: number) => {
    onFilterChange({ crRange: { min, max } });
  };

  const hasActiveFilters =
    filters.sizes.length > 0 ||
    filters.types.length > 0 ||
    filters.alignments.length > 0 ||
    filters.crRange.min !== undefined ||
    filters.crRange.max !== undefined ||
    filters.sources.length > 0 ||
    filters.hasLegendaryActions ||
    filters.hasSpellcasting ||
    filters.hasConditionImmunities ||
    filters.hasDamageResistances;

  return (
    <Card
      variant="bordered"
      padding="md"
      className="border-accent-red-border/50 bg-surface-secondary ring-accent-red-border/20 shadow-md ring-1"
    >
      <CardContent className="space-y-6 p-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-accent-red-bg-strong rounded-lg p-2">
              <Filter className="text-accent-red-text h-4 w-4" />
            </div>
            <h3 className="text-heading text-lg font-semibold">
              Monster Filters
            </h3>
            <span className="text-muted text-sm">
              {monsterCount} of {totalMonsters}
            </span>
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              leftIcon={<X size={14} />}
            >
              Clear All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Challenge Rating */}
          <div>
            <h4 className="text-body mb-3 flex items-center gap-2 text-sm font-medium">
              <Skull className="text-accent-red-text h-4 w-4" /> Challenge
              Rating
            </h4>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {crOptions.map(option => {
                const isSelected =
                  filters.crRange.min === option.min &&
                  filters.crRange.max === option.max;
                return (
                  <button
                    key={option.label}
                    onClick={() => handleCRQuickSelect(option.min, option.max)}
                    className={`min-h-[44px] rounded-lg p-2 text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-accent-red-bg-strong text-accent-red-text border-accent-red-border border'
                        : 'border-divider bg-surface-raised text-body hover:bg-surface-hover border'
                    }`}
                    aria-pressed={isSelected}
                  >
                    CR {option.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                label="Min CR"
                value={filters.crRange.min?.toString() ?? ''}
                onChange={e => handleCRRangeChange('min', e.target.value)}
                placeholder="0"
              />
              <Input
                type="number"
                label="Max CR"
                value={filters.crRange.max?.toString() ?? ''}
                onChange={e => handleCRRangeChange('max', e.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          {/* Size */}
          <div>
            <h4 className="text-body mb-3 text-sm font-medium">Size</h4>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => handleSizeToggle(size)}
                  className={`min-h-[44px] rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    filters.sizes.includes(size)
                      ? 'border-accent-blue-border bg-accent-blue-bg text-accent-blue-text'
                      : 'border-divider bg-surface-raised text-body hover:bg-surface-hover'
                  }`}
                  aria-pressed={filters.sizes.includes(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Creature Type */}
          <div>
            <h4 className="text-body mb-3 text-sm font-medium">
              Creature Type
            </h4>
            <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
              {CREATURE_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => handleTypeToggle(type)}
                  className={`min-h-[44px] rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    filters.types.includes(type)
                      ? 'border-accent-purple-border bg-accent-purple-bg text-accent-purple-text'
                      : 'border-divider bg-surface-raised text-body hover:bg-surface-hover'
                  }`}
                  aria-pressed={filters.types.includes(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Alignment */}
          <div>
            <h4 className="text-body mb-3 text-sm font-medium">Alignment</h4>
            <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
              {ALIGNMENTS.map(alignment => (
                <button
                  key={alignment}
                  onClick={() => handleAlignmentToggle(alignment)}
                  className={`min-h-[44px] rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    filters.alignments.includes(alignment)
                      ? 'border-accent-amber-border bg-accent-amber-bg text-accent-amber-text'
                      : 'border-divider bg-surface-raised text-body hover:bg-surface-hover'
                  }`}
                  aria-pressed={filters.alignments.includes(alignment)}
                >
                  {alignment === 'True Neutral' ? 'Neutral' : alignment}
                </button>
              ))}
            </div>
          </div>

          {/* Special Properties */}
          <div>
            <h4 className="text-body mb-3 text-sm font-medium">
              Special Properties
            </h4>
            <div className="space-y-2">
              <Checkbox
                checked={filters.hasLegendaryActions === true}
                onCheckedChange={checked =>
                  onFilterChange({
                    hasLegendaryActions: checked ? true : undefined,
                  })
                }
                label="Has Legendary Actions"
                size="md"
              />
              <Checkbox
                checked={filters.hasSpellcasting === true}
                onCheckedChange={checked =>
                  onFilterChange({
                    hasSpellcasting: checked ? true : undefined,
                  })
                }
                label="Has Spellcasting"
                size="md"
              />
              <Checkbox
                checked={filters.hasConditionImmunities === true}
                onCheckedChange={checked =>
                  onFilterChange({
                    hasConditionImmunities: checked ? true : undefined,
                  })
                }
                label="Has Condition Immunities"
                size="md"
              />
              <Checkbox
                checked={filters.hasDamageResistances === true}
                onCheckedChange={checked =>
                  onFilterChange({
                    hasDamageResistances: checked ? true : undefined,
                  })
                }
                label="Has Damage Resistances"
                size="md"
              />
            </div>
          </div>

          {/* Sources */}
          {availableSources.length > 1 && (
            <div>
              <h4 className="text-body mb-3 text-sm font-medium">Sources</h4>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {availableSources.map(source => (
                  <Checkbox
                    key={source}
                    checked={filters.sources.includes(source)}
                    onCheckedChange={checked => {
                      const newSources = checked
                        ? [...filters.sources, source]
                        : filters.sources.filter(s => s !== source);
                      onFilterChange({ sources: newSources });
                    }}
                    label={source}
                    size="md"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active filters summary */}
        {hasActiveFilters && (
          <div className="border-divider border-t pt-4">
            <div className="text-muted mb-2 text-sm">Active filters:</div>
            <div className="flex flex-wrap gap-2">
              {filters.sizes.map(size => (
                <Badge
                  key={`size-${size}`}
                  variant="info"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() => handleSizeToggle(size)}
                      aria-label={`Remove ${size} filter`}
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  {size}
                </Badge>
              ))}
              {filters.types.map(type => (
                <Badge
                  key={`type-${type}`}
                  variant="secondary"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() => handleTypeToggle(type)}
                      aria-label={`Remove ${type} filter`}
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  {type}
                </Badge>
              ))}
              {filters.alignments.map(alignment => (
                <Badge
                  key={`align-${alignment}`}
                  variant="warning"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() => handleAlignmentToggle(alignment)}
                      aria-label={`Remove ${alignment} filter`}
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  {alignment}
                </Badge>
              ))}
              {(filters.crRange.min !== undefined ||
                filters.crRange.max !== undefined) && (
                <Badge
                  variant="danger"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() => onFilterChange({ crRange: {} })}
                      aria-label="Remove CR range filter"
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  CR {filters.crRange.min ?? 0}-{filters.crRange.max ?? '30+'}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
