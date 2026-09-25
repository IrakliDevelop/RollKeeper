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
  const conditions = activeConditions.map(condition =>
    condition.stackable && condition.count > 1
      ? `${condition.name} ${condition.count}`
      : condition.name
  );

  const weaponNames = (c.weapons ?? [])
    .filter(w => w.isEquipped)
    .map(w => w.name);
  const armorNames = (c.armorItems ?? [])
    .filter(a => a.isEquipped)
    .map(a => a.name);
  const magicItemNames = (c.magicItems ?? [])
    .filter(m => m.isEquipped || m.isAttuned)
    .map(m => m.name);

  const equippedGear = Array.from(
    new Set([...weaponNames, ...armorNames, ...magicItemNames])
  ).sort((a, b) => a.localeCompare(b));

  const hp = c.hitPoints;

  return {
    subtitle: characterSubtitle(c),
    hpState: hpStateLabel(
      hp?.current ?? 0,
      hp?.max ?? 0,
      DEFAULT_HP_STATE_BANDS
    ),
    speed: (c.speed ?? 0) + getBuffSpeedBonus(c),
    passivePerception: calculatePassivePerception(c),
    conditions,
    concentration: c.concentration?.isConcentrating
      ? (c.concentration.spellName ?? 'Concentrating')
      : null,
    equippedGear,
  };
}
