'use client';

import { useEffect, useRef } from 'react';

import { useCharacterStore } from '@/store/characterStore';
import type { SharedInitiativeState } from '@/types/sharedState';

interface TurnObservation {
  currentEntityId: string | null;
  round: number;
}

/**
 * Auto-resets a spent reaction when the player's turn starts in the
 * DM-published live initiative (RAW: reactions refresh at the start of your
 * turn). "Turn started" means either the turn passed to my entity, or — for
 * solo combats where `currentEntityId` never changes — the round advanced
 * while my entity stayed current.
 *
 * The previous observation is kept (not cleared) across inactive/null
 * states, so a DM stop + restart of the same combat mid-round does not
 * refresh a reaction spent that turn. No reset fires on the first observed
 * state (mid-turn join). `resetReaction` is idempotent and CANONICAL, so a
 * duplicate fire from a second tab converges harmlessly.
 */
export function useReactionTurnReset(
  state: SharedInitiativeState | null,
  characterId: string,
  onAutoReset: () => void
): void {
  const prevRef = useRef<TurnObservation | null>(null);

  useEffect(() => {
    if (!state || !state.isActive) return;

    const prev = prevRef.current;
    const current: TurnObservation = {
      currentEntityId: state.currentEntityId ?? null,
      round: state.round,
    };
    prevRef.current = current;

    if (prev === null) return; // first observation — never reset on join

    const myEntityId = state.turnOrder.find(
      entry => entry.playerCharacterId === characterId
    )?.entityId;
    if (!myEntityId || current.currentEntityId !== myEntityId) return;

    const turnPassedToMe = prev.currentEntityId !== myEntityId;
    const newRoundSameEntity =
      prev.currentEntityId === myEntityId && prev.round !== current.round;
    if (!turnPassedToMe && !newRoundSameEntity) return;

    const store = useCharacterStore.getState();
    if (store.character.reaction?.hasUsedReaction) {
      store.resetReaction();
      onAutoReset();
    }
  }, [state, characterId, onAutoReset]);
}
