'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoll, evaluate, PollyrollSyntaxError } from 'pollyroll';
import { createDiceTray } from 'pollyroll/render';
import type { DiceTray, SkinRef } from 'pollyroll/render';
import type { RollSummary } from '@/types/dice';
import { DEFAULT_DICE_SET } from '@/utils/diceSet';
import { toRollSummary } from '@/utils/pollyrollSummary';

interface TrayEntry {
  tray: DiceTray;
  users: number;
  skinKey: string;
  dieScale: number;
  rolling: boolean;
  clearTimer: ReturnType<typeof setTimeout> | null;
}

const trays = new Map<string, TrayEntry>();

function acquireTray(
  containerId: string,
  skin: SkinRef | undefined,
  dieScale: number
): DiceTray | null {
  const existing = trays.get(containerId);
  if (existing) {
    existing.users += 1;
    return existing.tray;
  }
  const element = document.getElementById(containerId);
  if (!element) return null;
  const tray = createDiceTray(element, { skin, dieScale });
  trays.set(containerId, {
    tray,
    users: 1,
    skinKey: JSON.stringify(skin ?? null),
    dieScale,
    rolling: false,
    clearTimer: null,
  });
  return tray;
}

function releaseTray(containerId: string): void {
  const entry = trays.get(containerId);
  if (!entry) return;
  entry.users -= 1;
  if (entry.users > 0) return;
  if (entry.clearTimer) clearTimeout(entry.clearTimer);
  entry.tray.dispose();
  trays.delete(containerId);
}

function applyAppearance(
  containerId: string,
  skin: SkinRef | undefined,
  dieScale: number | undefined
): void {
  const entry = trays.get(containerId);
  if (!entry) return;
  if (skin !== undefined) {
    const key = JSON.stringify(skin);
    if (key !== entry.skinKey) {
      entry.skinKey = key;
      entry.tray.setSkin(skin);
    }
  }
  if (dieScale !== undefined && dieScale !== entry.dieScale) {
    entry.dieScale = dieScale;
    entry.tray.setDieScale(dieScale);
  }
}

export interface UseDiceRollerOptions {
  containerId: string;
  skin?: SkinRef;
  dieScale?: number;
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
  const skinRef = useRef(skin);
  const dieScaleRef = useRef(dieScale);
  const delayRef = useRef(autoClearDelay);
  const mountedRef = useRef(true);

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
      const tray = acquireTray(
        containerId,
        skinRef.current,
        dieScaleRef.current ?? DEFAULT_DICE_SET.dieScale
      );
      if (!tray) return false;
      acquired = true;
      if (mountedRef.current) setIsInitialized(true);
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
      if (acquired) releaseTray(containerId);
      setIsInitialized(false);
    };
  }, [containerId]);

  useEffect(() => {
    if (!isInitialized) return;
    applyAppearance(containerId, skin, dieScale);
  }, [containerId, skin, dieScale, isInitialized]);

  const roll = useCallback(
    async (notation: string): Promise<RollSummary | null> => {
      const entry = trays.get(containerId);
      if (!entry) {
        reportError('Dice tray is not ready yet');
        return null;
      }
      if (entry.rolling) {
        reportError('Already rolling dice, please wait');
        return null;
      }

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
        await entry.tray.playRoll(event);
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
        const delay = delayRef.current;
        if (delay > 0 && trays.get(containerId) === entry) {
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
        entry.rolling = false;
      }
    },
    [containerId, log, reportError]
  );

  const clearDice = useCallback(() => {
    const entry = trays.get(containerId);
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
