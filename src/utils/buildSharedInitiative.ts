import { getSortedEntities } from '@/store/encounterStore';
import type { Encounter, EncounterEntity } from '@/types/encounter';
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

function toEntry(entity: EncounterEntity): SharedTurnEntry {
  const isPlayer = entity.type === 'player';
  const displayName = playerFacingName(entity);

  const entry: SharedTurnEntry = {
    entityId: entity.id,
    displayName,
    type: entity.type as SharedTurnEntry['type'],
  };

  // HP + identity are exposed for player entities only.
  if (isPlayer) {
    entry.playerCharacterId = entity.playerCharacterId;
    entry.currentHp = entity.currentHp;
    entry.maxHp = entity.maxHp;
  }

  return entry;
}

/**
 * Derive the player-facing initiative payload from a DM encounter.
 * Pure — safe to unit test and to call on every turn change.
 */
export function buildSharedInitiative(
  encounter: Encounter
): SharedInitiativeState {
  const sorted = getSortedEntities(encounter.entities);
  const current = sorted[encounter.currentTurn];

  return {
    encounterId: encounter.id,
    isActive: encounter.isActive,
    round: encounter.round,
    currentEntityId: current ? current.id : null,
    turnOrder: sorted.map(toEntry),
    updatedAt: new Date().toISOString(),
  };
}
