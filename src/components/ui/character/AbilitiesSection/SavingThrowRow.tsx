'use client';

import {
  ProficiencyDot,
  ProficiencyDotButton,
  saveDotLabel,
} from '@/components/ui/game/ProficiencyDot';
import {
  ROLL_TARGET,
  saveRollLabel,
} from '@/components/ui/game/LedgerCellView';
import { formatModifier } from '@/utils/calculations';
import { cn } from '@/utils/cn';
import { ABILITY_NAMES } from '@/utils/constants';
import type { AbilityName } from '@/types/character';

interface SavingThrowRowProps {
  ability: AbilityName;
  save: number;
  proficient: boolean;
  editing: boolean;
  variant?: 'inline' | 'list';
  onToggleProficiency: (ability: AbilityName, proficient: boolean) => void;
  onRoll: (ability: AbilityName) => void;
}

/** One save's shared proficiency control, bonus and roll action. */
export function SavingThrowRow({
  ability,
  save,
  proficient,
  editing,
  variant = 'inline',
  onToggleProficiency,
  onRoll,
}: SavingThrowRowProps) {
  const name = ABILITY_NAMES[ability];
  const dot = editing ? (
    <ProficiencyDotButton
      level={proficient ? 'proficient' : 'none'}
      pressed={proficient}
      aria-label={saveDotLabel(name)}
      onClick={() => onToggleProficiency(ability, !proficient)}
    />
  ) : (
    <ProficiencyDot level={proficient ? 'proficient' : 'none'} decorative />
  );
  const label = saveRollLabel(ability, save, proficient);
  const saveText = `Save ${formatModifier(save)}`;
  if (variant === 'list') {
    return (
      <div className="flex items-center gap-2 py-1 pointer-coarse:min-h-11">
        {dot}
        <span className="type-ui text-heading w-8 shrink-0 text-right tabular-nums">
          {formatModifier(save)}
        </span>
        {editing ? (
          <span className="type-ui text-body">{name}</span>
        ) : (
          <button
            type="button"
            aria-label={label}
            onClick={() => onRoll(ability)}
            className={cn(
              'type-ui text-body min-w-0 flex-1 text-left',
              ROLL_TARGET
            )}
          >
            {name}
          </button>
        )}
      </div>
    );
  }
  const inlineClass = 'type-small text-body inline-flex items-center gap-1';
  return editing ? (
    <div className={inlineClass}>
      {dot}
      <span>{saveText}</span>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => onRoll(ability)}
      className={cn(inlineClass, ROLL_TARGET)}
    >
      {dot}
      <span aria-hidden="true">{saveText}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
