'use client';

import React, { useState } from 'react';
import { CharacterAbilities, AbilityName } from '@/types/character';
import { ABILITY_ABBREVIATIONS, ABILITY_NAMES } from '@/utils/constants';
import { calculateModifier, formatModifier } from '@/utils/calculations';

interface AbilityScoreDisplayProps {
  abilities: CharacterAbilities;
  proficiencyBonus?: number;
  onUpdateAbility?: (ability: AbilityName, value: number) => void;
  onRollAbilityCheck?: (ability: AbilityName) => void;
  readonly?: boolean;
  compact?: boolean;
  showModifiers?: boolean;
  showProficiencyBonus?: boolean;
  highlightAbilities?: AbilityName[];
  selectedAbilities?: AbilityName[];
  onAbilityClick?: (ability: AbilityName) => void;
  className?: string;
}

export function AbilityScoreDisplay({
  abilities,
  proficiencyBonus,
  onUpdateAbility,
  onRollAbilityCheck,
  readonly = false,
  compact = false,
  showModifiers = true,
  showProficiencyBonus = true,
  highlightAbilities = [],
  selectedAbilities = [],
  onAbilityClick,
  className = '',
}: AbilityScoreDisplayProps) {
  const [editingValues, setEditingValues] = useState<
    Record<AbilityName, string>
  >({} as Record<AbilityName, string>);

  const getAbilityModifier = (ability: AbilityName): number => {
    return calculateModifier(abilities[ability]);
  };

  const containerClasses = compact
    ? `bg-white rounded-lg shadow border border-amber-200 p-3 ${className}`
    : `bg-white rounded-lg shadow-lg border border-amber-200 p-6 ${className}`;

  const gridClasses = compact
    ? 'grid grid-cols-3 sm:grid-cols-6 gap-2'
    : 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4';

  const isInteractive =
    !readonly && (onUpdateAbility || onRollAbilityCheck || onAbilityClick);

  return (
    <div className={containerClasses}>
      {!compact && (
        <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-bold text-gray-800">
          Ability Scores
        </h2>
      )}

      <div className={gridClasses}>
        {(Object.keys(ABILITY_ABBREVIATIONS) as AbilityName[]).map(ability => {
          const isHighlighted = highlightAbilities.includes(ability);
          const isSelected = selectedAbilities.includes(ability);
          const modifier = getAbilityModifier(ability);

          const abilityClasses = [
            'bg-blue-50 border-2 border-blue-200 rounded-lg transition-colors text-center',
            compact ? 'p-2' : 'p-4',
            isHighlighted && 'border-yellow-400 bg-yellow-50',
            isSelected && 'border-purple-400 bg-purple-50',
            isInteractive && 'hover:border-blue-400 cursor-pointer',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={ability}
              className={abilityClasses}
              onClick={() => onAbilityClick?.(ability)}
            >
              <div
                className={`mb-2 font-bold text-blue-900 ${compact ? 'text-xs' : 'text-sm'}`}
              >
                {ABILITY_ABBREVIATIONS[ability]}
              </div>

              {readonly ? (
                <div
                  className={`text-center font-bold text-blue-900 ${compact ? 'text-lg' : 'text-2xl'}`}
                >
                  {abilities[ability]}
                </div>
              ) : (
                <input
                  type="number"
                  value={editingValues[ability] ?? abilities[ability]}
                  onChange={e => {
                    // Allow any input including empty string
                    setEditingValues(prev => ({
                      ...prev,
                      [ability]: e.target.value,
                    }));
                  }}
                  onFocus={e => {
                    // Select all on focus for easy replacement
                    e.target.select();
                  }}
                  onBlur={e => {
                    // On blur, validate and update
                    const value = e.target.value;
                    let numValue: number;

                    if (value === '' || isNaN(parseInt(value))) {
                      numValue = 10; // Default
                    } else {
                      numValue = parseInt(value);
                      // Clamp between 1 and 30
                      numValue = Math.max(1, Math.min(30, numValue));
                    }

                    onUpdateAbility?.(ability, numValue);

                    // Clear editing state
                    setEditingValues(prev => {
                      const newState = { ...prev };
                      delete newState[ability];
                      return newState;
                    });
                  }}
                  onKeyDown={e => {
                    // Submit on Enter
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  min="1"
                  max="30"
                  className={`w-full border-none bg-transparent text-center font-bold text-blue-900 outline-none ${compact ? 'text-lg' : 'text-2xl'}`}
                />
              )}

              {showModifiers && (
                <>
                  {onRollAbilityCheck ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onRollAbilityCheck(ability);
                      }}
                      className={`mt-1 cursor-pointer rounded px-2 py-1 font-semibold text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-900 ${compact ? 'text-sm' : 'text-lg'}`}
                      title={`Roll ${ABILITY_NAMES[ability]} check (d20 + ${formatModifier(modifier)})`}
                    >
                      {formatModifier(modifier)}
                    </button>
                  ) : (
                    <div
                      className={`mt-1 font-semibold text-blue-700 ${compact ? 'text-sm' : 'text-lg'}`}
                    >
                      {formatModifier(modifier)}
                    </div>
                  )}
                  <div
                    className={`text-blue-600 ${compact ? 'text-xs' : 'text-xs'}`}
                  >
                    modifier
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {showProficiencyBonus && proficiencyBonus !== undefined && !compact && (
        <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 p-3">
          <div className="text-sm font-medium text-indigo-900">
            Proficiency Bonus:{' '}
            <span className="font-bold">
              {formatModifier(proficiencyBonus)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
