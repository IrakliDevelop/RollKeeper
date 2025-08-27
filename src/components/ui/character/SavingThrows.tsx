'use client';

import { ABILITY_NAMES } from '@/utils/constants';
import { formatModifier } from '@/utils/calculations';
import { AbilityName, CharacterState } from '@/types/character';

interface SavingThrowsProps {
  savingThrows: CharacterState['savingThrows'];
  getSavingThrowModifier: (ability: AbilityName) => number;
  onUpdateSavingThrowProficiency: (
    ability: AbilityName,
    proficient: boolean
  ) => void;
  onRollSavingThrow: (ability: AbilityName) => void;
}

export default function SavingThrows({
  savingThrows,
  getSavingThrowModifier,
  onUpdateSavingThrowProficiency,
  onRollSavingThrow,
}: SavingThrowsProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-white p-6 shadow-lg">
      <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-bold text-gray-800">
        Saving Throws
      </h2>
      <div className="space-y-2">
        {(Object.keys(ABILITY_NAMES) as AbilityName[]).map(ability => (
          <div
            key={ability}
            className="flex items-center gap-3 rounded p-2 transition-colors hover:bg-purple-50"
          >
            <input
              type="checkbox"
              checked={savingThrows[ability].proficient}
              onChange={e =>
                onUpdateSavingThrowProficiency(ability, e.target.checked)
              }
              className="h-4 w-4 rounded text-purple-600"
            />
            <span className="w-8 text-right font-mono text-sm font-semibold text-purple-800">
              {formatModifier(getSavingThrowModifier(ability))}
            </span>
            <button
              onClick={() => onRollSavingThrow(ability)}
              className="cursor-pointer rounded px-2 py-1 text-sm font-medium text-gray-800 transition-colors hover:bg-purple-100 hover:text-purple-700"
              title={`Roll ${ABILITY_NAMES[ability]} saving throw (d20 + ${formatModifier(getSavingThrowModifier(ability))})`}
            >
              {ABILITY_NAMES[ability]}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
