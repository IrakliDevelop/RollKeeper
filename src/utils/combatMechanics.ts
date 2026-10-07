import type { EncounterCondition, EncounterEntity } from '@/types/encounter';

/**
 * Store-free combat mechanics shared by the legacy encounter store and Table
 * scene runs. Behavior is byte-identical to the original inline store code;
 * the store delegates here so both runtimes follow one rule set.
 */

/** Sort entities by initiative (descending), with lair actions losing ties. */
export function getSortedEntities(
  entities: EncounterEntity[]
): EncounterEntity[] {
  // First pass: standard initiative sort
  const sorted = [...entities].sort((a, b) => {
    const aInit = a.initiative ?? -Infinity;
    const bInit = b.initiative ?? -Infinity;
    if (aInit !== bInit) return bInit - aInit;
    // Lair actions lose ties
    if (a.type === 'lair' && b.type !== 'lair') return 1;
    if (b.type === 'lair' && a.type !== 'lair') return -1;
    // Summons sort after their owner (non-summons first at same initiative)
    if (a.summonOwnerId && !b.summonOwnerId) return 1;
    if (b.summonOwnerId && !a.summonOwnerId) return -1;
    // Ties: preserve current order
    return 0;
  });

  // Second pass: move summons directly after their owner
  const result: EncounterEntity[] = [];
  const summonsByOwner = new Map<string, EncounterEntity[]>();

  // Group summons by owner
  for (const e of sorted) {
    if (e.summonOwnerId) {
      const list = summonsByOwner.get(e.summonOwnerId) ?? [];
      list.push(e);
      summonsByOwner.set(e.summonOwnerId, list);
    }
  }

  // Build result: each non-summon entity followed by its summons
  for (const e of sorted) {
    if (e.summonOwnerId) continue; // handled below their owner
    result.push(e);
    const ownerKey = e.playerCharacterId;
    if (ownerKey && summonsByOwner.has(ownerKey)) {
      result.push(...summonsByOwner.get(ownerKey)!);
      summonsByOwner.delete(ownerKey);
    }
  }

  // Append any orphaned summons (owner not in encounter)
  for (const summons of summonsByOwner.values()) {
    result.push(...summons);
  }

  return result;
}

/** Turn-start condition tick: timed rounds count down and expire at 0. */
export function decrementConditionRounds<
  T extends Pick<EncounterCondition, 'rounds'>,
>(conditions: T[]): T[] {
  return conditions
    .map(c =>
      typeof c.rounds === 'number' ? { ...c, rounds: c.rounds - 1 } : c
    )
    .filter(c => !(typeof c.rounds === 'number' && c.rounds <= 0));
}

/** Reaction, legendary-action and condition-round resets for the incoming turn. */
export function applyTurnStart(
  entities: EncounterEntity[],
  incomingTurn: number
): EncounterEntity[] {
  return entities.map((e, i) => {
    if (i !== incomingTurn) return e;
    let next = e;
    if (next.hasUsedReaction) next = { ...next, hasUsedReaction: false };
    if (next.legendaryActions && next.legendaryActions.usedActions > 0) {
      next = {
        ...next,
        legendaryActions: { ...next.legendaryActions, usedActions: 0 },
      };
    }
    if (next.conditions.some(c => typeof c.rounds === 'number')) {
      next = {
        ...next,
        conditions: decrementConditionRounds(next.conditions),
      };
    }
    return next;
  });
}

/** Temp HP absorbs damage first; current HP never drops below 0. */
export function absorbDamage(
  currentHp: number,
  tempHp: number,
  amount: number
): { currentHp: number; tempHp: number; remaining: number } {
  let remaining = amount;
  let temp = tempHp;

  // Temp HP absorbs damage first
  if (temp > 0) {
    if (remaining <= temp) {
      temp -= remaining;
      remaining = 0;
    } else {
      remaining -= temp;
      temp = 0;
    }
  }

  return {
    currentHp: Math.max(0, currentHp - remaining),
    tempHp: temp,
    remaining,
  };
}

/** Healing is capped at max HP. */
export function healHp(currentHp: number, maxHp: number, amount: number) {
  return Math.min(maxHp, currentHp + amount);
}

/** Set-HP clamp to [0, max]. */
export function clampHp(current: number, max: number): number {
  return Math.max(0, Math.min(max, current));
}

/** Temp HP doesn't stack — take the higher value. */
export function stackTempHp(existing: number, amount: number): number {
  return Math.max(existing, amount);
}
