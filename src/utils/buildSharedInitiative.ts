import { getSortedEntities } from '@/store/encounterStore';
import {
  DEFAULT_COMBAT_CONFIG,
  type CombatConfig,
  type Encounter,
  type EncounterEntity,
} from '@/types/encounter';
import { hpPercent, hpStateLabel } from '@/utils/hpState';
import type {
  SharedInitiativeState,
  SharedTurnEntry,
} from '@/types/sharedState';

function playerFacingName(entity: EncounterEntity): string {
  // Players are never masked.
  if (entity.type === 'player') return entity.name;
  // A custom alias wins over everything else.
  const alias = entity.playerAlias?.trim();
  if (alias) return alias;
  // Otherwise a hidden entity shows a generic label.
  if (entity.isHidden) return 'Enemy';
  return entity.name;
}

function toEntry(
  entity: EncounterEntity,
  config: CombatConfig
): SharedTurnEntry {
  const isPlayer = entity.type === 'player';
  const displayName = playerFacingName(entity);

  const entry: SharedTurnEntry = {
    entityId: entity.id,
    displayName,
    type: entity.type as SharedTurnEntry['type'],
  };

  // Players always expose identity + exact HP (their own sheet is authoritative).
  if (isPlayer) {
    entry.playerCharacterId = entity.playerCharacterId;
    entry.currentHp = entity.currentHp;
    entry.maxHp = entity.maxHp;
    return entry;
  }

  // Non-players (enemies/NPCs) expose only what the DM's combat config allows.
  switch (config.enemyHpDisplay) {
    case 'label':
      entry.hpState = hpStateLabel(
        entity.currentHp,
        entity.maxHp,
        config.hpStateBands
      );
      break;
    case 'bar':
    case 'percent':
      entry.hpPercent = Math.round(hpPercent(entity.currentHp, entity.maxHp));
      break;
    case 'exact':
      entry.currentHp = entity.currentHp;
      entry.maxHp = entity.maxHp;
      break;
    case 'off':
    default:
      break;
  }

  return entry;
}

/**
 * Derive the player-facing initiative payload from a DM encounter.
 * Pure — safe to unit test and to call on every turn change.
 */
export function buildSharedInitiative(
  encounter: Encounter,
  config: CombatConfig = DEFAULT_COMBAT_CONFIG
): SharedInitiativeState {
  const sorted = getSortedEntities(encounter.entities);
  const current = sorted[encounter.currentTurn];

  return {
    encounterId: encounter.id,
    isActive: encounter.isActive,
    round: encounter.round,
    currentEntityId: current ? current.id : null,
    turnOrder: sorted.map(e => toEntry(e, config)),
    enemyHpMode: config.enemyHpDisplay,
    updatedAt: new Date().toISOString(),
  };
}
