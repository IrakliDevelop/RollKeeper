/**
 * Cantrip damage scaling (5e character-level thresholds 1/5/11/17).
 *
 * `Spell.damageScaling` tri-state contract (mirrors `Spell.aoe`):
 *   undefined = never enriched from spell data (backfill candidate)
 *   null      = user-customized damage; scaling permanently off
 *   object    = character-level threshold → dice
 */

import type { Spell } from '@/types/character';
import type { SpellScalingLevelDice } from '@/types/spells';

export type CantripDamageScaling = Record<number, string>;

export interface CantripUpgrade {
  name: string;
  from: string;
  to: string;
}

/** Plain rollable dice, e.g. "1d8", "2d6" — rejects {{spellcasting_mod}} templates. */
const DICE_PATTERN = /^\d+d\d+$/;

function cleanTrack(
  track: SpellScalingLevelDice
): CantripDamageScaling | undefined {
  const table: CantripDamageScaling = {};
  for (const [threshold, dice] of Object.entries(track.scaling ?? {})) {
    const level = Number(threshold);
    if (!Number.isInteger(level) || level < 1) continue;
    if (typeof dice !== 'string' || !DICE_PATTERN.test(dice)) continue;
    table[level] = dice;
  }
  return Object.keys(table).length > 0 ? table : undefined;
}

function lowestThresholdDie(table: CantripDamageScaling): string {
  const lowest = Math.min(...Object.keys(table).map(Number));
  return table[lowest]!;
}

/**
 * Normalize raw 5etools `scalingLevelDice` into a numeric threshold → dice
 * table. Multi-track cantrips (Toll the Dead, Booming Blade) store an array:
 * pick the track whose lowest-threshold die matches the already-extracted
 * base damage, falling back to the first usable track. Tracks made of
 * formula placeholders (Green-Flame Blade's "{{spellcasting_mod}}") are
 * dropped entirely.
 */
export function extractCantripScaling(
  scalingLevelDice: SpellScalingLevelDice | SpellScalingLevelDice[] | undefined,
  baseDamage?: string
): CantripDamageScaling | undefined {
  if (!scalingLevelDice) return undefined;
  const rawTracks = Array.isArray(scalingLevelDice)
    ? scalingLevelDice
    : [scalingLevelDice];
  const tracks = rawTracks
    .map(cleanTrack)
    .filter((t): t is CantripDamageScaling => t !== undefined);
  if (tracks.length === 0) return undefined;

  return (
    (baseDamage && tracks.find(t => lowestThresholdDie(t) === baseDamage)) ||
    tracks[0]
  );
}

/**
 * Effective damage dice for a spell at the given TOTAL character level
 * (multiclass sum). Non-cantrips, null/absent scaling, and levels below the
 * lowest threshold all fall back to the stored base damage.
 */
export function getScaledSpellDamage(
  spell: Pick<Spell, 'level' | 'damage' | 'damageScaling'>,
  characterLevel: number
): string | undefined {
  if (spell.level !== 0 || !spell.damageScaling) return spell.damage;
  let best: number | undefined;
  for (const key of Object.keys(spell.damageScaling)) {
    const threshold = Number(key);
    if (
      threshold <= characterLevel &&
      (best === undefined || threshold > best)
    ) {
      best = threshold;
    }
  }
  return best !== undefined ? spell.damageScaling[best] : spell.damage;
}

/**
 * Cantrips whose dice change between two character levels — level-up wizard
 * summary data.
 */
export function getCantripUpgrades(
  spells: Spell[],
  oldLevel: number,
  newLevel: number
): CantripUpgrade[] {
  const upgrades: CantripUpgrade[] = [];
  for (const spell of spells) {
    if (spell.level !== 0 || !spell.damageScaling) continue;
    const from = getScaledSpellDamage(spell, oldLevel);
    const to = getScaledSpellDamage(spell, newLevel);
    if (from && to && from !== to) {
      upgrades.push({ name: spell.name, from, to });
    }
  }
  return upgrades;
}

/**
 * damageScaling value after a spell-editor save: a manual damage change on a
 * scaling cantrip turns scaling off (null); otherwise the prior state is kept.
 */
export function resolveDamageScalingOnEdit(
  original: Pick<Spell, 'damage' | 'damageScaling'>,
  newDamage: string | undefined
): CantripDamageScaling | null | undefined {
  if (original.damageScaling && newDamage !== original.damage) return null;
  return original.damageScaling;
}
