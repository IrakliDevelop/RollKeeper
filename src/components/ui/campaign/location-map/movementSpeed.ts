import type { PathRangeBand } from '@fieldnotes/core';

import { getBuffSpeedBonus } from '@/utils/calculations';

import type { CharacterState } from '@/types/character';

/** Canvas paint colors for movement range bands (not theme tokens — these
 * draw on the canvas, which has no CSS custom-property resolution). */
export const MOVEMENT_WITHIN_SPEED_COLOR = '#22C55E';
export const MOVEMENT_DASH_COLOR = '#F59E0B';
export const MOVEMENT_BEYOND_COLOR = '#EF4444';

/** Fallback when no speed source resolves (unknown entity, unparseable
 * stat block, player token moved by the DM this cycle). */
export const MOVEMENT_DEFAULT_WALK_FEET = 30;

export type ParsedWalkingSpeed =
  | { kind: 'walk'; feet: number }
  /** Recognized speed string with only non-walk modes (fly/swim/...). */
  | { kind: 'no-walk' }
  /** Empty, malformed, or unrecognizable — nothing was understood. */
  | { kind: 'unknown' };

const NON_WALK_MODE = /^\s*(?:fly|swim|climb|burrow)\.?\s+\d+/i;
const CAN_HOVER = /^\s*can\s+hover\b/i;

/**
 * Walking speed out of a free-text monster/NPC speed string. formatSpeed
 * (bestiaryDataLoader) emits the walk entry FIRST and unprefixed
 * ("30 ft., fly 60 ft."); hand-typed NPC speeds may say "walk 25 ft."
 * anywhere. A segment whose first token is a non-walk mode (fly/swim/...)
 * is never the walking speed — only an unprefixed or walk-prefixed segment
 * counts. Distinguishes a RECOGNIZED walkless speed ('no-walk') from
 * malformed data ('unknown') so a flying creature does not silently
 * become a 30-ft walker.
 */
export function parseWalkingSpeed(
  speed: string | null | undefined
): ParsedWalkingSpeed {
  if (!speed) return { kind: 'unknown' };
  let sawNonWalkMode = false;
  for (const segment of speed.split(',')) {
    const match = /^\s*(?:walk\.?\s+)?(\d+)\b/i.exec(segment);
    if (match?.[1] !== undefined) {
      return { kind: 'walk', feet: parseInt(match[1], 10) };
    }
    if (NON_WALK_MODE.test(segment) || CAN_HOVER.test(segment)) {
      sawNonWalkMode = true;
    }
  }
  return sawNonWalkMode ? { kind: 'no-walk' } : { kind: 'unknown' };
}

/** Band input for a parsed speed: no-walk is 0 ft (all-red path), never
 * the default; only genuinely unknown data falls back to 30 ft. */
export function walkFeetFromParsed(parsed: ParsedWalkingSpeed): number {
  if (parsed.kind === 'walk') return parsed.feet;
  if (parsed.kind === 'no-walk') return 0;
  return MOVEMENT_DEFAULT_WALK_FEET;
}

/** Effective walking speed for the player's own character. */
export function characterWalkingSpeed(character: CharacterState): number {
  return character.speed + getBuffSpeedBonus(character);
}

/**
 * PathTool range bands for a walking speed: green up to speed, amber up to
 * double speed when Dash is on. Beyond the last band the tool's base color
 * (MOVEMENT_BEYOND_COLOR) applies — configured on the tool, not here.
 */
export function movementRangeBands(
  walkFeet: number,
  dash: boolean
): PathRangeBand[] {
  if (!(walkFeet > 0)) return [];
  const bands: PathRangeBand[] = [
    { feet: walkFeet, color: MOVEMENT_WITHIN_SPEED_COLOR },
  ];
  if (dash) bands.push({ feet: walkFeet * 2, color: MOVEMENT_DASH_COLOR });
  return bands;
}
