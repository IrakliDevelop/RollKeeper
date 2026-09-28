import { useCallback, useState } from 'react';
import { useTableControl } from '@/hooks/useTableControl';
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
  const control = useTableControl(campaignCode, dmId);
  const { status, error, publish } = control;
  const [publicationError, setPublicationError] = useState<string | null>(null);
  const [legacyBroadcasting, setLegacyBroadcasting] = useState(false);
  const pushLegacy = useCallback(
    async (feature: string, data: unknown) => {
      try {
        const response = await fetch(`/api/campaign/${campaignCode}/shared`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-rollkeeper-csrf': '1',
          },
          body: JSON.stringify({ feature, data, dmId }),
        });
        if (!response.ok)
          throw new Error(`Publication failed (${response.status})`);
        setPublicationError(null);
        if (feature === 'initiative') {
          setLegacyBroadcasting((data as SharedInitiativeState).isActive);
        }
      } catch (failure) {
        setLegacyBroadcasting(false);
        setPublicationError(
          failure instanceof Error ? failure.message : 'Publication failed'
        );
        throw failure;
      }
    },
    [campaignCode, dmId]
  );

  const pushInitiative = useCallback(
    async (state: SharedInitiativeState) => {
      if (status === 'legacy') return pushLegacy('initiative', state);
      if (status === 'checking') throw new Error('Checking table capability');
      if (status !== 'controlling' && status !== 'broadcasting')
        throw new Error(error ?? 'Not broadcasting');
      return publish(
        state.isActive ? 'publishInitiative' : 'endInitiative',
        state.isActive
          ? { initiative: state, runId: state.encounterId }
          : undefined
      );
    },
    [status, error, publish, pushLegacy]
  );

  const pushInitiativeRequest = useCallback(
    async (data: InitiativeRollRequest | null) => {
      if (status === 'legacy') return pushLegacy('initiativeRequest', data);
      if (status === 'checking') throw new Error('Checking table capability');
      if (status !== 'controlling' && status !== 'broadcasting')
        throw new Error(error ?? 'Not broadcasting');
      return publish('publishInitiativeRequest', { request: data });
    },
    [status, error, publish, pushLegacy]
  );

  return {
    pushInitiative,
    pushInitiativeRequest,
    control,
    publicationError,
    legacyBroadcasting,
  };
}
