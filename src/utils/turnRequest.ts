import { getSortedEntities } from '@/store/encounterStore';
import type { Encounter } from '@/types/encounter';
import type { TurnEndRequest } from '@/types/sharedState';

/**
 * A player's end-turn request is only honored when it still refers to the live
 * state: same encounter, same round, and it is genuinely that entity's turn.
 * This prevents double-advances from polling lag or stale taps.
 */
export function shouldApplyTurnRequest(
  encounter: Encounter,
  request: TurnEndRequest
): boolean {
  if (!encounter.isActive) return false;
  if (encounter.id !== request.encounterId) return false;
  if (encounter.round !== request.round) return false;
  const current = getSortedEntities(encounter.entities)[encounter.currentTurn];
  return !!current && current.id === request.entityId;
}
