import type { CharacterState } from '@/types/character';
import { DEFAULT_HP_STATE_BANDS } from '@/types/encounter';
import {
  calculatePassivePerception,
  getBuffSpeedBonus,
} from '@/utils/calculations';
import { characterSubtitle } from '@/utils/characterSummary';
import { hpStateLabel } from '@/utils/hpState';

/**
 * Read-only "limited view" of a party member's sheet, shown to other party
 * members in the map character-sheet drawer. Intentionally leaves out exact
 * HP (unless separately shared), spell slots, non-equipped inventory, notes,
 * currency, spells, features and condition notes/descriptions.
 */
export interface PartyPublicSheet {
  subtitle: string;
  hpState: string;
  speed: number;
  passivePerception: number;
  conditions: string[];
  concentration: string | null;
  equippedGear: string[];
}

/** Builds the party-facing public sheet, or null when the owner opted out. */
export function buildPartyPublicSheet(
  c: CharacterState
): PartyPublicSheet | null {
  if (c.sharePartyView === false) return null;

  const activeConditions = c.conditionsAndDiseases?.activeConditions ?? [];
  const conditions = Array.from(
    new Set(
      activeConditions.map(condition =>
        condition.stackable && condition.count > 1
          ? `${condition.name} ${condition.count}`
          : condition.name
      )
    )
  );

  const weaponNames = (c.weapons ?? [])
    .filter(w => w.isEquipped)
    .map(w => w.name);
  const armorNames = (c.armorItems ?? [])
    .filter(a => a.isEquipped)
    .map(a => a.name);
  const magicItemNames = (c.magicItems ?? [])
    .filter(m => m.isEquipped)
    .map(m => m.name);

  const equippedGear = Array.from(
    new Set([...weaponNames, ...armorNames, ...magicItemNames])
  ).sort((a, b) => a.localeCompare(b));

  const hp = c.hitPoints;
  // A band is meaningless without a positive max (missing/zero-max HP on
  // malformed or not-yet-initialized persisted data) — show nothing rather
  // than a misleading "Down".
  const hpState =
    hp && hp.max > 0
      ? hpStateLabel(hp.current ?? 0, hp.max, DEFAULT_HP_STATE_BANDS)
      : '';

  return {
    subtitle: characterSubtitle(c),
    hpState,
    speed: (c.speed ?? 0) + getBuffSpeedBonus(c),
    passivePerception: calculatePassivePerception(c),
    conditions,
    concentration: c.concentration?.isConcentrating
      ? (c.concentration.spellName ?? 'Concentrating')
      : null,
    equippedGear,
  };
}

/**
 * Same as {@link buildPartyPublicSheet}, but never throws. Persisted
 * character data comes from Redis as untrusted client JSON — a malformed or
 * partial record (e.g. missing `skills`/`abilities`) must not 500 the whole
 * party list. Use this from routes; call `buildPartyPublicSheet` directly
 * only where the caller already trusts the shape (e.g. tests).
 */
export function safeBuildPartyPublicSheet(
  c: CharacterState
): PartyPublicSheet | null {
  try {
    return buildPartyPublicSheet(c);
  } catch (error) {
    console.error('Failed to build party public sheet:', error);
    return null;
  }
}
