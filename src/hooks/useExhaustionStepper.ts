import { useCallback, useRef } from 'react';

import { useCharacterStore } from '@/store/characterStore';
import { getExhaustionByVariant } from '@/utils/conditionsDiseasesLoader';
import type { ActiveCondition, CharacterState } from '@/types/character';

const EMPTY_ACTIVE_CONDITIONS: ActiveCondition[] = [];

function findExhaustion(
  character: CharacterState
): ActiveCondition | undefined {
  return (character.conditionsAndDiseases?.activeConditions ?? []).find(
    c => c.name.toLowerCase() === 'exhaustion'
  );
}

export interface UseExhaustionStepperResult {
  level: number;
  variant: '2014' | '2024';
  increment: () => Promise<void>;
  decrement: () => void;
}

/**
 * Shared exhaustion add/step/remove logic for the desktop
 * `ConditionsDiseasesManager` and the map sheet drawer's `EffectsTab`.
 * Reads the current exhaustion condition from the live store (rather than a
 * stale closure) inside each handler so rapid clicks stay correct.
 */
export function useExhaustionStepper(): UseExhaustionStepperResult {
  const activeConditions =
    useCharacterStore(
      s => s.character.conditionsAndDiseases?.activeConditions
    ) ?? EMPTY_ACTIVE_CONDITIONS;
  const variant =
    useCharacterStore(
      s => s.character.conditionsAndDiseases?.exhaustionVariant
    ) ?? '2024';
  const addCondition = useCharacterStore(s => s.addCondition);
  const updateCondition = useCharacterStore(s => s.updateCondition);
  const removeCondition = useCharacterStore(s => s.removeCondition);
  // Guards the async first add: a second tap while the exhaustion data is
  // still loading would otherwise add a duplicate condition.
  const addingRef = useRef(false);

  const existing = activeConditions.find(
    c => c.name.toLowerCase() === 'exhaustion'
  );
  const level = existing?.count ?? 0;

  const increment = useCallback(async () => {
    if (addingRef.current) return;
    const state = useCharacterStore.getState();
    const current = findExhaustion(state.character);
    if (current) {
      updateCondition(current.id, { count: Math.min(current.count + 1, 6) });
      return;
    }
    addingRef.current = true;
    try {
      const data = await getExhaustionByVariant(
        state.character.conditionsAndDiseases?.exhaustionVariant ?? '2024'
      );
      // Another writer may have added exhaustion while we were loading.
      const added = findExhaustion(useCharacterStore.getState().character);
      if (added) {
        updateCondition(added.id, { count: Math.min(added.count + 1, 6) });
      } else if (data) {
        addCondition(data.name, data.source, data.description, 1);
      }
    } finally {
      addingRef.current = false;
    }
  }, [addCondition, updateCondition]);

  const decrement = useCallback(() => {
    const current = findExhaustion(useCharacterStore.getState().character);
    if (!current) return;
    if (current.count - 1 <= 0) {
      removeCondition(current.id);
    } else {
      updateCondition(current.id, { count: current.count - 1 });
    }
  }, [removeCondition, updateCondition]);

  return { level, variant, increment, decrement };
}
