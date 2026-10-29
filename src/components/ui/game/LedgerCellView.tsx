'use client';

import { formatModifier } from '@/utils/calculations';
import { cn } from '@/utils/cn';
import { ABILITY_NAMES } from '@/utils/constants';
import type { AbilityName } from '@/types/character';
import { AbilityScoreEditor } from './AbilityScoreEditor';
import { ProficiencyDot } from './ProficiencyDot';
import {
  SWAP_ANIMATION,
  abilityNumbers,
  abilityNumbersLabel,
  type AbilityDisplay,
} from './abilityNumbers';

// Where each number starts when the display swaps: the large number comes
// from the small one's place (to its right, at 13/20 size), and back.
const LARGE_FROM = '[--rk-swap-from:translateX(20px)_scale(0.65)]';
const SMALL_FROM = '[--rk-swap-from:translateX(-20px)_scale(1.5)]';

/** "Strength saving throw +5, proficient" / "Strength saving throw +5". */
export function saveLineLabel(
  ability: AbilityName,
  save: number,
  proficient: boolean
): string {
  const label = `${ABILITY_NAMES[ability]} saving throw ${formatModifier(save)}`;
  return proficient ? `${label}, proficient` : label;
}

/**
 * A save roll button's name, built around its visible "Save +5":
 * "Roll Strength Save +5, proficient" / "Roll Strength Save +5".
 */
export function saveRollLabel(
  ability: AbilityName,
  save: number,
  proficient: boolean
): string {
  const label = `Roll ${ABILITY_NAMES[ability]} Save ${formatModifier(save)}`;
  return proficient ? `${label}, proficient` : label;
}

export interface LedgerCell {
  ability: AbilityName;
  score: number;
  modifier: number;
  /** The saving throw bonus. */
  save: number;
  saveProficient: boolean;
}

/** A text roll button's target: no chrome, 24px tall (44px on touch), brass focus ring. */
export const ROLL_TARGET =
  'cursor-pointer rounded-sm min-h-6 pointer-coarse:min-h-11 pointer-coarse:min-w-11 focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2';

/** One ability in a `LedgerRow`; the row passes its swap state down. */
export function LedgerCellView({
  cell,
  rules,
  abilityDisplay,
  swapKey,
  animate,
  editing,
  onScoreChange,
  onRollCheck,
  onRollSave,
}: {
  cell: LedgerCell;
  rules: string;
  abilityDisplay: AbilityDisplay;
  swapKey: AbilityDisplay;
  animate: boolean;
  editing: boolean;
  onScoreChange?: (ability: AbilityName, score: number) => void;
  onRollCheck?: (ability: AbilityName) => void;
  onRollSave?: (ability: AbilityName) => void;
}) {
  const { ability, score, modifier, save, saveProficient } = cell;
  const name = ABILITY_NAMES[ability];
  const { large, small } = abilityNumbers(modifier, score, abilityDisplay);
  const label = abilityNumbersLabel(ability, modifier, score);
  const editable = editing && onScoreChange !== undefined;

  const pair = (
    <>
      <span
        key={`large-${swapKey}`}
        aria-hidden="true"
        data-number="large"
        className={cn(
          'type-num-md text-heading',
          LARGE_FROM,
          animate && SWAP_ANIMATION
        )}
      >
        {large}
      </span>
      <span
        key={`small-${swapKey}`}
        aria-hidden="true"
        data-number="small"
        className={cn(
          'type-small text-muted tabular-nums',
          SMALL_FROM,
          animate && SWAP_ANIMATION
        )}
      >
        {small}
      </span>
    </>
  );
  const pairClass = 'inline-flex items-baseline gap-1';

  const saveLine = (
    <>
      <ProficiencyDot
        level={saveProficient ? 'proficient' : 'none'}
        decorative
      />
      <span aria-hidden="true">Save {formatModifier(save)}</span>
    </>
  );
  const saveClass = 'type-small text-body inline-flex items-center gap-1';

  return (
    <div
      data-ledger-cell={ability}
      className={cn(
        'border-divider flex flex-col items-center gap-1 px-2 py-2 text-center',
        rules
      )}
    >
      {onRollCheck ? (
        <button
          type="button"
          aria-label={`Roll ${name} check`}
          onClick={() => onRollCheck(ability)}
          className={cn('type-caption text-muted', ROLL_TARGET)}
        >
          {name}
        </button>
      ) : (
        <span className="type-caption text-muted">{name}</span>
      )}

      <AbilityScoreEditor
        ability={ability}
        score={score}
        editing={editable}
        onScoreChange={
          onScoreChange ? next => onScoreChange(ability, next) : undefined
        }
      >
        {editable ? (
          <button
            type="button"
            aria-label={label}
            className="inline-flex cursor-pointer items-center justify-center rounded-sm px-1 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            {/* Centred as a pair, so a 44px touch box doesn't drop the
                numbers to its top edge. */}
            <span className={pairClass}>{pair}</span>
          </button>
        ) : (
          <span role="img" aria-label={label} className={pairClass}>
            {pair}
          </span>
        )}
      </AbilityScoreEditor>

      {onRollSave ? (
        // Named by its content, which holds the visible "Save +5".
        <button
          type="button"
          onClick={() => onRollSave(ability)}
          className={cn(saveClass, 'justify-center', ROLL_TARGET)}
        >
          {saveLine}
          <span className="sr-only">
            {saveRollLabel(ability, save, saveProficient)}
          </span>
        </button>
      ) : (
        <span
          role="img"
          aria-label={saveLineLabel(ability, save, saveProficient)}
          className={saveClass}
        >
          {saveLine}
        </span>
      )}
    </div>
  );
}
