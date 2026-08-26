'use client';

import { useMemo } from 'react';

import { useBattleMapStore } from '@/store/battleMapStore';
import { useEncounterStore } from '@/store/encounterStore';

import type { EncounterEntity } from '@/types/encounter';

interface UseDmVttRosterOptions {
  campaignCode: string;
  battleMapId: string;
}

/**
 * Battle-map record + linked-encounter roster join (brief items 1-2): every
 * linked encounter's entities, flattened for the roster tray. Sibling
 * extraction from `DmVttScreen.hooks.ts` to stay under the 150-line file cap.
 */
export function useDmVttRoster({
  campaignCode,
  battleMapId,
}: UseDmVttRosterOptions) {
  const battleMap = useBattleMapStore(s =>
    s.getBattleMap(campaignCode, battleMapId)
  );
  const linkedEncounterIds = useMemo(
    () => battleMap?.linkedEncounterIds ?? [],
    [battleMap]
  );

  const encounters = useEncounterStore(s => s.encounters);
  const linkedEntities = useMemo<EncounterEntity[]>(
    () =>
      encounters
        .filter(e => linkedEncounterIds.includes(e.id))
        .flatMap(e => e.entities),
    [encounters, linkedEncounterIds]
  );

  return { battleMap, linkedEncounterIds, linkedEntities };
}
