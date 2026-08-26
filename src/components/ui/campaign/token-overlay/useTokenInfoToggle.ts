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
  return 'compact';
}

/**
 * Persisted show/hide/compact mode for token decorations. Defaults 'compact'.
 * Returns null until the persisted value has been read (post-mount) so
 * consumers can render nothing instead of flashing the default for one
 * frame when the stored mode is 'off'. (A lazy useState initializer reading
 * localStorage would hydration-mismatch — this component tree is SSR'd.)
 */
export function useTokenInfoMode(
  storageKey: string
): [TokenInfoMode | null, () => void] {
  const [mode, setMode] = useState<TokenInfoMode | null>(null);

  useEffect(() => {
    try {
      setMode(migrateStoredValue(localStorage.getItem(storageKey)));
    } catch {
      setMode('compact');
    }
  }, [storageKey]);

  useEffect(() => {
    if (mode === null) return;
    try {
      localStorage.setItem(storageKey, mode);
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey, mode]);

  const cycle = useCallback(() => {
    setMode(current =>
      current === null
        ? current
        : CYCLE_ORDER[(CYCLE_ORDER.indexOf(current) + 1) % CYCLE_ORDER.length]
    );
  }, []);

  return [mode, cycle];
}
