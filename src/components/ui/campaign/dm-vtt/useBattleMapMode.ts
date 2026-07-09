'use client';

import { useEffect, useState } from 'react';

import type { BattleMap } from '@/types/battlemap';

export type BattleMapPageMode = 'setup' | 'play';

function modeStorageKey(battleMapId: string): string {
  return `rollkeeper-battlemap-mode:${battleMapId}`;
}

/**
 * Setup|Play mode for the battle map page, persisted per-map to
 * localStorage. Resolves once, after hydration: stored value if present,
 * else 'play' when the map already has a linked encounter, otherwise
 * 'setup'. Returns `null` while unresolved so the page can show a loading
 * state instead of flashing the wrong mode.
 */
export function useBattleMapMode(
  battleMapId: string,
  hasHydrated: boolean,
  getBattleMap: () => BattleMap | undefined
) {
  const [mode, setMode] = useState<BattleMapPageMode | null>(null);

  useEffect(() => {
    if (!hasHydrated || mode !== null) return;
    const stored = window.localStorage.getItem(modeStorageKey(battleMapId));
    if (stored === 'setup' || stored === 'play') {
      setMode(stored);
      return;
    }
    const hasLinkedEncounter =
      (getBattleMap()?.linkedEncounterIds.length ?? 0) > 0;
    setMode(hasLinkedEncounter ? 'play' : 'setup');
  }, [hasHydrated, mode, battleMapId, getBattleMap]);

  const handleModeChange = (next: BattleMapPageMode) => {
    setMode(next);
    window.localStorage.setItem(modeStorageKey(battleMapId), next);
  };

  return { mode, handleModeChange };
}
