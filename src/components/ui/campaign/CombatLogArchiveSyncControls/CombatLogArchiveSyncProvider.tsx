'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { useDmStore } from '@/store/dmStore';

import {
  useCombatLogArchiveSyncController,
  type CombatLogArchiveSyncController,
} from './CombatLogArchiveSyncControls.hooks';

const CombatLogArchiveSyncContext =
  createContext<CombatLogArchiveSyncController | null>(null);

/**
 * Mounts the single combat log archive sync owner for one campaign route group
 * (ruling 7). Layouts persist across child navigations, so the hydration and
 * autosave effects keep covering every `/dm/campaign/[code]/*` route that
 * writes the combat log store — the encounter tracker, encounter detail, and
 * the combat log viewer — even while the DM is deep in live combat. The
 * provider renders no DOM.
 */
export function CombatLogArchiveSyncProvider({
  campaignCode,
  children,
}: {
  campaignCode: string;
  children: ReactNode;
}) {
  const campaign = useDmStore(state =>
    state.campaigns.find(item => item.code === campaignCode)
  );
  const controller = useCombatLogArchiveSyncController(campaign);

  return (
    <CombatLogArchiveSyncContext.Provider value={controller}>
      {children}
    </CombatLogArchiveSyncContext.Provider>
  );
}

export function useCombatLogArchiveSyncContext(): CombatLogArchiveSyncController | null {
  return useContext(CombatLogArchiveSyncContext);
}
