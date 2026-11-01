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
import type { UiPrefs } from '@/hooks/useUiPrefs';

export interface AbilityBlockProps {
  ability: AbilityName;
  score: number;
  /** The saving throw bonus. */
  save: number;
  saveProficient: boolean;
  abilityDisplay: AbilityDisplay;
  layout?: UiPrefs['abilityLayout'];
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
  layout = 'classic',
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

  const sheetLayout = layout === '2024';
  const heading = (
    <h3 aria-label={name} className="type-label-heading text-heading">
      {editing ? (
        name
      ) : (
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
      )}
    </h3>
  );
  const medallion = (
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
  );
  const saveLine = editing ? (
    <div className={SAVE_LINE}>
      <ProficiencyDotButton
        level={saveProficient ? 'proficient' : 'none'}
        pressed={saveProficient}
        aria-label={saveDotLabel(name)}
        onClick={() => onToggleSaveProficiency(ability, !saveProficient)}
      />
      <span>{saveText}</span>
    </div>
  ) : (
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
  );

  return (
    <div
      data-ability-block={ability}
      className={cn(
        sheetLayout && 'border-input-border min-w-0 self-start border'
      )}
    >
      {sheetLayout ? (
        <>
          <div className="border-divider border-b px-3 py-2 text-center">
            {heading}
          </div>
          <div className="flex flex-col items-center gap-2 px-3 pt-3 pb-4">
            <span className="type-caption text-muted">
              {abilityDisplay === 'score' ? 'Score' : 'Modifier'}
            </span>
            {medallion}
            <span className="type-caption text-muted mt-2">
              {abilityDisplay === 'score' ? 'Modifier' : 'Score'}
            </span>
          </div>
          <div className="border-divider border-y px-3 py-2">{saveLine}</div>
        </>
      ) : (
        <div className="flex items-start gap-4">
          {medallion}
          <div className="min-w-0">
            {heading}
            {saveLine}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
