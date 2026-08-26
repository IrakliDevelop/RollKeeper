'use client';

import React from 'react';
import {
  ClassFilters,
  SpellcastingType,
  SpellcastingAbility,
  ProficiencyType,
} from '@/types/classes';
import {
  formatSpellcastingType,
  formatSpellcastingAbility,
  formatProficiencyType,
} from '@/utils/classFilters';
import { X, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/layout/card';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';

interface ClassFiltersPanelProps {
  filters: ClassFilters;
  onFiltersChange: (filters: ClassFilters) => void;
  filterOptions: {
    sources: string[];
    spellcastingTypes: SpellcastingType[];
    hitDiceTypes: string[];
  };
  onClearFilters: () => void;
}

const SPELLCASTING_ABILITIES: SpellcastingAbility[] = ['int', 'wis', 'cha'];
const PRIMARY_ABILITIES: ProficiencyType[] = [
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha',
];

export default function ClassFiltersPanel({
  filters,
  onFiltersChange,
  filterOptions,
  onClearFilters,
}: ClassFiltersPanelProps) {
  const updateFilter = <K extends keyof ClassFilters>(
    key: K,
    value: ClassFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = <T,>(
    key: keyof ClassFilters,
    value: T,
    currentArray: T[] = []
  ) => {
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFilter(key, newArray as ClassFilters[typeof key]);
  };

  const hasActiveFilters = Object.values(filters).some(filter =>
    Array.isArray(filter) ? filter.length > 0 : Boolean(filter)
  );

  return (
    <Card
      variant="bordered"
      padding="md"
      className="border-accent-emerald-border/50 bg-surface-secondary ring-accent-emerald-border/20 mb-6 shadow-md ring-1"
    >
      <CardContent className="space-y-6 p-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-accent-emerald-bg-strong rounded-lg p-2">
              <Filter className="text-accent-emerald-text h-4 w-4" />
            </div>
            <h3 className="text-heading text-lg font-semibold">
              Filter Classes
            </h3>
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

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h4 className="text-body mb-3 text-sm font-medium">
              Sources ({filters.sources?.length || 0})
            </h4>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {filterOptions.sources.map(source => (
                <Checkbox
                  key={source}
                  checked={filters.sources?.includes(source) || false}
                  onCheckedChange={() =>
                    toggleArrayFilter('sources', source, filters.sources)
                  }
                  label={source}
                  size="md"
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-body mb-3 text-sm font-medium">
              Spellcasting ({filters.spellcastingTypes?.length || 0})
            </h4>
            <div className="space-y-2">
              {filterOptions.spellcastingTypes.map(type => (
                <Checkbox
                  key={type}
                  checked={filters.spellcastingTypes?.includes(type) || false}
                  onCheckedChange={() =>
                    toggleArrayFilter(
                      'spellcastingTypes',
                      type,
                      filters.spellcastingTypes
                    )
                  }
                  label={formatSpellcastingType(type)}
                  size="md"
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-body mb-3 text-sm font-medium">
              Casting Ability ({filters.spellcastingAbilities?.length || 0})
            </h4>
            <div className="space-y-2">
              {SPELLCASTING_ABILITIES.map(ability => (
                <Checkbox
                  key={ability}
                  checked={
                    filters.spellcastingAbilities?.includes(ability) || false
                  }
                  onCheckedChange={() =>
                    toggleArrayFilter(
                      'spellcastingAbilities',
                      ability,
                      filters.spellcastingAbilities
                    )
                  }
                  label={formatSpellcastingAbility(ability)}
                  size="md"
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-body mb-3 text-sm font-medium">
              Hit Dice ({filters.hitDiceTypes?.length || 0})
            </h4>
            <div className="space-y-2">
              {filterOptions.hitDiceTypes.map(hitDie => (
                <Checkbox
                  key={hitDie}
                  checked={filters.hitDiceTypes?.includes(hitDie) || false}
                  onCheckedChange={() =>
                    toggleArrayFilter(
                      'hitDiceTypes',
                      hitDie,
                      filters.hitDiceTypes
                    )
                  }
                  label={hitDie}
                  size="md"
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-body mb-3 text-sm font-medium">
              Saving Throws ({filters.primaryAbilities?.length || 0})
            </h4>
            <div className="space-y-2">
              {PRIMARY_ABILITIES.map(ability => (
                <Checkbox
                  key={ability}
                  checked={filters.primaryAbilities?.includes(ability) || false}
                  onCheckedChange={() =>
                    toggleArrayFilter(
                      'primaryAbilities',
                      ability,
                      filters.primaryAbilities
                    )
                  }
                  label={formatProficiencyType(ability)}
                  size="md"
                />
              ))}
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="border-divider border-t pt-4">
            <div className="text-muted mb-2 text-sm">Active filters:</div>
            <div className="flex flex-wrap gap-2">
              {filters.sources?.map(source => (
                <Badge
                  key={`source-${source}`}
                  variant="info"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() =>
                        toggleArrayFilter('sources', source, filters.sources)
                      }
                      aria-label={`Remove ${source} filter`}
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  {source}
                </Badge>
              ))}
              {filters.spellcastingTypes?.map(type => (
                <Badge
                  key={`casting-${type}`}
                  variant="secondary"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() =>
                        toggleArrayFilter(
                          'spellcastingTypes',
                          type,
                          filters.spellcastingTypes
                        )
                      }
                      aria-label={`Remove ${type} filter`}
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  {formatSpellcastingType(type)}
                </Badge>
              ))}
              {filters.spellcastingAbilities?.map(ability => (
                <Badge
                  key={`ability-${ability}`}
                  variant="success"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() =>
                        toggleArrayFilter(
                          'spellcastingAbilities',
                          ability,
                          filters.spellcastingAbilities
                        )
                      }
                      aria-label={`Remove ${ability} filter`}
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  {formatSpellcastingAbility(ability)}
                </Badge>
              ))}
              {filters.hitDiceTypes?.map(hitDie => (
                <Badge
                  key={`hitdie-${hitDie}`}
                  variant="warning"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() =>
                        toggleArrayFilter(
                          'hitDiceTypes',
                          hitDie,
                          filters.hitDiceTypes
                        )
                      }
                      aria-label={`Remove ${hitDie} filter`}
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  {hitDie}
                </Badge>
              ))}
              {filters.primaryAbilities?.map(ability => (
                <Badge
                  key={`primary-${ability}`}
                  variant="info"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() =>
                        toggleArrayFilter(
                          'primaryAbilities',
                          ability,
                          filters.primaryAbilities
                        )
                      }
                      aria-label={`Remove ${ability} filter`}
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  {formatProficiencyType(ability)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
