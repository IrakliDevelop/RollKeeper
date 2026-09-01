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
        };
      }
    }
  }
  return null;
}

/**
 * Writes a movement event into the ACTIVE combat-log archive, but only
 * when that archive belongs to one of this map's linked encounters —
 * events must not leak into an unrelated encounter's log. No active
 * archive, or an unrelated one, is a silent no-op (matching logEvent's own
 * Ruling 7 posture). This is the first production logEvent call site.
 */
export function logDmMovement(
  linkedEncounterIds: readonly string[],
  payload: MovementLogPayload
): void {
  const logStore = useCombatLogStore.getState();
  const archiveId = logStore.activeArchiveId;
  if (!archiveId) return;
  const archive = logStore.encounters[archiveId];
  if (!archive || !linkedEncounterIds.includes(archive.encounterId)) return;
  const encounter = useEncounterStore
    .getState()
    .encounters.find(e => e.id === archive.encounterId);
  logStore.logEvent(archiveId, {
    type: 'movement',
    encounterId: archive.encounterId,
    round: encounter?.round ?? 0,
    turn: encounter?.currentTurn ?? 0,
    ...payload,
  });
}
