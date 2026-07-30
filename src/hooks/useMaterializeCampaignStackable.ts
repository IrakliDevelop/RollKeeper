'use client';

import { useEffect } from 'react';
import { campaignStackableToMaterialize } from '@/utils/inspiration';

interface UseMaterializeCampaignStackableParams {
  inCampaign: boolean;
  sharedStateLoaded: boolean;
  campaignStackable: boolean | undefined;
  currentStackable: boolean;
  setStackableInspiration: (value: boolean) => void;
}

/**
 * In a campaign the DM's house rule governs stacking; solo characters keep their
 * own preference. Once resolved it lives on the character itself, so the store
 * clamp and the sheet UI only ever read that one flag.
 *
 * The inequality guard keeps this from writing (and bumping the revision) on
 * every render once the character already matches the campaign.
 */
export function useMaterializeCampaignStackable({
  inCampaign,
  sharedStateLoaded,
  campaignStackable,
  currentStackable,
  setStackableInspiration,
}: UseMaterializeCampaignStackableParams): void {
  const stackableToMaterialize = campaignStackableToMaterialize(
    inCampaign,
    sharedStateLoaded,
    campaignStackable
  );

  useEffect(() => {
    if (stackableToMaterialize === null) return;
    if (currentStackable !== stackableToMaterialize) {
      setStackableInspiration(stackableToMaterialize);
    }
  }, [stackableToMaterialize, currentStackable, setStackableInspiration]);
}
