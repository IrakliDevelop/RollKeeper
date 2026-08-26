import { useCallback } from 'react';
import type {
  InitiativeRollRequest,
  SharedInitiativeState,
} from '@/types/sharedState';

interface UseDmInitiativeSyncOptions {
  campaignCode: string;
  dmId: string;
}

export function useDmInitiativeSync({
  campaignCode,
  dmId,
}: UseDmInitiativeSyncOptions) {
  const pushInitiative = useCallback(
    async (state: SharedInitiativeState) => {
      try {
        await fetch(`/api/campaign/${campaignCode}/shared`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature: 'initiative', data: state, dmId }),
        });
      } catch (err) {
        console.warn('Failed to sync initiative state:', err);
      }
    },
    [campaignCode, dmId]
  );

  const pushInitiativeRequest = useCallback(
    async (data: InitiativeRollRequest | null) => {
      try {
        await fetch(`/api/campaign/${campaignCode}/shared`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature: 'initiativeRequest', data, dmId }),
        });
      } catch (err) {
        console.warn('Failed to push initiative request:', err);
      }
    },
    [campaignCode, dmId]
  );

  return { pushInitiative, pushInitiativeRequest };
}
