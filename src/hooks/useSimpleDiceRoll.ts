import { useCallback } from 'react';
import type { SkinRef } from 'pollyroll';
import { useDiceRoller } from './useDiceRoller';
import { RollSummary } from '@/types/dice';

export interface UseSimpleDiceRollOptions {
  containerId?: string;
  skin?: SkinRef;
  dieScale?: number;
  autoClearDelay?: number;
  onRollComplete?: (summary: RollSummary) => void;
  onError?: (error: string) => void;
}

export interface UseSimpleDiceRollReturn {
  isReady: boolean;
  isRolling: boolean;
  roll: (notation: string) => Promise<RollSummary | null>;
  clearDice: () => void;
}

/**
 * Simple hook for dice rolling without UI components
 * Perfect for integrating into existing character sheet components
 */
export function useSimpleDiceRoll({
  containerId = 'main-dice-container',
  skin,
  dieScale,
  autoClearDelay = 1000,
  onRollComplete,
  onError,
}: UseSimpleDiceRollOptions = {}): UseSimpleDiceRollReturn {
  const { isInitialized, isRolling, roll, clearDice } = useDiceRoller({
    containerId,
    skin,
    dieScale,
    autoClearDelay,
    onRollComplete,
    onError,
  });

  const rollDice = useCallback(
    async (notation: string): Promise<RollSummary | null> => {
      return await roll(notation);
    },
    [roll]
  );

  return {
    isReady: isInitialized,
    isRolling,
    roll: rollDice,
    clearDice,
  };
}
