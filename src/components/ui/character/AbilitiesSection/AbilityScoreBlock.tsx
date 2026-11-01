'use client';

import { Medallion } from '@/components/ui/game/Medallion';
import { ROLL_TARGET } from '@/components/ui/game/LedgerCellView';
import type { AbilityDisplay } from '@/components/ui/game/abilityNumbers';
import { calculateModifier } from '@/utils/calculations';
import { ABILITY_NAMES } from '@/utils/constants';
import { cn } from '@/utils/cn';
import type { AbilityName } from '@/types/character';

/** Score-only presentation; the 2014 saving throws live in their own group. */
export function AbilityScoreBlock({
  ability,
  score,
  saveProficient,
  abilityDisplay,
  animateSwap,
  editing,
  onScoreChange,
  onRollCheck,
}: {
  ability: AbilityName;
  score: number;
  saveProficient: boolean;
  abilityDisplay: AbilityDisplay;
  animateSwap: boolean;
  editing: boolean;
  onScoreChange: (ability: AbilityName, score: number) => void;
  onRollCheck: (ability: AbilityName) => void;
}) {
  const name = ABILITY_NAMES[ability];
  return (
    <div
      data-ability-score={ability}
      className="flex min-w-0 flex-col items-center gap-2 text-center"
    >
      <h4 aria-label={name} className="type-label-heading text-heading">
        {editing ? (
          name
        ) : (
          <button
            type="button"
            aria-label={`Roll ${name} check`}
            onClick={() => onRollCheck(ability)}
            className={cn('type-label-heading text-heading', ROLL_TARGET)}
          >
            {name}
          </button>
        )}
      </h4>
      <span className="type-caption text-muted">
        {abilityDisplay === 'score' ? 'Score' : 'Modifier'}
      </span>
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
      <span className="type-caption text-muted mt-2">
        {abilityDisplay === 'score' ? 'Modifier' : 'Score'}
      </span>
    </div>
  );
}
