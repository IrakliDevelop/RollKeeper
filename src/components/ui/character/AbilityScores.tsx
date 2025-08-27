'use client';

import { ABILITY_ABBREVIATIONS, ABILITY_NAMES } from "@/utils/constants";
import { calculateModifier, getProficiencyBonus, formatModifier } from "@/utils/calculations";
import { AbilityName, CharacterState } from "@/types/character";

interface AbilityScoresProps {
  abilities: CharacterState['abilities'];
  characterLevel: number;
  onUpdateAbilityScore: (ability: AbilityName, value: number) => void;
  onRollAbilityCheck: (ability: AbilityName) => void;
}

export default function AbilityScores({
  abilities,
  characterLevel,
  onUpdateAbilityScore,
  onRollAbilityCheck
}: AbilityScoresProps) {
  const proficiencyBonus = getProficiencyBonus(characterLevel);

  const getAbilityModifier = (ability: AbilityName) => {
    return calculateModifier(abilities[ability]);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
        Ability Scores
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
        {(Object.keys(ABILITY_ABBREVIATIONS) as AbilityName[]).map((ability) => (
          <div key={ability} className="text-center">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <div className="font-bold text-sm text-blue-900 mb-2">
                {ABILITY_ABBREVIATIONS[ability]}
              </div>
              <input 
                type="number" 
                value={abilities[ability]}
                onChange={(e) => onUpdateAbilityScore(ability, parseInt(e.target.value) || 10)}
                min="1" 
                max="30"
                className="w-full text-2xl font-bold text-center bg-transparent border-none outline-none text-blue-900"
              />
              <button
                onClick={() => onRollAbilityCheck(ability)}
                className="text-lg font-semibold text-blue-700 mt-1 hover:text-blue-900 hover:bg-blue-100 px-2 py-1 rounded transition-colors cursor-pointer"
                title={`Roll ${ABILITY_NAMES[ability]} check (d20 + ${formatModifier(getAbilityModifier(ability))})`}
              >
                {formatModifier(getAbilityModifier(ability))}
              </button>
              <div className="text-xs text-blue-600">modifier</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-md">
        <div className="text-sm font-medium text-indigo-900">
          Proficiency Bonus: <span className="font-bold">{formatModifier(proficiencyBonus)}</span>
        </div>
      </div>
    </div>
  );
}
