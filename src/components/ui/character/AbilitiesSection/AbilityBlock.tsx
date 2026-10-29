'use client';

import type { ReactNode } from 'react';
import { Medallion } from '@/components/ui/game/Medallion';
import { ProficiencyDot } from '@/components/ui/game/ProficiencyDot';
import {
  ROLL_TARGET,
  saveLineLabel,
  saveRollLabel,
} from '@/components/ui/game/LedgerCellView';
import type { AbilityDisplay } from '@/components/ui/game/abilityNumbers';
import { calculateModifier, formatModifier } from '@/utils/calculations';
import { cn } from '@/utils/cn';
import { ABILITY_NAMES } from '@/utils/constants';
import type { AbilityName } from '@/types/character';

export interface AbilityBlockProps {
  ability: AbilityName;
  score: number;
  /** The saving throw bonus. */
  save: number;
  saveProficient: boolean;
  abilityDisplay: AbilityDisplay;
  animateSwap: boolean;
  editing: boolean;
  onRollCheck: (ability: AbilityName) => void;
  onRollSave: (ability: AbilityName) => void;
  /** The skill list, or "No skills". */
  children: ReactNode;
}

const SAVE_LINE = 'type-small text-body inline-flex items-center gap-1';

/**
 * One ability: the medallion, the name over the save line, then its
 * skills. In play mode the name rolls the check and the save line the save.
 */
export function AbilityBlock({
  ability,
  score,
  save,
  saveProficient,
  abilityDisplay,
  animateSwap,
  editing,
  onRollCheck,
  onRollSave,
  children,
}: AbilityBlockProps) {
  const name = ABILITY_NAMES[ability];
  const saveText = `Save ${formatModifier(save)}`;
  const dot = (
    <ProficiencyDot level={saveProficient ? 'proficient' : 'none'} decorative />
  );

  return (
    <div data-ability-block={ability}>
      <div className="flex items-start gap-4">
        <Medallion
          ability={ability}
          score={score}
          modifier={calculateModifier(score)}
          saveProficient={saveProficient}
          abilityDisplay={abilityDisplay}
          animateSwap={animateSwap}
        />
        <div className="min-w-0">
          {editing ? (
            <h3 className="type-label-heading text-heading">{name}</h3>
          ) : (
            // The heading keeps the ability's name; the button inside says
            // what it does.
            <h3 aria-label={name} className="type-label-heading text-heading">
              <button
                type="button"
                aria-label={`Roll ${name} check`}
                onClick={() => onRollCheck(ability)}
                className={cn(
                  'type-label-heading text-heading text-left',
                  ROLL_TARGET
                )}
              >
                {name}
              </button>
            </h3>
          )}
          {editing ? (
            <span
              role="img"
              aria-label={saveLineLabel(ability, save, saveProficient)}
              className={SAVE_LINE}
            >
              {dot}
              <span>{saveText}</span>
            </span>
          ) : (
            // Named by its content, which holds the visible "Save +5".
            <button
              type="button"
              onClick={() => onRollSave(ability)}
              className={cn(SAVE_LINE, ROLL_TARGET)}
            >
              {dot}
              <span aria-hidden="true">{saveText}</span>
              <span className="sr-only">
                {saveRollLabel(ability, save, saveProficient)}
              </span>
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
