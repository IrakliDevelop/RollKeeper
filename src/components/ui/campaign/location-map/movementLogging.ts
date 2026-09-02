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
 * Writes a movement event into the moved entity's OWN containing encounter's
 * OPEN combat-log archive — resolved PER ENCOUNTER, never through the
 * store's global `activeArchiveId` pointer. That pointer names at most one
 * encounter's archive device-wide; with two concurrently active encounters
 * (combat started on X, then on Y, before X was ended) it names Y, and
 * ending Y correctly clears it — but X is still in combat with an open
 * archive of its own, and X's movements must keep logging into it. The
 * search is scoped to `linkedEncounterIds` (a map's own encounters only).
 * No containing encounter among the linked ones, or no OPEN archive
 * (`endedAt` unset) for that encounter, is a silent no-op (matching
 * logEvent's own Ruling 7 posture).
 */
export function logDmMovement(
  linkedEncounterIds: readonly string[],
  payload: MovementLogPayload
): void {
  const linkedEncounters = useEncounterStore
    .getState()
    .encounters.filter(e => linkedEncounterIds.includes(e.id));
  const ownEncounter = linkedEncounters.find(e =>
    e.entities.some(entity => entity.id === payload.entityId)
  );
  if (!ownEncounter) return;

  const logStore = useCombatLogStore.getState();
  const archive = logStore.getLatestArchiveForEncounter(ownEncounter.id);
  if (!archive || archive.endedAt) return;

  logStore.logEvent(archive.archiveId, {
    type: 'movement',
    encounterId: archive.encounterId,
    round: ownEncounter.round ?? 0,
    turn: ownEncounter.currentTurn ?? 0,
    ...payload,
  });
}
