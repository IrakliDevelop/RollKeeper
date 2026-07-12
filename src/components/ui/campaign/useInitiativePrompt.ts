import { useCallback, useState } from 'react';

import {
  getSubmittedRequestId,
  markSubmitted,
  shouldShowInitiativePrompt,
} from './initiativePrompt.utils';

import type {
  InitiativeRollRequest,
  SharedCampaignState,
} from '@/types/sharedState';

export interface UseInitiativePromptArgs {
  campaignCode: string | null | undefined;
  characterId: string;
  sharedState: SharedCampaignState | null;
}

export interface UseInitiativePromptResult {
  request: InitiativeRollRequest | null;
  showPrompt: boolean;
  handleSubmit: (value: number) => Promise<boolean>;
  dismiss: () => void;
}

/**
 * Shared "roll for initiative" prompt wiring, used by both the character
 * sheet and the player VTT so the two thin call sites stay in sync.
 */
export function useInitiativePrompt({
  campaignCode,
  characterId,
  sharedState,
}: UseInitiativePromptArgs): UseInitiativePromptResult {
  const request = sharedState?.initiativeRequest ?? null;
  const [promptDismissed, setPromptDismissed] = useState<string | null>(null); // requestId dismissed this session
  const [submittedForPrompt, setSubmittedForPrompt] = useState<string | null>(
    null
  ); // re-render trigger after markSubmitted

  const showPrompt =
    !!campaignCode &&
    !!request &&
    promptDismissed !== request.requestId &&
    submittedForPrompt !== request.requestId &&
    shouldShowInitiativePrompt({
      request,
      initiativeActive: sharedState?.initiative?.isActive ?? false,
      submittedRequestId: getSubmittedRequestId(characterId),
    });

  const handleSubmit = useCallback(
    async (value: number): Promise<boolean> => {
      if (!request || !campaignCode) return false;
      try {
        const res = await fetch(
          `/api/campaign/${campaignCode}/initiative-submission`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestId: request.requestId,
              playerId: characterId,
              value,
            }),
          }
        );
        if (!res.ok) return false;
        markSubmitted(characterId, request.requestId);
        setSubmittedForPrompt(request.requestId);
        return true;
      } catch {
        return false;
      }
    },
    [request, campaignCode, characterId]
  );

  const dismiss = useCallback(() => {
    if (request) setPromptDismissed(request.requestId);
  }, [request]);

  return { request, showPrompt, handleSubmit, dismiss };
}
