'use client';

import { useState, type AnimationEvent } from 'react';
import type { UiPrefs } from '@/hooks/useUiPrefs';
import { formatModifier } from '@/utils/calculations';
import { ABILITY_NAMES } from '@/utils/constants';
import type { AbilityName } from '@/types/character';

/** Which number an ability shows large; the other sits small beside it. */
export type AbilityDisplay = UiPrefs['abilityDisplay'];

/** The two numbers in display order: large first. */
export function abilityNumbers(
  modifier: number,
  score: number,
  display: AbilityDisplay
): { large: string; small: string } {
  const mod = formatModifier(modifier);
  const value = String(score);
  return display === 'score'
    ? { large: value, small: mod }
    : { large: mod, small: value };
}

/**
 * "Strength: modifier +3, score 16". The same label in both display modes,
 * so screen readers don't hear the visual order.
 */
export function abilityNumbersLabel(
  ability: AbilityName,
  modifier: number,
  score: number
): string {
  return `${ABILITY_NAMES[ability]}: modifier ${formatModifier(modifier)}, score ${score}`;
}

/** The keyframes in globals.css. */
const SWAP_KEYFRAMES = 'rk-number-swap';

/** Plays `@keyframes rk-number-swap` (globals.css) from `--rk-swap-from`. */
export const SWAP_ANIMATION = 'animate-rk-number-swap';

/**
 * Arms the large-number swap. A change of `display` re-keys the two
 * numbers (React remounts them) and, only when `animateSwap` is true, adds
 * the swap animation class. The first render and any change made elsewhere
 * (a hydration correction, another tab) remount without the class, so they
 * snap. The class comes off when the swap ends, so a later remount (edit
 * mode, a phone turning across 640px) or a hidden tab panel shown again
 * doesn't play it a second time. (React has no animationcancel handler: a
 * panel hidden during the 180ms replays the swap once when shown.) Derived
 * during render plus one event handler: no effect, no timer.
 */
export function useNumberSwap(
  display: AbilityDisplay,
  animateSwap: boolean
): {
  swapKey: AbilityDisplay;
  animate: boolean;
  /** Put on an element that contains both numbers, as onAnimationEnd. */
  onSwapEnd: (event: AnimationEvent<Element>) => void;
} {
  const [seen, setSeen] = useState({ display, animate: false });
  const onSwapEnd = (event: AnimationEvent<Element>) => {
    if (event.animationName !== SWAP_KEYFRAMES) return;
    setSeen(current =>
      current.animate ? { ...current, animate: false } : current
    );
  };
  if (seen.display !== display) {
    setSeen({ display, animate: animateSwap });
    return { swapKey: display, animate: animateSwap, onSwapEnd };
  }
  return { swapKey: display, animate: seen.animate, onSwapEnd };
}
