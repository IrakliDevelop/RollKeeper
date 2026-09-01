import { useCombatLogStore } from '@/store/combatLogStore';
import { useEncounterStore } from '@/store/encounterStore';

import { parseWalkingSpeed, walkFeetFromParsed } from './movementSpeed';
import { MOVEMENT_DEFAULT_WALK_FEET } from './movementTool';

import type { MovementLogPayload } from './movementCommit';
import type { MovementResolution } from './movementTool';
import type { MovableTokenIdentity } from './tokenIdentity';

/**
 * DM-side speed + name lookup over the battle map's linked encounters.
 * Combatants resolve their stat-block walking speed; player tokens moved
 * by the DM resolve name only (DM-side character speed needs campaign-sync
 * plumbing — deferred; default applies). Live getState reads: a captured
 * snapshot would go stale across encounter edits.
 */
export function resolveDmMovement(
  identity: MovableTokenIdentity,
  linkedEncounterIds: readonly string[]
): MovementResolution | null {
  const encounters = useEncounterStore
    .getState()
    .encounters.filter(e => linkedEncounterIds.includes(e.id));
  for (const enc of encounters) {
    for (const entity of enc.entities) {
      if (
        entity.id === identity.key ||
        entity.playerCharacterId === identity.key
      ) {
        return {
          name: entity.name,
          walkFeet:
            identity.kind === 'combatant'
              ? walkFeetFromParsed(
                  parseWalkingSpeed(entity.monsterStatBlock?.speed)
                )
              : MOVEMENT_DEFAULT_WALK_FEET,
          entityId: entity.id,
        };
      }
    }
  }
  return null;
}

/**
 * Writes a movement event into the ACTIVE combat-log archive, but only when
 * that archive belongs to the moved entity's OWN containing encounter —
 * not merely to some encounter linked to the map. An entity that lives in
 * linked encounter B must not log into an archive active for linked
 * encounter A with A's round/turn; that would misattribute the event. The
 * search is scoped to `linkedEncounterIds` (a map's own encounters only).
 * No active archive, no containing encounter among the linked ones, or an
 * archive for a different encounter than the entity's own, is a silent
 * no-op (matching logEvent's own Ruling 7 posture).
 */
export function logDmMovement(
  linkedEncounterIds: readonly string[],
  payload: MovementLogPayload
): void {
  const logStore = useCombatLogStore.getState();
  const archiveId = logStore.activeArchiveId;
  if (!archiveId) return;
  const archive = logStore.encounters[archiveId];
  if (!archive) return;

  const linkedEncounters = useEncounterStore
    .getState()
    .encounters.filter(e => linkedEncounterIds.includes(e.id));
  const ownEncounter = linkedEncounters.find(e =>
    e.entities.some(entity => entity.id === payload.entityId)
  );
  if (!ownEncounter || archive.encounterId !== ownEncounter.id) return;

  logStore.logEvent(archiveId, {
    type: 'movement',
    encounterId: archive.encounterId,
    round: ownEncounter.round ?? 0,
    turn: ownEncounter.currentTurn ?? 0,
    ...payload,
  });
}
