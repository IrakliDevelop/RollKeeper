'use client';

import { ABILITY_NAMES } from '@/utils/constants';
import { formatModifier } from '@/utils/calculations';
import { Button, Checkbox } from '@/components/ui/forms';
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
    <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-6 shadow-lg">
      <h2 className="border-divider text-heading mb-4 border-b pb-2 text-lg font-bold">
        Saving Throws
      </h2>
      <div className="space-y-2">
        {(Object.keys(ABILITY_NAMES) as AbilityName[]).map(ability => (
          <div
            key={ability}
            className="hover:bg-accent-purple-bg flex items-center gap-3 rounded p-2 transition-colors"
          >
            <Checkbox
              checked={savingThrows[ability].proficient}
              onCheckedChange={checked =>
                onUpdateSavingThrowProficiency(ability, checked)
              }
              size="sm"
              variant="primary"
            />
            <span className="text-accent-purple-text w-8 text-right font-mono text-sm font-semibold">
              {formatModifier(getSavingThrowModifier(ability))}
            </span>
            <Button
              onClick={() => onRollSavingThrow(ability)}
              variant="ghost"
              size="sm"
              className="hover:bg-accent-purple-bg-strong hover:text-accent-purple-text"
              title={`Roll ${ABILITY_NAMES[ability]} saving throw (d20 + ${formatModifier(getSavingThrowModifier(ability))})`}
            >
              {ABILITY_NAMES[ability]}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
