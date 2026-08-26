'use client';

import React from 'react';
import {
  SpellFilters,
  SPELL_SCHOOLS,
  SpellSchool,
  SpellClass,
} from '@/types/spells';
import { useCharacterStore } from '@/store/characterStore';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Card, CardContent } from '@/components/ui/layout/card';
import { Badge } from '@/components/ui/layout/badge';

interface SpellFiltersPanelProps {
  filters: SpellFilters;
  availableSources: string[];
  onFilterChange: (filters: Partial<SpellFilters>) => void;
  onClearFilters: () => void;
  spellCount: number;
  totalSpells: number;
}

export default function SpellFiltersPanel({
  filters,
  availableSources,
  onFilterChange,
  onClearFilters,
  spellCount,
  totalSpells,
}: SpellFiltersPanelProps) {
  const { character } = useCharacterStore();

  const handleLevelToggle = (level: number) => {
    const newLevels = filters.levels.includes(level)
      ? filters.levels.filter(l => l !== level)
      : [...filters.levels, level];
    onFilterChange({ levels: newLevels });
  };

  const handleSchoolToggle = (school: SpellSchool) => {
    const newSchools = filters.schools.includes(school)
      ? filters.schools.filter(s => s !== school)
      : [...filters.schools, school];
    onFilterChange({ schools: newSchools });
  };

  const handleClassToggle = (className: SpellClass) => {
    const newClasses = filters.classes.includes(className)
      ? filters.classes.filter(c => c !== className)
      : [...filters.classes, className];
    onFilterChange({ classes: newClasses });
  };

  const handleCharacterClassFilter = () => {
    const characterClassName = character.class?.name?.toLowerCase() || '';
    const classMap: Record<string, SpellClass> = {
      fighter: 'eldritch knight',
      rogue: 'arcane trickster',
    };
    const spellClassName =
      (classMap[characterClassName] as SpellClass) ||
      (characterClassName as SpellClass);

    if (filters.classes.includes(spellClassName)) {
      onFilterChange({
        classes: filters.classes.filter(c => c !== spellClassName),
      });
    } else {
      onFilterChange({ classes: [...filters.classes, spellClassName] });
    }
  };

  const availableClasses: SpellClass[] = [
    'artificer',
    'bard',
    'cleric',
    'druid',
    'paladin',
    'ranger',
    'sorcerer',
    'warlock',
    'wizard',
    'eldritch knight',
    'arcane trickster',
  ];

  const characterClassName = character.class?.name?.toLowerCase() || '';
  const classMap: Record<string, SpellClass> = {
    fighter: 'eldritch knight',
    rogue: 'arcane trickster',
  };
  const spellClassName =
    (classMap[characterClassName] as SpellClass) ||
    (characterClassName as SpellClass);
  const isCharacterClassFiltered = filters.classes.includes(spellClassName);

  const hasActiveFilters =
    filters.levels.length > 0 ||
    filters.schools.length > 0 ||
    filters.classes.length > 0 ||
    filters.sources.length > 0 ||
    filters.components.length > 0 ||
    filters.concentration !== undefined ||
    filters.ritual !== undefined;

  return (
    <Card
      variant="bordered"
      padding="md"
      className="border-accent-purple-border/50 bg-surface-secondary ring-accent-purple-border/20 shadow-md ring-1"
    >
      <CardContent className="space-y-6 p-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-accent-purple-bg-strong rounded-lg p-2">
              <Filter className="text-accent-purple-text h-4 w-4" />
            </div>
            <h3 className="text-heading text-lg font-semibold">
              Spell Filters
            </h3>
            <span className="text-muted text-sm">
              {spellCount} of {totalSpells}
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
          {/* Character Class Quick Filter */}
          {character.class?.spellcaster !== 'none' && character.class?.name && (
            <div>
              <h4 className="text-body mb-3 text-sm font-medium">
                Character Class
              </h4>
              <button
                onClick={handleCharacterClassFilter}
                className={`flex min-h-[44px] w-full items-center justify-between rounded-lg border p-3 transition-all ${
                  isCharacterClassFiltered
                    ? 'border-accent-purple-border bg-accent-purple-bg text-accent-purple-text'
                    : 'border-divider bg-surface-raised text-body hover:bg-surface-hover'
                }`}
                aria-pressed={isCharacterClassFiltered}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-3 w-3 rounded-full ${isCharacterClassFiltered ? 'bg-accent-purple-bg-strong' : 'bg-surface-secondary'}`}
                  />
                  <span className="font-medium capitalize">
                    {character.class.name} Spells
                  </span>
                </div>
                <Badge
                  variant={isCharacterClassFiltered ? 'primary' : 'neutral'}
                  size="sm"
                >
                  {isCharacterClassFiltered ? 'Active' : 'Show Only'}
                </Badge>
              </button>
            </div>
          )}

          {/* Spell Levels */}
          <div>
            <h4 className="text-body mb-3 text-sm font-medium">Spell Level</h4>
            <div className="grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => (
                <button
                  key={level}
                  onClick={() => handleLevelToggle(level)}
                  className={`min-h-[44px] rounded-lg p-2 text-sm font-medium transition-all ${
                    filters.levels.includes(level)
                      ? 'bg-accent-purple-bg-strong text-accent-purple-text shadow-sm'
                      : 'bg-surface-raised text-body hover:bg-surface-hover'
                  }`}
                  aria-pressed={filters.levels.includes(level)}
                >
                  {level === 0 ? 'C' : level}
                </button>
              ))}
            </div>
          </div>

          {/* Schools */}
          <div>
            <h4 className="text-body mb-3 text-sm font-medium">School</h4>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {Object.entries(SPELL_SCHOOLS).map(([school, name]) => (
                <Checkbox
                  key={school}
                  checked={filters.schools.includes(school as SpellSchool)}
                  onCheckedChange={() =>
                    handleSchoolToggle(school as SpellSchool)
                  }
                  label={name}
                  size="md"
                />
              ))}
            </div>
          </div>

          {/* Spell Classes */}
          <div>
            <h4 className="text-body mb-3 text-sm font-medium">Classes</h4>
            <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
              {availableClasses.map(className => (
                <button
                  key={className}
                  onClick={() => handleClassToggle(className)}
                  className={`min-h-[44px] rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    filters.classes.includes(className)
                      ? 'border-accent-purple-border bg-accent-purple-bg text-accent-purple-text'
                      : 'border-divider bg-surface-raised text-body hover:bg-surface-hover'
                  }`}
                  aria-pressed={filters.classes.includes(className)}
                >
                  <span className="capitalize">
                    {className === 'eldritch knight'
                      ? 'E. Knight'
                      : className === 'arcane trickster'
                        ? 'A. Trickster'
                        : className}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Ritual & Concentration */}
          <div>
            <h4 className="text-body mb-3 text-sm font-medium">
              Special Properties
            </h4>
            <div className="space-y-2">
              <Checkbox
                checked={filters.ritual === true}
                onCheckedChange={checked =>
                  onFilterChange({ ritual: checked ? true : undefined })
                }
                label="Ritual spells only"
                size="md"
              />
              <Checkbox
                checked={filters.concentration === true}
                onCheckedChange={checked =>
                  onFilterChange({ concentration: checked ? true : undefined })
                }
                label="Concentration spells only"
                size="md"
              />
              <Checkbox
                checked={filters.concentration === false}
                onCheckedChange={checked =>
                  onFilterChange({ concentration: checked ? false : undefined })
                }
                label="Non-concentration only"
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
              {filters.levels.map(level => (
                <Badge
                  key={`level-${level}`}
                  variant="info"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() => handleLevelToggle(level)}
                      aria-label={`Remove level ${level} filter`}
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  {level === 0 ? 'Cantrip' : `Level ${level}`}
                </Badge>
              ))}
              {filters.schools.map(school => (
                <Badge
                  key={`school-${school}`}
                  variant="secondary"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() => handleSchoolToggle(school)}
                      aria-label={`Remove ${school} filter`}
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  {SPELL_SCHOOLS[school]}
                </Badge>
              ))}
              {filters.classes.map(cls => (
                <Badge
                  key={`class-${cls}`}
                  variant="success"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() => handleClassToggle(cls)}
                      aria-label={`Remove ${cls} filter`}
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  <span className="capitalize">{cls}</span>
                </Badge>
              ))}
              {filters.ritual !== undefined && (
                <Badge
                  variant="warning"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() => onFilterChange({ ritual: undefined })}
                      aria-label="Remove ritual filter"
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  Ritual
                </Badge>
              )}
              {filters.concentration !== undefined && (
                <Badge
                  variant="danger"
                  size="sm"
                  rightIcon={
                    <button
                      onClick={() =>
                        onFilterChange({ concentration: undefined })
                      }
                      aria-label="Remove concentration filter"
                    >
                      <X size={12} />
                    </button>
                  }
                >
                  {filters.concentration
                    ? 'Concentration'
                    : 'Non-concentration'}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
