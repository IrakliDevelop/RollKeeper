'use client';

import { useCallback, useEffect, useState } from 'react';

import type { TokenInfoMode } from './TokenDecorationLayer.types';

/** Cycle order for the toolbar eye button. */
const CYCLE_ORDER: readonly TokenInfoMode[] = ['full', 'compact', 'off'];

/**
 * Maps a raw localStorage value to a mode. Handles the pre-mode boolean
 * strings ('true'/'false') from before this feature, passes through already-
 * valid mode strings, and falls back to the default for anything else
 * (missing key, corrupt value).
 */
function migrateStoredValue(raw: string | null): TokenInfoMode {
  if (raw === 'true') return 'full';
  if (raw === 'false') return 'off';
  if (raw === 'full' || raw === 'compact' || raw === 'off') return raw;
  return 'full';
}

/** Persisted show/hide/compact mode for token decorations. Defaults 'full'. */
export function useTokenInfoMode(
  storageKey: string
): [TokenInfoMode, () => void] {
  const [mode, setMode] = useState<TokenInfoMode>('full');

  useEffect(() => {
    try {
      setMode(migrateStoredValue(localStorage.getItem(storageKey)));
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, mode);
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey, mode]);

  const cycle = useCallback(() => {
    setMode(
      current =>
        CYCLE_ORDER[(CYCLE_ORDER.indexOf(current) + 1) % CYCLE_ORDER.length]
    );
  }, []);

  return [mode, cycle];
}
