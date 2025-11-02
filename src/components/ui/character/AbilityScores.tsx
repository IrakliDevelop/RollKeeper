'use client';

import { ABILITY_ABBREVIATIONS, ABILITY_NAMES } from '@/utils/constants';
import {
  calculateModifier,
  getProficiencyBonus,
  formatModifier,
} from '@/utils/calculations';
import { Button, Input } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';
import { AbilityName, CharacterState } from '@/types/character';
import { Dices } from 'lucide-react';

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

  const getModifierVariant = (modifier: number) => {
    if (modifier >= 4) return 'success';
    if (modifier >= 2) return 'info';
    if (modifier >= 0) return 'neutral';
    if (modifier >= -2) return 'warning';
    return 'danger';
  };

  return (
    <div className="rounded-lg border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-emerald-800">
        <Dices className="h-5 w-5" />
        Ability Scores
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-2">
        {(Object.keys(ABILITY_ABBREVIATIONS) as AbilityName[]).map(ability => {
          const modifier = getAbilityModifier(ability);
          return (
            <div key={ability} className="text-center">
              <div className="rounded-lg border-2 border-emerald-300 bg-white p-4 transition-all hover:border-emerald-400 hover:shadow-md">
                <div className="mb-2 text-sm font-bold uppercase tracking-wide text-emerald-700">
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
                  className="border-none bg-transparent text-center text-3xl font-bold text-gray-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <Badge
                  variant={getModifierVariant(modifier)}
                  size="lg"
                  className="mt-2 text-base font-bold"
                >
                  {formatModifier(modifier)}
                </Badge>
                <div className="mt-1 text-xs text-gray-500">modifier</div>
                <Button
                  onClick={() => onRollAbilityCheck(ability)}
                  variant="ghost"
                  size="xs"
                  className="mt-2 w-full text-emerald-600 hover:bg-emerald-100"
                  leftIcon={<Dices className="h-3 w-3" />}
                  title={`Roll ${ABILITY_NAMES[ability]} check (d20 + ${formatModifier(modifier)})`}
                >
                  Roll
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg border-2 border-indigo-300 bg-gradient-to-r from-indigo-100 to-purple-100 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-indigo-900">
            Proficiency Bonus:
          </span>
          <Badge variant="secondary" size="lg" className="text-base font-bold">
            {formatModifier(proficiencyBonus)}
          </Badge>
        </div>
      </div>
    </div>
  );
}
