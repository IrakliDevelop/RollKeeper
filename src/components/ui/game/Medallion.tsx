'use client';

import { cn } from '@/utils/cn';
import type { AbilityName } from '@/types/character';
import { AbilityScoreEditor } from './AbilityScoreEditor';
import {
  SWAP_ANIMATION,
  abilityNumbers,
  abilityNumbersLabel,
  useNumberSwap,
  type AbilityDisplay,
} from './abilityNumbers';

// Where each number starts when the display swaps: the ring number comes
// from the tab (24px lower, half size), the tab number from the ring.
const RING_FROM = '[--rk-swap-from:translateY(24px)_scale(0.5)]';
const TAB_FROM = '[--rk-swap-from:translateY(-24px)_scale(2)]';

export interface MedallionProps {
  ability: AbilityName;
  score: number;
  modifier: number;
  /** A brass ring marks a proficient saving throw; it is never decorative. */
  saveProficient: boolean;
  /** Which number sits large in the ring (the viewer's preference). */
  abilityDisplay: AbilityDisplay;
  /** Edit mode: with `onScoreChange`, the medallion opens the score editor. */
  editing?: boolean;
  onScoreChange?: (score: number) => void;
  /**
   * Animate a change of `abilityDisplay`. Pass `useUiPrefs().localChange`
   * so only a toggle in this tab animates; anything else snaps.
   */
  animateSwap?: boolean;
  className?: string;
}

/**
 * An ability as a 48px ring: the large number inside, the small one on a tab
 * over the ring's bottom edge. Plain in play mode (no tab stop); in edit
 * mode a button that opens the ability score editor.
 */
export function Medallion({
  ability,
  score,
  modifier,
  saveProficient,
  abilityDisplay,
  editing = false,
  onScoreChange,
  animateSwap = false,
  className,
}: MedallionProps) {
  const { swapKey, animate, onSwapEnd } = useNumberSwap(
    abilityDisplay,
    animateSwap
  );
  const { large, small } = abilityNumbers(modifier, score, abilityDisplay);
  const label = abilityNumbersLabel(ability, modifier, score);
  const editable = editing && onScoreChange !== undefined;

  // The ring is an SVG stroke: CSS borders snap 1.5px and 2.5px to whole
  // pixels.
  const ring = saveProficient ? 2.5 : 1.5;
  const face = cn(
    'relative inline-grid size-12 shrink-0 place-items-center rounded-full',
    className
  );
  const numbers = (
    <>
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        focusable="false"
        data-ring=""
        className={cn(
          'pointer-events-none absolute inset-0 size-full fill-none',
          saveProficient ? 'stroke-brass-border' : 'stroke-divider-strong'
        )}
      >
        <circle cx="24" cy="24" r={24 - ring / 2} strokeWidth={ring} />
      </svg>
      <span
        key={`large-${swapKey}`}
        aria-hidden="true"
        data-number="large"
        className={cn(
          'type-num-lg text-heading relative',
          RING_FROM,
          animate && SWAP_ANIMATION
        )}
      >
        {large}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'bg-surface absolute inset-x-0 -bottom-2.5 mx-auto w-fit rounded-sm border px-1',
          saveProficient ? 'border-brass-border' : 'border-divider-strong'
        )}
      >
        <span
          key={`small-${swapKey}`}
          data-number="small"
          className={cn(
            'type-small text-body block tabular-nums',
            TAB_FROM,
            animate && SWAP_ANIMATION
          )}
        >
          {small}
        </span>
      </span>
    </>
  );
  const data = {
    onAnimationEnd: onSwapEnd,
    'data-medallion': '',
    'data-display': abilityDisplay,
    'data-save-proficient': saveProficient ? 'true' : 'false',
  };

  return (
    <AbilityScoreEditor
      ability={ability}
      score={score}
      editing={editable}
      onScoreChange={onScoreChange}
    >
      {editable ? (
        <button
          type="button"
          aria-label={label}
          className={cn(face, 'cursor-pointer')}
          {...data}
        >
          {numbers}
        </button>
      ) : (
        <span role="img" aria-label={label} className={face} {...data}>
          {numbers}
        </span>
      )}
    </AbilityScoreEditor>
  );
}
