import { useCallback } from 'react';
import { useTableControl } from '@/hooks/useTableControl';
import type {
  InitiativeRollRequest,
  SharedInitiativeState,
} from '@/types/sharedState';

interface UseDmInitiativeSyncOptions {
  campaignCode: string;
  dmId: string;
}

/**
 * DM initiative publication. Table protocol v1 is the only path: initiative
 * and roll requests publish through the Table control session (the legacy
 * shared-state writer answers 426).
 */
export function useDmInitiativeSync({
  campaignCode,
  dmId,
}: UseDmInitiativeSyncOptions) {
  const control = useTableControl(campaignCode, dmId);
  const { status, error, publish } = control;

  const pushInitiative = useCallback(
    async (state: SharedInitiativeState) => {
      if (status === 'checking') throw new Error('Checking live control');
      if (status !== 'controlling' && status !== 'broadcasting')
        throw new Error(error ?? 'Not broadcasting');
      return publish(
        state.isActive ? 'publishInitiative' : 'endInitiative',
        state.isActive
          ? { initiative: state, runId: state.encounterId }
          : undefined
      );
    },
    [status, error, publish]
  );

  const pushInitiativeRequest = useCallback(
    async (data: InitiativeRollRequest | null) => {
      if (status === 'checking') throw new Error('Checking live control');
      if (status !== 'controlling' && status !== 'broadcasting')
        throw new Error(error ?? 'Not broadcasting');
      return publish('publishInitiativeRequest', { request: data });
    },
    [status, error, publish]
  );

  return {
    pushInitiative,
    pushInitiativeRequest,
    control,
  };
}
