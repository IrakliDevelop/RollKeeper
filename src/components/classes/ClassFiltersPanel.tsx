'use client';

import React from 'react';
import { ClassFilters, SpellcastingType, SpellcastingAbility, ProficiencyType } from '@/types/classes';
import { formatSpellcastingType, formatSpellcastingAbility, formatProficiencyType } from '@/utils/classFilters';
import { X, Filter } from 'lucide-react';

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
const PRIMARY_ABILITIES: ProficiencyType[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export default function ClassFiltersPanel({ 
  filters, 
  onFiltersChange, 
  filterOptions, 
  onClearFilters 
}: ClassFiltersPanelProps) {
  
  const updateFilter = <K extends keyof ClassFilters>(
    key: K,
    value: ClassFilters[K]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
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
    <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-600/50 rounded-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Filter Classes</h3>
        </div>
        
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-600/50"
          >
            <X size={16} />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Sources */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Sources ({filters.sources?.length || 0} selected)
          </label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {filterOptions.sources.map((source) => (
              <label key={source} className="flex items-center space-x-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.sources?.includes(source) || false}
                  onChange={() => toggleArrayFilter('sources', source, filters.sources)}
                  className="rounded border-slate-600 bg-slate-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-800"
                />
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                  {source}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Spellcasting Types */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Spellcasting ({filters.spellcastingTypes?.length || 0} selected)
          </label>
          <div className="space-y-2">
            {filterOptions.spellcastingTypes.map((type) => (
              <label key={type} className="flex items-center space-x-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.spellcastingTypes?.includes(type) || false}
                  onChange={() => toggleArrayFilter('spellcastingTypes', type, filters.spellcastingTypes)}
                  className="rounded border-slate-600 bg-slate-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-800"
                />
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                  {formatSpellcastingType(type)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Spellcasting Abilities */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Spellcasting Ability ({filters.spellcastingAbilities?.length || 0} selected)
          </label>
          <div className="space-y-2">
            {SPELLCASTING_ABILITIES.map((ability) => (
              <label key={ability} className="flex items-center space-x-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.spellcastingAbilities?.includes(ability) || false}
                  onChange={() => toggleArrayFilter('spellcastingAbilities', ability, filters.spellcastingAbilities)}
                  className="rounded border-slate-600 bg-slate-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-800"
                />
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                  {formatSpellcastingAbility(ability)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Hit Dice Types */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Hit Dice ({filters.hitDiceTypes?.length || 0} selected)
          </label>
          <div className="space-y-2">
            {filterOptions.hitDiceTypes.map((hitDie) => (
              <label key={hitDie} className="flex items-center space-x-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.hitDiceTypes?.includes(hitDie) || false}
                  onChange={() => toggleArrayFilter('hitDiceTypes', hitDie, filters.hitDiceTypes)}
                  className="rounded border-slate-600 bg-slate-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-800"
                />
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                  {hitDie}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Primary Abilities */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Saving Throws ({filters.primaryAbilities?.length || 0} selected)
          </label>
          <div className="space-y-2">
            {PRIMARY_ABILITIES.map((ability) => (
              <label key={ability} className="flex items-center space-x-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.primaryAbilities?.includes(ability) || false}
                  onChange={() => toggleArrayFilter('primaryAbilities', ability, filters.primaryAbilities)}
                  className="rounded border-slate-600 bg-slate-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-800"
                />
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                  {formatProficiencyType(ability)}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="pt-4 border-t border-slate-600/50">
          <div className="text-sm text-slate-400 mb-2">Active filters:</div>
          <div className="flex flex-wrap gap-2">
            {/* Sources */}
            {filters.sources?.map((source) => (
              <span
                key={`source-${source}`}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30"
              >
                {source}
                <button
                  onClick={() => toggleArrayFilter('sources', source, filters.sources)}
                  className="hover:text-blue-300"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {/* Spellcasting Types */}
            {filters.spellcastingTypes?.map((type) => (
              <span
                key={`casting-${type}`}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded border border-purple-500/30"
              >
                {formatSpellcastingType(type)}
                <button
                  onClick={() => toggleArrayFilter('spellcastingTypes', type, filters.spellcastingTypes)}
                  className="hover:text-purple-300"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {/* Spellcasting Abilities */}
            {filters.spellcastingAbilities?.map((ability) => (
              <span
                key={`ability-${ability}`}
                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded border border-emerald-500/30"
              >
                {formatSpellcastingAbility(ability)}
                <button
                  onClick={() => toggleArrayFilter('spellcastingAbilities', ability, filters.spellcastingAbilities)}
                  className="hover:text-emerald-300"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {/* Hit Dice */}
            {filters.hitDiceTypes?.map((hitDie) => (
              <span
                key={`hitdie-${hitDie}`}
                className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded border border-orange-500/30"
              >
                {hitDie}
                <button
                  onClick={() => toggleArrayFilter('hitDiceTypes', hitDie, filters.hitDiceTypes)}
                  className="hover:text-orange-300"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {/* Primary Abilities */}
            {filters.primaryAbilities?.map((ability) => (
              <span
                key={`primary-${ability}`}
                className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded border border-cyan-500/30"
              >
                {formatProficiencyType(ability)}
                <button
                  onClick={() => toggleArrayFilter('primaryAbilities', ability, filters.primaryAbilities)}
                  className="hover:text-cyan-300"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 