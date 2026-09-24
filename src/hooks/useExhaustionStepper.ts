import { useCallback } from 'react';

import { useCharacterStore } from '@/store/characterStore';
import { getExhaustionByVariant } from '@/utils/conditionsDiseasesLoader';
import type { ActiveCondition } from '@/types/character';

const EMPTY_ACTIVE_CONDITIONS: ActiveCondition[] = [];

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

  const existing = activeConditions.find(
    c => c.name.toLowerCase() === 'exhaustion'
  );
  const level = existing?.count ?? 0;

  const increment = useCallback(async () => {
    const current = useCharacterStore
      .getState()
      .character.conditionsAndDiseases.activeConditions.find(
        c => c.name.toLowerCase() === 'exhaustion'
      );
    if (current) {
      updateCondition(current.id, { count: Math.min(current.count + 1, 6) });
      return;
    }
    const currentVariant =
      useCharacterStore.getState().character.conditionsAndDiseases
        .exhaustionVariant;
    const data = await getExhaustionByVariant(currentVariant);
    if (data) {
      addCondition(data.name, data.source, data.description, 1);
    }
  }, [addCondition, updateCondition]);

  const decrement = useCallback(() => {
    const current = useCharacterStore
      .getState()
      .character.conditionsAndDiseases.activeConditions.find(
        c => c.name.toLowerCase() === 'exhaustion'
      );
    if (!current) return;
    if (current.count - 1 <= 0) {
      removeCondition(current.id);
    } else {
      updateCondition(current.id, { count: current.count - 1 });
    }
  }, [removeCondition, updateCondition]);

  return { level, variant, increment, decrement };
}
