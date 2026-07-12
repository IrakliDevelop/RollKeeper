import type { Encounter } from '@/types/encounter';
import type {
  InitiativeRollRequest,
  InitiativeSubmission,
} from '@/types/sharedState';

export interface SubmissionResolution {
  apply: Array<{ entityId: string; playerId: string; value: number }>;
  discard: string[];
}

/**
 * Decide what to do with polled initiative submissions. Applies only when the
 * submission matches the ACTIVE request, the encounter is the one the request
 * targeted, combat has not started, and a player entity matches by
 * playerCharacterId. Everything else is discarded (deleted without applying) —
 * delete-after-apply upstream makes the whole loop exactly-once.
 */
export function resolveSubmissionTargets(
  submissions: Record<string, InitiativeSubmission>,
  request: Pick<InitiativeRollRequest, 'requestId' | 'encounterId'>,
  encounter: Encounter
): SubmissionResolution {
  const result: SubmissionResolution = { apply: [], discard: [] };
  const blocked = encounter.isActive || encounter.id !== request.encounterId;
  for (const [playerId, submission] of Object.entries(submissions)) {
    if (blocked || submission.requestId !== request.requestId) {
      result.discard.push(playerId);
      continue;
    }
    const target = encounter.entities.find(
      e => e.type === 'player' && e.playerCharacterId === playerId
    );
    if (!target) {
      result.discard.push(playerId);
      continue;
    }
    result.apply.push({
      entityId: target.id,
      playerId,
      value: submission.value,
    });
  }
  return result;
}
