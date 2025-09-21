'use client';

import React, { useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { SpellcastingAbility } from '@/types/character';
import { CustomSwitcher, FancySelect } from '@/components/ui';
import { Edit3, Calculator, Zap, Shield } from 'lucide-react';
import {
  getClassSpellcastingAbility,
  getCharacterSpellcastingAbility,
  getSpellAttackString,
  getSpellSaveDCString,
  isSpellcaster,
} from '@/utils/calculations';

export const SpellcastingStats: React.FC = () => {
  const { character, updateCharacter } = useCharacterStore();
  const [showOverrides, setShowOverrides] = useState(false);

  // Check if character is a spellcaster
  const characterIsSpellcaster = isSpellcaster(character);

  if (!characterIsSpellcaster) {
    return (
      <div className="rounded-lg border border-purple-200 bg-white p-4 shadow">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-purple-800">
          <span className="text-purple-600">✨</span>
          Spellcasting
        </h3>
        <div className="py-6 text-center text-gray-500">
          <div className="mb-2 text-4xl">🚫</div>
          <p className="font-medium">Not a spellcaster</p>
          <p className="mt-1 text-sm">
            Select a spellcasting class to enable this section.
          </p>
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
          ? character.spellcastingStats.spellcastingAbility ||
            classDefaultAbility
          : null,
      },
    });
  };

  const handleAbilityChange = (ability: SpellcastingAbility) => {
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        spellcastingAbility: ability,
      },
    });
  };

  const handleAttackBonusOverride = (value: string) => {
    const bonus = value === '' ? undefined : parseInt(value);
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        spellAttackBonus: bonus,
      },
    });
  };

  const handleSaveDCOverride = (value: string) => {
    const dc = value === '' ? undefined : parseInt(value);
    updateCharacter({
      spellcastingStats: {
        ...character.spellcastingStats,
        spellSaveDC: dc,
      },
    });
  };

  return (
    <div className="rounded-lg border border-purple-200 bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-purple-800">
          <span className="text-purple-600">✨</span>
          Spellcasting Statistics
        </h3>
        <button
          onClick={() => setShowOverrides(!showOverrides)}
          className="text-purple-600 transition-colors hover:text-purple-800"
          title="Toggle manual overrides"
        >
          {showOverrides ? <Calculator size={20} /> : <Edit3 size={20} />}
        </button>
      </div>

      <div className="space-y-4">
        {/* Spellcasting Ability */}
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-semibold text-purple-800">
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
                onChange={value =>
                  handleAbilityOverrideToggle(value as boolean)
                }
                color="purple"
                size="sm"
              />
            )}
          </div>

          <div className="flex items-center gap-4">
            {character.spellcastingStats.isAbilityOverridden ? (
              <FancySelect
                options={[
                  {
                    value: 'intelligence',
                    label: 'Intelligence',
                    description: 'Logic, reasoning, memory',
                  },
                  {
                    value: 'wisdom',
                    label: 'Wisdom',
                    description: 'Awareness, insight, intuition',
                  },
                  {
                    value: 'charisma',
                    label: 'Charisma',
                    description: 'Force of personality, leadership',
                  },
                ]}
                value={
                  character.spellcastingStats.spellcastingAbility ||
                  'intelligence'
                }
                onChange={value =>
                  handleAbilityChange(value as SpellcastingAbility)
                }
                color="purple"
                className="w-48"
              />
            ) : (
              <div className="rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-800 capitalize">
                {classDefaultAbility || 'Unknown'}
              </div>
            )}
            {!character.spellcastingStats.isAbilityOverridden &&
              classDefaultAbility && (
                <span className="text-sm text-purple-600">
                  (from {character.class.name})
                </span>
              )}
          </div>
        </div>

        {/* Attack Bonus and Save DC */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Spell Attack Bonus */}
          <div className="text-center">
            <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4 transition-colors hover:border-red-400">
              <div className="mb-1 flex items-center justify-center gap-1 text-xs font-medium text-red-700">
                <Zap size={12} />
                SPELL ATTACK
              </div>
              {showOverrides && (
                <input
                  type="number"
                  value={
                    character.spellcastingStats.spellAttackBonus?.toString() ||
                    ''
                  }
                  onChange={e => handleAttackBonusOverride(e.target.value)}
                  placeholder="Auto"
                  className="mb-1 w-full border-none bg-transparent text-center text-xl font-bold text-red-900 outline-none"
                />
              )}
              {!showOverrides && (
                <div className="mb-1 text-xl font-bold text-red-900">
                  {getSpellAttackString(character)}
                </div>
              )}
              <div className="text-xs text-red-600">
                {character.spellcastingStats.spellAttackBonus !== undefined
                  ? 'manual'
                  : 'auto'}
              </div>
            </div>
          </div>

          {/* Spell Save DC */}
          <div className="text-center">
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 transition-colors hover:border-blue-400">
              <div className="mb-1 flex items-center justify-center gap-1 text-xs font-medium text-blue-700">
                <Shield size={12} />
                SPELL SAVE DC
              </div>
              {showOverrides && (
                <input
                  type="number"
                  value={
                    character.spellcastingStats.spellSaveDC?.toString() || ''
                  }
                  onChange={e => handleSaveDCOverride(e.target.value)}
                  placeholder="Auto"
                  className="mb-1 w-full border-none bg-transparent text-center text-xl font-bold text-blue-900 outline-none"
                />
              )}
              {!showOverrides && (
                <div className="mb-1 text-xl font-bold text-blue-900">
                  {getSpellSaveDCString(character)}
                </div>
              )}
              <div className="text-xs text-blue-600">
                {character.spellcastingStats.spellSaveDC !== undefined
                  ? 'manual'
                  : 'auto'}
              </div>
            </div>
          </div>
        </div>

        {/* Calculation Info */}
        {!showOverrides && currentSpellcastingAbility && (
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <div className="mb-1 font-medium">Calculations:</div>
            <div>
              Spell Attack: {currentSpellcastingAbility} modifier + proficiency
            </div>
            <div>
              Spell Save DC: 8 + {currentSpellcastingAbility} modifier +
              proficiency
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
