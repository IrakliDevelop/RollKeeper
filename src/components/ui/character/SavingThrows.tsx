'use client';

import { ABILITY_NAMES } from "@/utils/constants";
import { formatModifier } from "@/utils/calculations";
import { AbilityName, CharacterState } from "@/types/character";

interface SavingThrowsProps {
  savingThrows: CharacterState['savingThrows'];
  getSavingThrowModifier: (ability: AbilityName) => number;
  onUpdateSavingThrowProficiency: (ability: AbilityName, proficient: boolean) => void;
  onRollSavingThrow: (ability: AbilityName) => void;
}

export default function SavingThrows({
  savingThrows,
  getSavingThrowModifier,
  onUpdateSavingThrowProficiency,
  onRollSavingThrow
}: SavingThrowsProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
        Saving Throws
      </h2>
      <div className="space-y-2">
        {(Object.keys(ABILITY_NAMES) as AbilityName[]).map((ability) => (
          <div key={ability} className="flex items-center gap-3 p-2 hover:bg-purple-50 rounded transition-colors">
            <input 
              type="checkbox" 
              checked={savingThrows[ability].proficient}
              onChange={(e) => onUpdateSavingThrowProficiency(ability, e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded" 
            />
            <span className="font-mono text-sm font-semibold w-8 text-right text-purple-800">
              {formatModifier(getSavingThrowModifier(ability))}
            </span>
            <button
              onClick={() => onRollSavingThrow(ability)}
              className="text-sm text-gray-800 hover:text-purple-700 hover:bg-purple-100 px-2 py-1 rounded transition-colors cursor-pointer font-medium"
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
