'use client';

import React from 'react';
import {
  BestiaryFilters,
  CREATURE_TYPES,
  ALIGNMENTS,
  SIZES,
} from '@/types/bestiary';
import { CustomCheckbox } from '@/components/ui';
import {
  Filter,
  Skull,
  Shield,
  Zap,
  Crown,
  Sparkles,
  FileText,
} from 'lucide-react';

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
    onFilterChange({
      crRange: {
        ...filters.crRange,
        [type]: numValue,
      },
    });
  };

  // CR options for easy selection
  const crOptions = [
    { label: '0-1', min: 0, max: 1 },
    { label: '2-5', min: 2, max: 5 },
    { label: '6-10', min: 6, max: 10 },
    { label: '11-15', min: 11, max: 15 },
    { label: '16-20', min: 16, max: 20 },
    { label: '21+', min: 21, max: undefined },
  ];

  const handleCRQuickSelect = (min: number, max?: number) => {
    onFilterChange({
      crRange: { min, max },
    });
  };

  return (
    <div className="flex h-fit max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border border-slate-600/50 bg-slate-800/50 shadow-lg backdrop-blur-sm">
      {/* Header with decorative border */}
      <div className="relative flex-shrink-0 border-b border-slate-600/50 bg-gradient-to-r from-slate-800/60 to-slate-700/60 p-4">
        <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-600/20">
              <Filter className="h-4 w-4 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              Monster Filters
            </h3>
          </div>
          <button
            onClick={onClearFilters}
            className="text-sm text-emerald-400 underline transition-colors hover:text-emerald-300"
          >
            Clear All
          </button>
        </div>

        <div className="absolute right-1/4 bottom-0 left-1/4 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      </div>

      <div
        className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#475569 #1e293b',
        }}
      >
        {/* Results Summary */}
        <div className="relative rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-600/10 to-emerald-800/10 p-4 text-center">
          <div className="absolute top-0 right-1/3 left-1/3 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

          <div className="mb-1 text-3xl font-bold text-emerald-400">
            {monsterCount}
          </div>
          <div className="text-sm text-slate-300">
            of {totalMonsters} monsters
          </div>

          <div className="absolute right-1/3 bottom-0 left-1/3 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
        </div>

        {/* Challenge Rating */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
            <Skull className="h-4 w-4 text-red-400" />
            Challenge Rating
          </h4>

          {/* Quick CR Selection */}
          <div className="mb-3 grid grid-cols-3 gap-2">
            {crOptions.map(option => {
              const isSelected =
                filters.crRange.min === option.min &&
                filters.crRange.max === option.max;
              return (
                <button
                  key={option.label}
                  onClick={() => handleCRQuickSelect(option.min, option.max)}
                  className={`rounded p-2 text-xs font-medium transition-all ${
                    isSelected
                      ? 'border border-red-500/50 bg-red-500/30 text-red-300'
                      : 'border border-slate-600/30 bg-slate-700/30 text-slate-300 hover:bg-slate-600/30'
                  }`}
                >
                  CR {option.label}
                </button>
              );
            })}
          </div>

          {/* Custom CR Range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Min CR
              </label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.125"
                value={filters.crRange.min ?? ''}
                onChange={e => handleCRRangeChange('min', e.target.value)}
                placeholder="0"
                className="w-full rounded border border-slate-600/50 bg-slate-700/50 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Max CR
              </label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.125"
                value={filters.crRange.max ?? ''}
                onChange={e => handleCRRangeChange('max', e.target.value)}
                placeholder="30"
                className="w-full rounded border border-slate-600/50 bg-slate-700/50 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Size */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-slate-200">Size</h4>
          <div className="grid grid-cols-3 gap-2">
            {SIZES.map(size => (
              <button
                key={size}
                onClick={() => handleSizeToggle(size)}
                className={`rounded p-2 text-xs font-medium transition-all ${
                  filters.sizes.includes(size)
                    ? 'border border-blue-500/50 bg-blue-500/30 text-blue-300'
                    : 'border border-slate-600/30 bg-slate-700/30 text-slate-300 hover:bg-slate-600/30'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Creature Type */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-slate-200">
            Creature Type
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {CREATURE_TYPES.map(type => (
              <button
                key={type}
                onClick={() => handleTypeToggle(type)}
                className={`rounded p-2 text-xs font-medium transition-all ${
                  filters.types.includes(type)
                    ? 'border border-purple-500/50 bg-purple-500/30 text-purple-300'
                    : 'border border-slate-600/30 bg-slate-700/30 text-slate-300 hover:bg-slate-600/30'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Alignment */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-slate-200">Alignment</h4>
          <div className="grid grid-cols-2 gap-2">
            {ALIGNMENTS.map(alignment => (
              <button
                key={alignment}
                onClick={() => handleAlignmentToggle(alignment)}
                className={`rounded p-2 text-xs font-medium transition-all ${
                  filters.alignments.includes(alignment)
                    ? 'border border-yellow-500/50 bg-yellow-500/30 text-yellow-300'
                    : 'border border-slate-600/30 bg-slate-700/30 text-slate-300 hover:bg-slate-600/30'
                }`}
              >
                {alignment === 'True Neutral' ? 'Neutral' : alignment}
              </button>
            ))}
          </div>
        </div>

        {/* Special Properties */}
        <div>
          <h4 className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-200">
            <Crown className="h-4 w-4 text-amber-400" />
            Special Properties
          </h4>
          <div className="space-y-3">
            <CustomCheckbox
              checked={filters.hasLegendaryActions === true}
              onChange={checked =>
                onFilterChange({
                  hasLegendaryActions: checked ? true : undefined,
                })
              }
              label="Has Legendary Actions"
              description="Monsters with legendary actions"
              icon={<Crown className="h-4 w-4" />}
              variant="amber"
            />

            <CustomCheckbox
              checked={filters.hasSpellcasting === true}
              onChange={checked =>
                onFilterChange({
                  hasSpellcasting: checked ? true : undefined,
                })
              }
              label="Has Spellcasting"
              description="Monsters that can cast spells"
              icon={<Sparkles className="h-4 w-4" />}
              variant="purple"
            />

            <CustomCheckbox
              checked={filters.hasConditionImmunities === true}
              onChange={checked =>
                onFilterChange({
                  hasConditionImmunities: checked ? true : undefined,
                })
              }
              label="Has Condition Immunities"
              description="Immune to status conditions"
              icon={<Shield className="h-4 w-4" />}
              variant="blue"
            />

            <CustomCheckbox
              checked={filters.hasDamageResistances === true}
              onChange={checked =>
                onFilterChange({
                  hasDamageResistances: checked ? true : undefined,
                })
              }
              label="Has Damage Resistances"
              description="Resistant to damage types"
              icon={<Zap className="h-4 w-4" />}
              variant="red"
            />
          </div>
        </div>

        {/* Sources */}
        {availableSources.length > 1 && (
          <div>
            <h4 className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-200">
              <FileText className="h-4 w-4 text-blue-400" />
              Sources
            </h4>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {availableSources.map(source => (
                <CustomCheckbox
                  key={source}
                  checked={filters.sources.includes(source)}
                  onChange={checked => {
                    const newSources = checked
                      ? [...filters.sources, source]
                      : filters.sources.filter(s => s !== source);
                    onFilterChange({ sources: newSources });
                  }}
                  label={source}
                  size="sm"
                  variant="emerald"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
