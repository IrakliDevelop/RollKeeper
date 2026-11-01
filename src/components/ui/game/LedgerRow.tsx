'use client';

import { cn } from '@/utils/cn';
import type { AbilityName } from '@/types/character';
import { LedgerCellView, type LedgerCell } from './LedgerCellView';
import { useNumberSwap, type AbilityDisplay } from './abilityNumbers';

export { saveLineLabel, type LedgerCell } from './LedgerCellView';

export interface LedgerRowProps {
  /** The six abilities, in the order to show them. */
  cells: LedgerCell[];
  /** Which number is large (the viewer's preference). */
  abilityDisplay: AbilityDisplay;
  /** Pass `useUiPrefs().localChange`: only a toggle here animates. */
  animateSwap?: boolean;
  /** Edit mode: with `onScoreChange`, each score opens the score editor. */
  editing?: boolean;
  onScoreChange?: (ability: AbilityName, score: number) => void;
  /** Without these the names and saves are plain text (rolls stay gated). */
  onRollCheck?: (ability: AbilityName) => void;
  onRollSave?: (ability: AbilityName) => void;
  className?: string;
}

// Hairlines between cells only: six across from 32rem of the row's own
// width, otherwise three by two.
const CELL_RULES = [
  '',
  'border-l',
  'border-l',
  'border-t @lg:border-t-0 @lg:border-l',
  'border-t border-l @lg:border-t-0',
  'border-t border-l @lg:border-t-0',
];

/**
 * The six abilities in one row for compact places (the map sheet drawer, the
 * DM's view of a player). Each cell has the ability name, its two numbers
 * and the save line. Wraps to 3×2 by its own width.
 */
export function LedgerRow({
  cells,
  abilityDisplay,
  animateSwap = false,
  editing = false,
  onScoreChange,
  onRollCheck,
  onRollSave,
  className,
}: LedgerRowProps) {
  const { swapKey, animate, onSwapEnd } = useNumberSwap(
    abilityDisplay,
    animateSwap
  );
  // Rolls happen in play mode; while editing a cell has one action.
  const rollCheck = editing ? undefined : onRollCheck;
  const rollSave = editing ? undefined : onRollSave;

  return (
    <div
      data-ledger-row=""
      data-display={abilityDisplay}
      onAnimationEnd={onSwapEnd}
      className={cn('@container', className)}
    >
      <div className="grid grid-cols-3 @lg:grid-cols-6">
        {cells.map((cell, position) => (
          <LedgerCellView
            key={cell.ability}
            cell={cell}
            rules={CELL_RULES[position] ?? ''}
            abilityDisplay={abilityDisplay}
            swapKey={swapKey}
            animate={animate}
            editing={editing}
            onScoreChange={onScoreChange}
            onRollCheck={rollCheck}
            onRollSave={rollSave}
          />
        ))}
      </div>
    </div>
  );
}
