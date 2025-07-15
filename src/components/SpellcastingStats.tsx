'use client';

import React, { useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { SpellcastingAbility } from '@/types/character';
import { CustomSwitcher } from './ui/CustomSwitcher';
import { Edit3, Calculator, Zap, Shield } from 'lucide-react';
import { 
  getClassSpellcastingAbility, 
  getCharacterSpellcastingAbility,
  getSpellAttackString,
  getSpellSaveDCString,
  isSpellcaster
} from '@/utils/calculations';

export const SpellcastingStats: React.FC = () => {
  const { character, updateCharacter } = useCharacterStore();
  const [showOverrides, setShowOverrides] = useState(false);

  // Check if character is a spellcaster
  const characterIsSpellcaster = isSpellcaster(character);
  
  if (!characterIsSpellcaster) {
    return (
      <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
        <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
          <span className="text-purple-600">✨</span>
          Spellcasting
        </h3>
        <div className="text-center py-6 text-gray-500">
          <div className="text-4xl mb-2">🚫</div>
          <p className="font-medium">Not a spellcaster</p>
          <p className="text-sm mt-1">Select a spellcasting class to enable this section.</p>
        </div>
      </div>
    );
  }

  const currentSpellcastingAbility = getCharacterSpellcastingAbility(character);
  const classDefaultAbility = getClassSpellcastingAbility(character.class.name);

  const handleAbilityOverrideToggle = (useOverride: boolean) => {
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        isAbilityOverridden: useOverride,
        spellcastingAbility: useOverride 
          ? character.spellcastingStats.spellcastingAbility || classDefaultAbility
          : null
      }
    });
  };

  const handleAbilityChange = (ability: SpellcastingAbility) => {
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        spellcastingAbility: ability
      }
    });
  };

  const handleAttackBonusOverride = (value: string) => {
    const bonus = value === '' ? undefined : parseInt(value);
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        spellAttackBonus: bonus
      }
    });
  };

  const handleSaveDCOverride = (value: string) => {
    const dc = value === '' ? undefined : parseInt(value);
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        spellSaveDC: dc
      }
    });
  };

  return (
    <div className="bg-white rounded-lg shadow border border-purple-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
          <span className="text-purple-600">✨</span>
          Spellcasting Statistics
        </h3>
        <button
          onClick={() => setShowOverrides(!showOverrides)}
          className="text-purple-600 hover:text-purple-800 transition-colors"
          title="Toggle manual overrides"
        >
          {showOverrides ? <Calculator size={20} /> : <Edit3 size={20} />}
        </button>
      </div>

      <div className="space-y-4">
        {/* Spellcasting Ability */}
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-purple-800 flex items-center gap-2">
              <span className="text-purple-600">🧠</span>
              Spellcasting Ability
            </h4>
            {showOverrides && (
              <CustomSwitcher
                leftLabel="Auto"
                rightLabel="Manual"
                leftValue={false}
                rightValue={true}
                currentValue={character.spellcastingStats.isAbilityOverridden}
                                 onChange={(value) => handleAbilityOverrideToggle(value as boolean)}
                color="purple"
                size="sm"
              />
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {character.spellcastingStats.isAbilityOverridden ? (
              <select
                value={character.spellcastingStats.spellcastingAbility || 'intelligence'}
                onChange={(e) => handleAbilityChange(e.target.value as SpellcastingAbility)}
                className="px-3 py-2 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
              >
                <option value="intelligence">Intelligence</option>
                <option value="wisdom">Wisdom</option>
                <option value="charisma">Charisma</option>
              </select>
            ) : (
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-800 capitalize">
                {classDefaultAbility || 'Unknown'}
              </div>
            )}
            {!character.spellcastingStats.isAbilityOverridden && classDefaultAbility && (
              <span className="text-sm text-purple-600">
                (from {character.class.name})
              </span>
            )}
          </div>
        </div>

        {/* Attack Bonus and Save DC */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Spell Attack Bonus */}
          <div className="text-center">
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 hover:border-red-400 transition-colors">
              <div className="text-xs font-medium text-red-700 mb-1 flex items-center justify-center gap-1">
                <Zap size={12} />
                SPELL ATTACK
              </div>
              {showOverrides && (
                <input
                  type="number"
                  value={character.spellcastingStats.spellAttackBonus?.toString() || ''}
                  onChange={(e) => handleAttackBonusOverride(e.target.value)}
                  placeholder="Auto"
                  className="w-full text-xl font-bold text-red-900 bg-transparent border-none outline-none text-center mb-1"
                />
              )}
              {!showOverrides && (
                <div className="text-xl font-bold text-red-900 mb-1">
                  {getSpellAttackString(character)}
                </div>
              )}
              <div className="text-xs text-red-600">
                {character.spellcastingStats.spellAttackBonus !== undefined ? 'manual' : 'auto'}
              </div>
            </div>
          </div>

          {/* Spell Save DC */}
          <div className="text-center">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <div className="text-xs font-medium text-blue-700 mb-1 flex items-center justify-center gap-1">
                <Shield size={12} />
                SPELL SAVE DC
              </div>
              {showOverrides && (
                <input
                  type="number"
                  value={character.spellcastingStats.spellSaveDC?.toString() || ''}
                  onChange={(e) => handleSaveDCOverride(e.target.value)}
                  placeholder="Auto"
                  className="w-full text-xl font-bold text-blue-900 bg-transparent border-none outline-none text-center mb-1"
                />
              )}
              {!showOverrides && (
                <div className="text-xl font-bold text-blue-900 mb-1">
                  {getSpellSaveDCString(character)}
                </div>
              )}
              <div className="text-xs text-blue-600">
                {character.spellcastingStats.spellSaveDC !== undefined ? 'manual' : 'auto'}
              </div>
            </div>
          </div>
        </div>

        {/* Calculation Info */}
        {!showOverrides && currentSpellcastingAbility && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
            <div className="font-medium mb-1">Calculations:</div>
            <div>Spell Attack: {currentSpellcastingAbility} modifier + proficiency</div>
            <div>Spell Save DC: 8 + {currentSpellcastingAbility} modifier + proficiency</div>
          </div>
        )}
      </div>
    </div>
  );
}; 