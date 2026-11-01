'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoll, evaluate, PollyrollSyntaxError } from 'pollyroll';
import type { SkinRef } from 'pollyroll/render';
import type { RollSummary } from '@/types/dice';
import { toRollSummary } from '@/utils/pollyrollSummary';
import type { DicePreferences } from '@/types/dice';
import { DEFAULT_DICE_SET } from '@/utils/diceSet';
import {
  acquireDiceTray,
  releaseDiceTray,
  getDiceTrayEntry,
  applyDiceAppearance,
  diceTrayCreationKey,
} from './diceTrayRegistry';

export interface UseDiceRollerOptions {
  containerId: string;
  skin?: SkinRef;
  dieScale?: number;
  trayOptions?: DicePreferences;
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
  skin,
  dieScale,
  trayOptions,
  autoClearDelay: initialAutoClearDelay = 10000,
  onRollComplete,
  onError,
  onLog,
}: UseDiceRollerOptions): UseDiceRollerReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rollHistory, setRollHistory] = useState<RollSummary[]>([]);
  const [autoClearDelay, setAutoClearDelay] = useState(initialAutoClearDelay);
  const onLogRef = useRef(onLog);
  const onErrorRef = useRef(onError);
  const onCompleteRef = useRef(onRollComplete);
  const optionsRef = useRef(trayOptions);
  optionsRef.current = trayOptions;
  // Sound has a live setter; the remaining options are read when the tray is created.
  const creationKey = diceTrayCreationKey(trayOptions);
  const skinRef = useRef(skin);
  const dieScaleRef = useRef(dieScale);
  const delayRef = useRef(autoClearDelay);
  const mountedRef = useRef(true);
  const rollVersionRef = useRef(0);

  useEffect(() => {
    onLogRef.current = onLog;
    onErrorRef.current = onError;
    onCompleteRef.current = onRollComplete;
    skinRef.current = skin;
    dieScaleRef.current = dieScale;
    delayRef.current = autoClearDelay;
  });

  const log = useCallback((message: string) => {
    console.log(`[DiceRoller] ${message}`);
    onLogRef.current?.(message);
  }, []);

  const reportError = useCallback(
    (message: string) => {
      log(message);
      onErrorRef.current?.(message);
    },
    [log]
  );

  useEffect(() => {
    mountedRef.current = true;
    let acquired = false;
    let observer: MutationObserver | null = null;

    const attach = () => {
      if (acquired) return true;
      const tray = acquireDiceTray(
        containerId,
        skinRef.current,
        dieScaleRef.current ?? DEFAULT_DICE_SET.dieScale,
        optionsRef.current
      );
      if (!tray) return false;
      acquired = true;
      if (mountedRef.current) {
        setIsInitialized(true);
        setIsRolling(false);
      }
      return true;
    };

    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      mountedRef.current = false;
      observer?.disconnect();
      if (acquired) releaseDiceTray(containerId);
      setIsInitialized(false);
    };
  }, [containerId, creationKey]);

  useEffect(() => {
    if (!isInitialized) return;
    applyDiceAppearance(containerId, skin, dieScale, optionsRef.current);
  }, [
    containerId,
    skin,
    dieScale,
    trayOptions?.sound,
    creationKey,
    isInitialized,
  ]);

  const roll = useCallback(
    async (notation: string): Promise<RollSummary | null> => {
      const entry = getDiceTrayEntry(containerId);
      if (!entry) {
        reportError('Dice tray is not ready yet');
        return null;
      }
      if (entry.rolling) {
        reportError('Already rolling dice, please wait');
        return null;
      }

      const version = ++rollVersionRef.current;
      const playingTray = entry.tray;
      entry.rolling = true;
      if (mountedRef.current) setIsRolling(true);
      if (entry.clearTimer) {
        clearTimeout(entry.clearTimer);
        entry.clearTimer = null;
      }
      log(`Rolling: ${notation}`);

      try {
        const event = createRoll(notation, {
          skin: skinRef.current,
        });
        await playingTray.playRoll(event);
        if (
          getDiceTrayEntry(containerId) !== entry ||
          entry.tray !== playingTray
        ) {
          if (mountedRef.current && version === rollVersionRef.current)
            setIsRolling(false);
          return null;
        }
        const summary = toRollSummary(
          event,
          evaluate(event),
          typeof skinRef.current === 'object'
            ? skinRef.current.labelColor
            : '#1a1a1a'
        );
        if (mountedRef.current) {
          setRollHistory(prev => [...prev, summary]);
          setIsRolling(false);
        }
        log(
          `Total: ${summary.finalTotal} (dice: ${summary.total}, modifier: ${summary.modifier})`
        );
        onCompleteRef.current?.(summary);
        const delay =
          optionsRef.current?.fadeAfterMs !== undefined ? 0 : delayRef.current;
        if (delay > 0 && getDiceTrayEntry(containerId) === entry) {
          entry.clearTimer = setTimeout(() => {
            try {
              entry.tray.clear();
            } catch (clearError) {
              console.warn('Error during auto-clear dice:', clearError);
            }
            entry.clearTimer = null;
          }, delay);
        }
        return summary;
      } catch (error) {
        const detail =
          error instanceof PollyrollSyntaxError || error instanceof Error
            ? error.message
            : String(error);
        reportError(`Error rolling dice: ${detail}`);
        if (mountedRef.current) setIsRolling(false);
        return null;
      } finally {
        if (entry.tray === playingTray) entry.rolling = false;
      }
    },
    [containerId, log, reportError]
  );

  const clearDice = useCallback(() => {
    const entry = getDiceTrayEntry(containerId);
    if (!entry) {
      reportError('Cannot clear dice — tray is not ready');
      return;
    }
    if (entry.clearTimer) {
      clearTimeout(entry.clearTimer);
      entry.clearTimer = null;
    }
    entry.tray.clear();
    log('Dice cleared');
  }, [containerId, log, reportError]);

  const clearHistory = useCallback(() => {
    setRollHistory([]);
    log('Roll history cleared');
  }, [log]);

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
