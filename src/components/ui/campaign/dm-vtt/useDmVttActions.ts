'use client';

import { useMemo } from 'react';

import { buildEntityActions } from '@/components/ui/encounter/combat-screen/buildEntityActions';
import { useDmEffectsSync } from '@/hooks/useDmEffectsSync';
import { useEncounterStore } from '@/store/encounterStore';

import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';
import type { Encounter } from '@/types/encounter';

interface UseDmVttActionsOptions {
  campaignCode: string;
  dmId: string;
  encounter: Encounter | null;
}

/**
 * `EntityActions` for the followed encounter (brief item 4) — mirrors
 * `EncounterView.tsx:177-249`, with `syncPlayerEffects` from
 * `useDmEffectsSync`. Recomputes whenever the followed encounter changes.
 * Sibling extraction from `DmVttScreen.hooks.ts` to stay under the
 * 150-line file cap.
 */
export function useDmVttActions({
  campaignCode,
  dmId,
  encounter,
}: UseDmVttActionsOptions): EntityActions | null {
  const { syncPlayerEffects } = useDmEffectsSync({ campaignCode, dmId });

  return useMemo<EntityActions | null>(
    () =>
      encounter
        ? buildEntityActions({
            encounterId: encounter.id,
            encounter,
            store: useEncounterStore.getState(),
            syncPlayerEffects,
          })
        : null,
    [encounter, syncPlayerEffects]
  );
}
