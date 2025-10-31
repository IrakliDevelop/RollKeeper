'use client';

import { ABILITY_ABBREVIATIONS, ABILITY_NAMES } from '@/utils/constants';
import {
  calculateModifier,
  getProficiencyBonus,
  formatModifier,
} from '@/utils/calculations';
import { Button, Input } from '@/components/ui/forms';
import { AbilityName, CharacterState } from '@/types/character';

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
  onRollAbilityCheck,
}: AbilityScoresProps) {
  const proficiencyBonus = getProficiencyBonus(characterLevel);

  const getAbilityModifier = (ability: AbilityName) => {
    return calculateModifier(abilities[ability]);
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-white p-6 shadow-lg">
      <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-bold text-gray-800">
        Ability Scores
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-2">
        {(Object.keys(ABILITY_ABBREVIATIONS) as AbilityName[]).map(ability => (
          <div key={ability} className="text-center">
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 transition-colors hover:border-blue-400">
              <div className="mb-2 text-sm font-bold text-blue-900">
                {ABILITY_ABBREVIATIONS[ability]}
              </div>
              <Input
                type="number"
                value={abilities[ability].toString()}
                onChange={e =>
                  onUpdateAbilityScore(ability, parseInt(e.target.value) || 10)
                }
                min="1"
                max="30"
                size="lg"
                className="border-none bg-transparent text-center text-2xl font-bold text-blue-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <Button
                onClick={() => onRollAbilityCheck(ability)}
                variant="ghost"
                size="sm"
                className="mt-1 text-lg font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                title={`Roll ${ABILITY_NAMES[ability]} check (d20 + ${formatModifier(getAbilityModifier(ability))})`}
              >
                {formatModifier(getAbilityModifier(ability))}
              </Button>
              <div className="text-xs text-blue-600">modifier</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 p-3">
        <div className="text-sm font-medium text-indigo-900">
          Proficiency Bonus:{' '}
          <span className="font-bold">{formatModifier(proficiencyBonus)}</span>
        </div>
      </div>
    </div>
  );
}
