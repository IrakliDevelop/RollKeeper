'use client';

import type { ReactNode } from 'react';
import { Medallion } from '@/components/ui/game/Medallion';
import {
  ProficiencyDot,
  ProficiencyDotButton,
  saveDotLabel,
} from '@/components/ui/game/ProficiencyDot';
import {
  ROLL_TARGET,
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
  onScoreChange: (ability: AbilityName, score: number) => void;
  onToggleSaveProficiency: (ability: AbilityName, proficient: boolean) => void;
  onRollCheck: (ability: AbilityName) => void;
  onRollSave: (ability: AbilityName) => void;
  /** The skill list, or "No skills". */
  children: ReactNode;
}

const SAVE_LINE = 'type-small text-body inline-flex items-center gap-1';

/**
 * One ability: the medallion, the name over the save line, then its
 * skills. Play mode: the name rolls the check and the save line the save.
 * Edit mode: the medallion opens the score editor and the save dot toggles
 * the save proficiency.
 */
export function AbilityBlock({
  ability,
  score,
  save,
  saveProficient,
  abilityDisplay,
  animateSwap,
  editing,
  onScoreChange,
  onToggleSaveProficiency,
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
          editing={editing}
          onScoreChange={next => onScoreChange(ability, next)}
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
            <div className={SAVE_LINE}>
              <ProficiencyDotButton
                level={saveProficient ? 'proficient' : 'none'}
                pressed={saveProficient}
                aria-label={saveDotLabel(name)}
                onClick={() =>
                  onToggleSaveProficiency(ability, !saveProficient)
                }
              />
              <span>{saveText}</span>
            </div>
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
