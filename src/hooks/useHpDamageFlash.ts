'use client';

import { useState } from 'react';

export interface HpDamageFlashInput {
  /** The character the HP belongs to; a new id starts a new baseline. */
  id: string;
  current: number;
  max: number;
}

/**
 * Counts the hits to flash: each time `current` drops for the same
 * character while `max` stays the same. It never counts the first value it
 * sees, a different character, healing, an unchanged value or any max HP
 * change. It reads state transitions rather than the damage action, so a
 * hit applied in another tab or by the DM flashes too (under single-writer
 * sync the tab that pressed "Damage" may be a follower). Re-key the flash
 * element on the count so consecutive hits each play.
 *
 * The flash element keeps its animation class after it plays, so keep it
 * on a surface that is never hidden and shown again (the HUD always shows).
 * A sheet that opens on a stored copy and then adopts a fresher copy of the
 * same character with lower HP (a restore from another device) flashes
 * once on open: from here that is indistinguishable from a hit.
 */
export function useHpDamageFlash({
  id,
  current,
  max,
}: HpDamageFlashInput): number {
  const [seen, setSeen] = useState({ id, current, max, flashCount: 0 });
  // Object.is, so a NaN value (bad damage input) counts as unchanged on the
  // next render instead of re-rendering forever.
  if (
    seen.id !== id ||
    !Object.is(seen.current, current) ||
    !Object.is(seen.max, max)
  ) {
    const hit = seen.id === id && seen.max === max && current < seen.current;
    const flashCount = seen.flashCount + (hit ? 1 : 0);
    // Storing the previous values in state (not an effect) keeps the count
    // in step with the render that shows the new HP.
    setSeen({ id, current, max, flashCount });
    return flashCount;
  }
  return seen.flashCount;
}
