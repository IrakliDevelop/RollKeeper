/**
 * Attached Spells Parser for Magic Items
 *
 * Parses the `attachedSpells` field from 5eTools magic item JSON.
 * Unlike feats (which use `additionalSpells`), items use a simpler format
 * with no "choose"-type entries.
 *
 * Input formats:
 *   charges: { "3": ["spell"] }     -> shared pool ability, costs 3
 *   will: ["spell"]                  -> at-will (cost 0)
 *   daily: { "1": ["spell"] }       -> individual charge, 1/long rest
 *   rest: { "1": ["spell"] }        -> individual charge, 1/short rest
 *   limited: { "1": ["spell"] }     -> individual charge, 1/long rest
 *   ritual: ["spell"]               -> at-will, ritual only
 *   other: ["spell"]                -> special (cost 0)
 *   flat array ["spell1", "spell2"] -> reference spells (informational)
 *   ability: "int"                  -> casting ability (stored separately)
 */

import { cleanSpellName } from './additionalSpellsParser';
import type {
  ChargePoolAbility,
  MagicItemCharge,
  ChargePool,
} from '@/types/character';

export interface ParsedAttachedSpells {
  poolAbilities: ChargePoolAbility[];
  individualCharges: MagicItemCharge[];
  referenceSpells: string[];
  castingAbility?: string;
}

function titleCase(str: string): string {
  return str.replace(/(?:^|\s)\w/g, c => c.toUpperCase());
}

function parseSpellList(
  spells: unknown[]
): Array<{ name: string; level?: number }> {
  return spells
    .filter((s): s is string => typeof s === 'string')
    .map(s => cleanSpellName(s));
}

let abilityIdCounter = 0;
function nextAbilityId(): string {
  return `cpa-${Date.now()}-${++abilityIdCounter}`;
}

function nextChargeId(): string {
  return `mic-${Date.now()}-${++abilityIdCounter}`;
}

export function parseAttachedSpells(
  raw: Record<string, unknown>,
  itemCharges?: number,
  itemRecharge?: string
): ParsedAttachedSpells {
  const poolAbilities: ChargePoolAbility[] = [];
  const individualCharges: MagicItemCharge[] = [];
  const referenceSpells: string[] = [];
  let castingAbility: string | undefined;

  // Ability (rare, e.g. Professor Orb)
  if (typeof raw.ability === 'string') {
    castingAbility = raw.ability;
  }

  // charges: { "3": ["fireball", "cone of cold"] }
  // These consume from the item's shared charge pool
  if (
    raw.charges &&
    typeof raw.charges === 'object' &&
    !Array.isArray(raw.charges)
  ) {
    const charges = raw.charges as Record<string, unknown>;
    for (const [costStr, spells] of Object.entries(charges)) {
      const cost = parseInt(costStr, 10) || 1;
      if (Array.isArray(spells)) {
        for (const parsed of parseSpellList(spells)) {
          poolAbilities.push({
            id: nextAbilityId(),
            name: titleCase(parsed.name),
            cost,
            isSpell: true,
            spellLevel: parsed.level,
          });
        }
      }
    }
  }

  // will: ["pass without trace", "shillelagh"]
  if (Array.isArray(raw.will)) {
    for (const parsed of parseSpellList(raw.will)) {
      poolAbilities.push({
        id: nextAbilityId(),
        name: titleCase(parsed.name),
        cost: 0,
        isSpell: true,
        spellLevel: parsed.level,
        description: 'At will',
      });
    }
  }

  // ritual: ["detect evil and good"]
  if (Array.isArray(raw.ritual)) {
    for (const parsed of parseSpellList(raw.ritual)) {
      poolAbilities.push({
        id: nextAbilityId(),
        name: titleCase(parsed.name),
        cost: 0,
        isSpell: true,
        spellLevel: parsed.level,
        description: 'Ritual only',
      });
    }
  }

  // other: ["teleport"]
  if (Array.isArray(raw.other)) {
    for (const parsed of parseSpellList(raw.other)) {
      poolAbilities.push({
        id: nextAbilityId(),
        name: titleCase(parsed.name),
        cost: 0,
        isSpell: true,
        spellLevel: parsed.level,
        description: 'Special',
      });
    }
  }

  // daily: { "1": ["spell1"], "1e": ["spell2"] }
  // Each spell gets its own individual charge counter
  if (raw.daily && typeof raw.daily === 'object' && !Array.isArray(raw.daily)) {
    const daily = raw.daily as Record<string, unknown>;
    for (const [countStr, spells] of Object.entries(daily)) {
      const count = parseInt(countStr, 10) || 1;
      if (Array.isArray(spells)) {
        for (const parsed of parseSpellList(spells)) {
          individualCharges.push({
            id: nextChargeId(),
            name: titleCase(parsed.name),
            maxCharges: count,
            usedCharges: 0,
            restType: 'long',
          });
        }
      }
    }
  }

  // rest: { "1": ["spell"] }
  if (raw.rest && typeof raw.rest === 'object' && !Array.isArray(raw.rest)) {
    const rest = raw.rest as Record<string, unknown>;
    for (const [countStr, spells] of Object.entries(rest)) {
      const count = parseInt(countStr, 10) || 1;
      if (Array.isArray(spells)) {
        for (const parsed of parseSpellList(spells)) {
          individualCharges.push({
            id: nextChargeId(),
            name: titleCase(parsed.name),
            maxCharges: count,
            usedCharges: 0,
            restType: 'short',
          });
        }
      }
    }
  }

  // limited: { "1": ["spell"] }
  if (
    raw.limited &&
    typeof raw.limited === 'object' &&
    !Array.isArray(raw.limited)
  ) {
    const limited = raw.limited as Record<string, unknown>;
    for (const [countStr, spells] of Object.entries(limited)) {
      const count = parseInt(countStr, 10) || 1;
      if (Array.isArray(spells)) {
        for (const parsed of parseSpellList(spells)) {
          individualCharges.push({
            id: nextChargeId(),
            name: titleCase(parsed.name),
            maxCharges: count,
            usedCharges: 0,
            restType: 'long',
          });
        }
      }
    }
  }

  // _flat: ["spell1", "spell2"] (flat array stored under synthetic key by data loader)
  if (Array.isArray(raw._flat)) {
    for (const parsed of parseSpellList(raw._flat)) {
      referenceSpells.push(titleCase(parsed.name));
    }
  }

  return { poolAbilities, individualCharges, referenceSpells, castingAbility };
}

/**
 * Build a ChargePool from parsed attached spells + item-level charge info.
 * Returns undefined if there are no pool abilities or no item charges.
 */
export function buildChargePool(
  parsed: ParsedAttachedSpells,
  itemCharges?: number,
  itemRecharge?: string,
  itemRechargeAmount?: string
): ChargePool | undefined {
  if (parsed.poolAbilities.length === 0) return undefined;

  const hasChargedAbilities = parsed.poolAbilities.some(a => a.cost > 0);
  if (!hasChargedAbilities && !itemCharges) {
    // Only at-will/ritual/other abilities, no pool needed
    return undefined;
  }

  const rechargeMap: Record<string, ChargePool['rechargeType']> = {
    dawn: 'dawn',
    dusk: 'dusk',
    midnight: 'midnight',
    special: 'special',
    restLong: 'long',
    restShort: 'short',
  };

  return {
    maxCharges: itemCharges || 0,
    usedCharges: 0,
    rechargeType: rechargeMap[itemRecharge || ''] || 'dawn',
    rechargeAmount: itemRechargeAmount,
    abilities: parsed.poolAbilities,
  };
}
