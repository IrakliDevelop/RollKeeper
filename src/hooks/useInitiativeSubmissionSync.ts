import { useEffect } from 'react';

import { useEncounterStore } from '@/store/encounterStore';
import { resolveSubmissionTargets } from '@/utils/initiativeSubmission';

import type { Encounter } from '@/types/encounter';
import type { InitiativeSubmission } from '@/types/sharedState';

const POLL_MS = 5000;

interface Options {
  campaignCode: string;
  encounter: Encounter | undefined;
}

/**
 * While an initiative request is pending and combat has NOT started, polls the
 * submissions record, applies matching totals via setInitiative, and deletes
 * each consumed submission (exactly-once). Stale/unmatched submissions are
 * deleted without applying.
 */
export function useInitiativeSubmissionSync({
  campaignCode,
  encounter,
}: Options) {
  const encounterId = encounter?.id;
  const requestId = encounter?.pendingInitiativeRequest?.requestId;
  const isActive = !!encounter?.isActive;

  useEffect(() => {
    if (!campaignCode || !encounterId || !requestId || isActive) return;
    let cancelled = false;

    const deleteSubmission = (playerId: string) =>
      fetch(
        `/api/campaign/${campaignCode}/initiative-submission?playerId=${encodeURIComponent(playerId)}`,
        { method: 'DELETE' }
      ).catch(() => {});

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/campaign/${campaignCode}/initiative-submission`
        );
        if (!res.ok || cancelled) return;
        const { submissions } = (await res.json()) as {
          submissions: Record<string, InitiativeSubmission>;
        };
        if (!submissions || Object.keys(submissions).length === 0) return;

        // Re-read the freshest encounter at apply time.
        const live = useEncounterStore.getState().getEncounter(encounterId);
        if (!live) return;
        const { apply, discard } = resolveSubmissionTargets(
          submissions,
          { requestId, encounterId },
          live
        );
        for (const a of apply) {
          useEncounterStore
            .getState()
            .setInitiative(encounterId, a.entityId, a.value);
          await deleteSubmission(a.playerId);
        }
        for (const playerId of discard) {
          await deleteSubmission(playerId);
        }
      } catch {
        // best-effort; next tick retries
      }
    };

    const id = setInterval(poll, POLL_MS);
    poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [campaignCode, encounterId, requestId, isActive]);
}
