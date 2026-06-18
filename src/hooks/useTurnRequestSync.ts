import { useEffect, useRef } from 'react';
import { useEncounterStore } from '@/store/encounterStore';
import { shouldApplyTurnRequest } from '@/utils/turnRequest';
import type { TurnEndRequest } from '@/types/sharedState';

const POLL_MS = 4000;

interface Options {
  campaignCode: string;
  encounterId: string | undefined;
  isActive: boolean;
  onApplied?: (req: TurnEndRequest) => void;
}

/**
 * While combat is active, polls the turn-request key. When a request validates
 * against the live encounter, advances the turn (DM stays authoritative) and
 * clears the request. Stale/invalid requests are cleared without advancing.
 */
export function useTurnRequestSync({
  campaignCode,
  encounterId,
  isActive,
  onApplied,
}: Options) {
  const onAppliedRef = useRef(onApplied);
  onAppliedRef.current = onApplied;

  useEffect(() => {
    if (!campaignCode || !encounterId || !isActive) return;

    let cancelled = false;

    const clearRequest = () =>
      fetch(`/api/campaign/${campaignCode}/turn-request`, {
        method: 'DELETE',
      }).catch(() => {});

    const poll = async () => {
      try {
        const res = await fetch(`/api/campaign/${campaignCode}/turn-request`);
        if (!res.ok) return;
        const { request } = (await res.json()) as {
          request: TurnEndRequest | null;
        };
        if (!request || cancelled) return;

        // Re-read the freshest encounter at apply time.
        const encounter = useEncounterStore
          .getState()
          .getEncounter(encounterId);
        if (encounter && shouldApplyTurnRequest(encounter, request)) {
          useEncounterStore.getState().nextTurn(encounterId);
          onAppliedRef.current?.(request);
        }
        // Whether applied or stale, consume the request.
        await clearRequest();
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
  }, [campaignCode, encounterId, isActive]);
}
