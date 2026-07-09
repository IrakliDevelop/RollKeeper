import { useCallback, useEffect, useMemo } from 'react';

import { useEncounterStore, getSortedEntities } from '@/store/encounterStore';
import { useDmInitiativeSync } from '@/hooks/useDmInitiativeSync';
import { buildSharedInitiative } from '@/utils/buildSharedInitiative';

import type { Encounter, EncounterEntity } from '@/types/encounter';

interface UseDmVttInitiativeOptions {
  campaignCode: string;
  dmId: string;
  linkedEncounterIds: string[];
}

interface UseDmVttInitiativeResult {
  encounter: Encounter | null;
  followNote: string | null;
  activeEntity: EncounterEntity | null;
  handleNextTurn: () => void;
  handlePrevTurn: () => void;
}

/**
 * Resolve the encounter the DM VTT studio should follow: the first
 * campaign-linked encounter with combat started (`isActive`), else the
 * single linked encounter (not yet started), else null.
 */
function resolveFollowed(
  linked: Encounter[],
  linkedEncounterIds: string[]
): { followed: Encounter | null; started: Encounter[] } {
  const started = linked.filter(e => e.isActive);
  if (started.length > 0) return { followed: started[0], started };
  if (linkedEncounterIds.length === 1) {
    return { followed: linked[0] ?? null, started };
  }
  return { followed: null, started };
}

/**
 * Drives the DM VTT studio's turn tracker: picks which linked encounter to
 * follow, exposes the currently-active entity, and pushes initiative state
 * to `/shared` (feature `initiative`) on every turn/round/entity change so
 * players get an instant WS-driven update — mirrors the push effect in
 * `EncounterView.tsx` verbatim (guard + dependency list).
 */
export function useDmVttInitiative({
  campaignCode,
  dmId,
  linkedEncounterIds,
}: UseDmVttInitiativeOptions): UseDmVttInitiativeResult {
  const encounters = useEncounterStore(state => state.encounters);
  const combatConfig = useEncounterStore(state => state.combatConfig);
  const nextTurn = useEncounterStore(state => state.nextTurn);
  const prevTurn = useEncounterStore(state => state.prevTurn);

  const { pushInitiative } = useDmInitiativeSync({ campaignCode, dmId });

  const linked = useMemo(
    () => encounters.filter(e => linkedEncounterIds.includes(e.id)),
    [encounters, linkedEncounterIds]
  );

  const { followed: encounter, started } = useMemo(
    () => resolveFollowed(linked, linkedEncounterIds),
    [linked, linkedEncounterIds]
  );

  const followNote = useMemo(
    () =>
      encounter && started.length > 1 ? `Following: ${encounter.name}` : null,
    [encounter, started]
  );

  const activeEntity = useMemo(() => {
    if (!encounter || !encounter.isActive) return null;
    return getSortedEntities(encounter.entities)[encounter.currentTurn] ?? null;
  }, [encounter]);

  // Push initiative state to Redis whenever turn/round/entities change.
  // Only fires for campaign-linked encounters; safe when encounter is null.
  useEffect(() => {
    if (!encounter || !encounter.campaignCode) return;
    pushInitiative(buildSharedInitiative(encounter, combatConfig));
  }, [
    encounter,
    encounter?.isActive,
    encounter?.round,
    encounter?.currentTurn,
    encounter?.entities,
    combatConfig,
    pushInitiative,
  ]);

  const handleNextTurn = useCallback(() => {
    if (!encounter) return;
    nextTurn(encounter.id);
  }, [encounter, nextTurn]);

  const handlePrevTurn = useCallback(() => {
    if (!encounter) return;
    prevTurn(encounter.id);
  }, [encounter, prevTurn]);

  return {
    encounter,
    followNote,
    activeEntity,
    handleNextTurn,
    handlePrevTurn,
  };
}
