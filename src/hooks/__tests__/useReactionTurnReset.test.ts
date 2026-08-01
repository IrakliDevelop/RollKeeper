import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useReactionTurnReset } from '@/hooks/useReactionTurnReset';
import { useCharacterStore } from '@/store/characterStore';
import type { SharedInitiativeState } from '@/types/sharedState';

const MY_CHARACTER = 'char-self';
const MY_ENTITY = 'entity-self';
const OTHER_ENTITY = 'entity-goblin';

function makeState(
  overrides: Partial<SharedInitiativeState> = {}
): SharedInitiativeState {
  return {
    encounterId: 'enc-1',
    isActive: true,
    round: 1,
    currentEntityId: OTHER_ENTITY,
    turnOrder: [
      {
        entityId: MY_ENTITY,
        displayName: 'Hero',
        type: 'player',
        playerCharacterId: MY_CHARACTER,
        currentHp: 20,
        maxHp: 20,
      },
      {
        entityId: OTHER_ENTITY,
        displayName: 'Goblin',
        type: 'monster',
        currentHp: 7,
        maxHp: 7,
      },
    ],
    enemyHpMode: 'off',
    enemyConditionsMode: 'off',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function setReactionUsed(used: boolean) {
  const store = useCharacterStore.getState();
  const currentlyUsed = store.character.reaction?.hasUsedReaction ?? false;
  if (currentlyUsed !== used) store.toggleReaction();
}

function reactionUsed(): boolean {
  return (
    useCharacterStore.getState().character.reaction?.hasUsedReaction ?? false
  );
}

function renderReset(initial: SharedInitiativeState | null) {
  const onAutoReset = vi.fn();
  const { rerender } = renderHook(
    ({ state }: { state: SharedInitiativeState | null }) =>
      useReactionTurnReset(state, MY_CHARACTER, onAutoReset),
    { initialProps: { state: initial } }
  );
  return { onAutoReset, rerender };
}

describe('useReactionTurnReset', () => {
  // Tests mutate the real characterStore singleton; beforeEach normalizes
  // the only field this suite reads. If cross-file state bleed ever flakes,
  // adopt the reset pattern used by the existing store test files.
  beforeEach(() => {
    setReactionUsed(true);
  });

  it('resets when the turn passes to my entity', () => {
    const { onAutoReset, rerender } = renderReset(makeState());
    rerender({ state: makeState({ currentEntityId: MY_ENTITY }) });
    expect(reactionUsed()).toBe(false);
    expect(onAutoReset).toHaveBeenCalledTimes(1);
  });

  it('does not reset on mount even when it is already my turn (mid-turn join)', () => {
    const { onAutoReset } = renderReset(
      makeState({ currentEntityId: MY_ENTITY })
    );
    expect(reactionUsed()).toBe(true);
    expect(onAutoReset).not.toHaveBeenCalled();
  });

  it('does not reset on transitions between other entities', () => {
    const { onAutoReset, rerender } = renderReset(makeState());
    rerender({ state: makeState({ currentEntityId: null }) });
    rerender({ state: makeState({ currentEntityId: OTHER_ENTITY }) });
    expect(reactionUsed()).toBe(true);
    expect(onAutoReset).not.toHaveBeenCalled();
  });

  it('fires no callback when the reaction was not used', () => {
    setReactionUsed(false);
    const { onAutoReset, rerender } = renderReset(makeState());
    rerender({ state: makeState({ currentEntityId: MY_ENTITY }) });
    expect(onAutoReset).not.toHaveBeenCalled();
  });

  it('is inert while combat is inactive', () => {
    const { onAutoReset, rerender } = renderReset(makeState());
    rerender({
      state: makeState({ currentEntityId: MY_ENTITY, isActive: false }),
    });
    expect(reactionUsed()).toBe(true);
    expect(onAutoReset).not.toHaveBeenCalled();
  });

  it('solo combat: resets when the round advances while I stay current', () => {
    // Regression (spec issue 1): only entity in turnOrder — currentEntityId
    // never changes, but the round counter marks each new turn of mine.
    const solo = (round: number) =>
      makeState({
        round,
        currentEntityId: MY_ENTITY,
        turnOrder: [
          {
            entityId: MY_ENTITY,
            displayName: 'Hero',
            type: 'player',
            playerCharacterId: MY_CHARACTER,
            currentHp: 20,
            maxHp: 20,
          },
        ],
      });
    const { onAutoReset, rerender } = renderReset(solo(1));
    rerender({ state: solo(2) });
    expect(reactionUsed()).toBe(false);
    expect(onAutoReset).toHaveBeenCalledTimes(1);
  });

  it('combat stop then restart at the same round and entity does not reset', () => {
    // Regression (spec issue 2): DM briefly ending + restarting the same
    // combat mid-round must not refresh a spent reaction.
    const myTurn = makeState({ currentEntityId: MY_ENTITY, round: 2 });
    const { onAutoReset, rerender } = renderReset(makeState({ round: 2 }));
    rerender({ state: myTurn }); // my turn starts — resets once
    expect(onAutoReset).toHaveBeenCalledTimes(1);
    setReactionUsed(true); // spend it during my turn
    rerender({
      state: makeState({
        currentEntityId: MY_ENTITY,
        round: 2,
        isActive: false,
      }),
    });
    rerender({ state: myTurn }); // restart, same round + entity
    expect(reactionUsed()).toBe(true);
    expect(onAutoReset).toHaveBeenCalledTimes(1);
  });

  it('combat restart at a different round resets', () => {
    const { onAutoReset, rerender } = renderReset(
      makeState({ currentEntityId: MY_ENTITY, round: 1 })
    );
    rerender({
      state: makeState({
        currentEntityId: MY_ENTITY,
        round: 1,
        isActive: false,
      }),
    });
    rerender({ state: makeState({ currentEntityId: MY_ENTITY, round: 3 }) });
    expect(reactionUsed()).toBe(false);
    expect(onAutoReset).toHaveBeenCalledTimes(1);
  });

  it('is inert with a null state or when my character has no entity', () => {
    const { onAutoReset, rerender } = renderReset(null);
    rerender({ state: makeState({ currentEntityId: MY_ENTITY }) });
    // First non-null observation — treated as mount, no reset.
    expect(onAutoReset).not.toHaveBeenCalled();

    const noMe = makeState({
      currentEntityId: OTHER_ENTITY,
      turnOrder: [
        {
          entityId: OTHER_ENTITY,
          displayName: 'Goblin',
          type: 'monster',
          currentHp: 7,
          maxHp: 7,
        },
      ],
    });
    const second = renderReset(noMe);
    second.rerender({ state: { ...noMe, currentEntityId: null } });
    expect(second.onAutoReset).not.toHaveBeenCalled();
  });
});
