'use client';

import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Card, CardContent } from '@/components/ui/layout/card';
import { Badge } from '@/components/ui/layout/badge';

export interface FeatFilters {
  sources: string[];
  hasPrerequisites: boolean | undefined;
  hasAbilityIncrease: boolean | undefined;
  grantsSpells: boolean | undefined;
  repeatable: boolean | undefined;
}

interface FeatsFiltersPanelProps {
  filters: FeatFilters;
  availableSources: string[];
  onFilterChange: (filters: Partial<FeatFilters>) => void;
  onClearFilters: () => void;
  featCount: number;
  totalFeats: number;
}

export default function FeatsFiltersPanel({
  filters,
  availableSources,
  onFilterChange,
  onClearFilters,
  featCount,
  totalFeats,
}: FeatsFiltersPanelProps) {
  const handleSourceToggle = (source: string) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter(s => s !== source)
      : [...filters.sources, source];
    onFilterChange({ sources: newSources });
  };

  const hasActiveFilters =
    filters.sources.length > 0 ||
    filters.hasPrerequisites !== undefined ||
    filters.hasAbilityIncrease !== undefined ||
    filters.grantsSpells !== undefined ||
    filters.repeatable !== undefined;

  return (
    <Card
      variant="bordered"
      padding="md"
      className="border-accent-amber-border/50 bg-surface-secondary ring-accent-amber-border/20 shadow-md ring-1"
    >
      <CardContent className="space-y-6 p-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-accent-amber-bg-strong rounded-lg p-2">
              <Filter className="text-accent-amber-text h-4 w-4" />
            </div>
            <h3 className="text-heading text-lg font-semibold">Feat Filters</h3>
            <span className="text-muted text-sm">
              {featCount} of {totalFeats}
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
          {/* Properties */}
          <div>
            <h4 className="text-body mb-3 text-sm font-medium">Properties</h4>
            <div className="space-y-2">
              <Checkbox
                checked={filters.hasPrerequisites === true}
                onCheckedChange={checked =>
                  onFilterChange({
                    hasPrerequisites: checked ? true : undefined,
                  })
                }
                label="Has prerequisites"
                size="md"
              />
              <Checkbox
                checked={filters.hasPrerequisites === false}
                onCheckedChange={checked =>
                  onFilterChange({
                    hasPrerequisites: checked ? false : undefined,
                  })
                }
                label="No prerequisites"
                size="md"
              />
              <Checkbox
                checked={filters.hasAbilityIncrease === true}
                onCheckedChange={checked =>
                  onFilterChange({
                    hasAbilityIncrease: checked ? true : undefined,
                  })
                }
                label="Grants ability increase"
                size="md"
              />
              <Checkbox
                checked={filters.grantsSpells === true}
                onCheckedChange={checked =>
                  onFilterChange({ grantsSpells: checked ? true : undefined })
                }
                label="Grants spells"
                size="md"
              />
              <Checkbox
                checked={filters.repeatable === true}
                onCheckedChange={checked =>
                  onFilterChange({ repeatable: checked ? true : undefined })
                }
                label="Repeatable"
                size="md"
              />
            </div>
          </div>

          {/* Sources */}
          <div className="sm:col-span-1 lg:col-span-2 xl:col-span-3">
            <h4 className="text-body mb-3 text-sm font-medium">
              Sources ({filters.sources.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {availableSources.map(source => (
                <button
                  key={source}
                  onClick={() => handleSourceToggle(source)}
                  className={`min-h-[44px] rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    filters.sources.includes(source)
                      ? 'border-accent-amber-border bg-accent-amber-bg text-accent-amber-text'
                      : 'border-divider bg-surface-raised text-body hover:bg-surface-hover'
                  }`}
                  aria-pressed={filters.sources.includes(source)}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active filters summary */}
        {hasActiveFilters && (
          <div className="border-divider border-t pt-4">
            <div className="text-muted mb-2 text-sm">Active filters:</div>
            <div className="flex flex-wrap gap-2">
              {filters.sources.map(source => (
                <Badge
                  key={`source-${source}`}
                  variant="info"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() => handleSourceToggle(source)}
                      aria-label={`Remove ${source} filter`}
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  {source}
                </Badge>
              ))}
              {filters.hasPrerequisites === true && (
                <Badge
                  variant="warning"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() =>
                        onFilterChange({ hasPrerequisites: undefined })
                      }
                      aria-label="Remove prerequisites filter"
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  Has prerequisites
                </Badge>
              )}
              {filters.hasPrerequisites === false && (
                <Badge
                  variant="success"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() =>
                        onFilterChange({ hasPrerequisites: undefined })
                      }
                      aria-label="Remove no prerequisites filter"
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  No prerequisites
                </Badge>
              )}
              {filters.hasAbilityIncrease === true && (
                <Badge
                  variant="info"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() =>
                        onFilterChange({ hasAbilityIncrease: undefined })
                      }
                      aria-label="Remove ability increase filter"
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  Ability increase
                </Badge>
              )}
              {filters.grantsSpells === true && (
                <Badge
                  variant="secondary"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() =>
                        onFilterChange({ grantsSpells: undefined })
                      }
                      aria-label="Remove spells filter"
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  Grants spells
                </Badge>
              )}
              {filters.repeatable === true && (
                <Badge
                  variant="neutral"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() => onFilterChange({ repeatable: undefined })}
                      aria-label="Remove repeatable filter"
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  Repeatable
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
