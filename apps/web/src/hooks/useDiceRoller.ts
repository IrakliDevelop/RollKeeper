import { useState, useEffect, useCallback, useRef } from 'react';
// @ts-expect-error - DiceBox is not typed
import DiceBox from '@3d-dice/dice-box';
import { DiceRollResults, RollSummary } from '@/types/dice';
import { calculateRollSummary, autoClearDice } from '@/utils/diceUtils';

interface DiceBoxInstance {
  clear?: () => void;
  roll?: (notation: string) => Promise<DiceRollResults>;
  init?: () => Promise<void>;
}

export interface UseDiceRollerOptions {
  containerId: string;
  theme?: string;
  themeColor?: string;
  scale?: number;
  autoClearDelay?: number;
  onRollComplete?: (summary: RollSummary) => void;
  onError?: (error: string) => void;
  onLog?: (message: string) => void;
}

export interface UseDiceRollerReturn {
  isInitialized: boolean;
  isRolling: boolean;
  rollHistory: RollSummary[];
  roll: (notation: string) => Promise<RollSummary | null>;
  clearDice: () => void;
  clearHistory: () => void;
  setAutoClearDelay: (delay: number) => void;
  autoClearDelay: number;
}

export function useDiceRoller({
  containerId,
  theme = 'diceOfRolling',
  themeColor = '#feea03',
  scale = 6,
  autoClearDelay: initialAutoClearDelay = 10000,
  onRollComplete,
  onError,
  onLog,
}: UseDiceRollerOptions): UseDiceRollerReturn {
  const [diceBox, setDiceBox] = useState<DiceBoxInstance | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rollHistory, setRollHistory] = useState<RollSummary[]>([]);
  const [autoClearDelay, setAutoClearDelay] = useState(initialAutoClearDelay);
  const [isMounted, setIsMounted] = useState(false);

  // Use ref to avoid recreating log function on every render
  const onLogRef = useRef(onLog);
  const onErrorRef = useRef(onError);

  // Update refs when props change
  useEffect(() => {
    onLogRef.current = onLog;
    onErrorRef.current = onError;
  });

  // Stable log function
  const log = useCallback((message: string) => {
    console.log(`[DiceRoller] ${message}`);
    if (onLogRef.current) {
      onLogRef.current(message);
    }
  }, []);

  // Track mounting state
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Initialize dice box
  useEffect(() => {
    if (!isInitialized && isMounted) {
      const initializeDiceBox = () => {
        // Check if DOM element exists
        const containerElement = document.querySelector(`#${containerId}`);
        if (!containerElement) {
          log(
            `Container element #${containerId} not found, waiting for DOM...`
          );
          return false;
        }

        const rect = (containerElement as HTMLElement).getBoundingClientRect();
        log(
          `Container element #${containerId} found at ${Math.round(rect.left)},${Math.round(rect.top)} size ${Math.round(rect.width)}x${Math.round(rect.height)} - creating DiceBox...`
        );

        const selector = `#${containerId}`;
        const box = new DiceBox(selector, {
          assetPath: '/assets/',
          scale,
          theme,
          themeColor,
          offscreen: false,
          throwForce: 5,
          gravity: 1,
          mass: 1,
          spinForce: 6,
        });

        setDiceBox(box);
        log('DiceBox instance created');

        box
          .init()
          .then(() => {
            log('DiceBox initialized successfully');
            setIsInitialized(true);
          })
          .catch((error: unknown) => {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            const message = `Failed to initialize DiceBox: ${errorMessage}`;
            log(message);
            if (onErrorRef.current) {
              onErrorRef.current(message);
            }
          });

        return true;
      };

      // Try to initialize immediately
      if (!initializeDiceBox()) {
        // If DOM not ready, wait a bit and try again (only once)
        const timer = setTimeout(() => {
          initializeDiceBox();
        }, 100);

        return () => clearTimeout(timer);
      }
    }
  }, [containerId, scale, theme, themeColor, isInitialized, isMounted, log]);

  // Roll dice function
  const roll = useCallback(
    async (notation: string): Promise<RollSummary | null> => {
      if (!diceBox || !isInitialized) {
        const message = 'DiceBox not ready yet';
        log(message);
        if (onErrorRef.current) {
          onErrorRef.current(message);
        }
        return null;
      }

      if (isRolling) {
        const message = 'Already rolling dice, please wait';
        log(message);
        if (onErrorRef.current) {
          onErrorRef.current(message);
        }
        return null;
      }

      setIsRolling(true);
      log(`Rolling: ${notation}`);

      try {
        if (!diceBox.roll) {
          throw new Error('DiceBox roll method not available');
        }
        const results: DiceRollResults = await diceBox.roll(notation);
        log(`Roll completed: ${notation}`);

        // Calculate summary
        const summary = calculateRollSummary(results, notation);
        setRollHistory(prev => [...prev, summary]);

        log(
          `Total: ${summary.finalTotal} (dice: ${summary.total}, modifier: ${summary.modifier})`
        );

        // Call completion callback
        if (onRollComplete) {
          onRollComplete(summary);
        }

        // Auto-clear if enabled
        if (autoClearDelay > 0) {
          autoClearDice(diceBox, autoClearDelay, () => {
            log(`Dice auto-cleared after ${autoClearDelay}ms`);
          });
        }

        setIsRolling(false);
        return summary;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const message = `Error rolling dice: ${errorMessage}`;
        log(message);
        if (onErrorRef.current) {
          onErrorRef.current(message);
        }
        setIsRolling(false);
        return null;
      }
    },
    [diceBox, isInitialized, isRolling, autoClearDelay, onRollComplete, log]
  );

  // Clear dice function
  const clearDice = useCallback(() => {
    if (diceBox && typeof diceBox.clear === 'function' && isInitialized) {
      log('Clearing dice from screen');
      try {
        diceBox.clear();
        log('Dice cleared successfully');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const message = `Error clearing dice: ${errorMessage}`;
        log(message);
        if (onErrorRef.current) {
          onErrorRef.current(message);
        }
      }
    } else {
      const message =
        'Cannot clear dice - not initialized or clear method unavailable';
      log(message);
      if (onErrorRef.current) {
        onErrorRef.current(message);
      }
    }
  }, [diceBox, isInitialized, log]);

  // Clear history function
  const clearHistory = useCallback(() => {
    setRollHistory([]);
    log('Roll history cleared');
  }, [log]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (diceBox && typeof diceBox.clear === 'function') {
        try {
          console.log('[DiceRoller] Cleaning up DiceBox on unmount');
          diceBox.clear();
        } catch (error) {
          console.warn('Error during component unmount cleanup:', error);
        }
      }
    };
  }, [diceBox]);

  return {
    isInitialized,
    isRolling,
    rollHistory,
    roll,
    clearDice,
    clearHistory,
    setAutoClearDelay,
    autoClearDelay,
  };
}
