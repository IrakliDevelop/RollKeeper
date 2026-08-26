'use client';

import { useMemo } from 'react';

import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';
import type { CharacterState } from '@/types/character';
import type { SharedInitiativeState } from '@/types/sharedState';
import { overlayLiveHp, type LiveHp } from '@/utils/sharedInitiativeOverlay';

/**
 * Overlays live player HP (own characterStore + poke-fresh party-hp data)
 * onto a DM-published initiative snapshot, so player-row HP does not wait on
 * the DM tab's poll -> merge -> push round trip. Shared between the player
 * VTT screen and the character sheet's InitiativePanel — see
 * `overlayLiveHp` for the privacy invariant (only player rows with a
 * `playerCharacterId` are touched).
 */
export function useLiveInitiative(
  sharedInitiative: SharedInitiativeState | null,
  character: CharacterState | null | undefined,
  characterId: string,
  partyMembers: PartyMemberHP[]
): SharedInitiativeState | null {
  const liveHp = useMemo(() => {
    const map: Record<string, LiveHp> = {};
    for (const member of partyMembers) {
      if (!member.hitPoints) continue;
      map[member.characterId] = {
        current: member.hitPoints.current,
        max: member.hitPoints.max,
      };
    }
    if (character && character.id === characterId) {
      map[characterId] = {
        current: character.hitPoints.current,
        max: character.hitPoints.max,
      };
    }
    return map;
  }, [partyMembers, character, characterId]);

  return useMemo(
    () => overlayLiveHp(sharedInitiative, liveHp),
    [sharedInitiative, liveHp]
  );
}
