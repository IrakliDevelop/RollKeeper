'use client';

import React from 'react';
import { SpellFilters, SPELL_SCHOOLS, SpellSchool, SpellClass } from '@/types/spells';
import { useCharacterStore } from '@/store/characterStore';
import { Filter } from 'lucide-react';

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
  totalSpells
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
    
    // Map common class names to spell class names
    const classMap: Record<string, SpellClass> = {
      'fighter': 'eldritch knight',
      'rogue': 'arcane trickster',
    };
    
    const spellClassName = classMap[characterClassName] as SpellClass || characterClassName as SpellClass;
    
    if (filters.classes.includes(spellClassName)) {
      // Remove character class filter
      onFilterChange({ 
        classes: filters.classes.filter(c => c !== spellClassName) 
      });
    } else {
      // Add character class filter
      onFilterChange({ 
        classes: [...filters.classes, spellClassName] 
      });
    }
  };

  const availableClasses: SpellClass[] = [
    'artificer', 'bard', 'cleric', 'druid', 'paladin', 
    'ranger', 'sorcerer', 'warlock', 'wizard', 
    'eldritch knight', 'arcane trickster'
  ];

  // Check if character class filter is active
  const characterClassName = character.class?.name?.toLowerCase() || '';
  const classMap: Record<string, SpellClass> = {
    'fighter': 'eldritch knight',
    'rogue': 'arcane trickster',
  };
  const spellClassName = classMap[characterClassName] as SpellClass || characterClassName as SpellClass;
  const isCharacterClassFiltered = filters.classes.includes(spellClassName);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-lg shadow-lg overflow-hidden">
      {/* Header with decorative border */}
      <div className="relative bg-gradient-to-r from-slate-800/60 to-slate-700/60 p-4 border-b border-slate-600/50">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-amber-600/20 border border-amber-500/30 rounded-lg">
              <Filter className="h-4 w-4 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Spell Filters</h3>
          </div>
          <button
            onClick={onClearFilters}
            className="text-amber-400 hover:text-amber-300 text-sm underline transition-colors"
          >
            Clear All
          </button>
        </div>
        
        <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
      </div>

      <div className="p-6 space-y-6">
        {/* Results Summary */}
        <div className="relative text-center p-4 bg-gradient-to-br from-amber-600/10 to-amber-800/10 rounded-lg border border-amber-500/20">
          <div className="absolute top-0 left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
          
          <div className="text-3xl font-bold text-amber-400 mb-1">{spellCount}</div>
          <div className="text-sm text-slate-300">of {totalSpells} spells</div>
          
          <div className="absolute bottom-0 left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
        </div>

      {/* Character Class Quick Filter */}
      {character.class?.spellcaster !== 'none' && character.class?.name && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Character Class</h4>
          <button
            onClick={handleCharacterClassFilter}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
              isCharacterClassFiltered
                ? 'bg-amber-600/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-700/30 border-slate-600/50 text-slate-300 hover:bg-slate-600/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                isCharacterClassFiltered ? 'bg-amber-400' : 'bg-slate-500'
              }`} />
              <span className="font-medium capitalize">
                {character.class.name} Spells
              </span>
            </div>
            <span className="text-xs px-2 py-1 bg-slate-600 rounded">
              {isCharacterClassFiltered ? 'Active' : 'Show Only'}
            </span>
          </button>
          <p className="text-xs text-slate-400 mt-2">
            Show only spells available to your {character.class.name}
          </p>
        </div>
      )}

      {/* Spell Levels */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-slate-200 mb-3">Spell Level</h4>
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => (
            <button
              key={level}
              onClick={() => handleLevelToggle(level)}
              className={`p-2 rounded text-sm font-medium transition-all ${
                filters.levels.includes(level)
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {level === 0 ? 'C' : level}
            </button>
          ))}
        </div>
      </div>

      {/* Schools */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-slate-200 mb-3">School</h4>
        <div className="space-y-2">
          {Object.entries(SPELL_SCHOOLS).map(([school, name]) => (
            <label key={school} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.schools.includes(school as SpellSchool)}
                onChange={() => handleSchoolToggle(school as SpellSchool)}
                className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-slate-300">{name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Spell Classes */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-3">Classes</h4>
        <div className="grid grid-cols-2 gap-2">
          {availableClasses.map(className => (
            <button
              key={className}
              onClick={() => handleClassToggle(className)}
              className={`p-2 rounded text-xs transition-all ${
                filters.classes.includes(className)
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                  : 'bg-slate-700/30 text-slate-300 hover:bg-slate-600/30 border border-slate-600/30'
              }`}
            >
              <span className="capitalize">
                {className === 'eldritch knight' ? 'E. Knight' : 
                 className === 'arcane trickster' ? 'A. Trickster' : 
                 className}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Ritual & Concentration */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-3">Special Properties</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.ritual === true}
              onChange={(e) => onFilterChange({ 
                ritual: e.target.checked ? true : undefined 
              })}
              className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-300">Ritual spells only</span>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.concentration === true}
              onChange={(e) => onFilterChange({ 
                concentration: e.target.checked ? true : undefined 
              })}
              className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-300">Concentration spells only</span>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.concentration === false}
              onChange={(e) => onFilterChange({ 
                concentration: e.target.checked ? false : undefined 
              })}
              className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-300">Non-concentration only</span>
          </label>
        </div>
      </div>

      {/* Sources */}
      {availableSources.length > 1 && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Sources</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {availableSources.map(source => (
              <label key={source} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.sources.includes(source)}
                  onChange={(e) => {
                    const newSources = e.target.checked
                      ? [...filters.sources, source]
                      : filters.sources.filter(s => s !== source);
                    onFilterChange({ sources: newSources });
                  }}
                  className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-slate-300">{source}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
} 