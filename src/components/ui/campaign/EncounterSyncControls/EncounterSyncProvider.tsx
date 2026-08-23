'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { useDmStore } from '@/store/dmStore';

import {
  useEncounterSyncController,
  type EncounterSyncController,
} from './EncounterSyncControls.hooks';

const EncounterSyncContext = createContext<EncounterSyncController | null>(
  null
);

/**
 * Mounts the single encounter sync owner for one campaign route group (ruling
 * 7). Layouts persist across child navigations, so the hydration and autosave
 * effects keep covering every `/dm/campaign/[code]/*` route that writes the
 * encounter store — encounters, encounter detail, battlemaps, and locations —
 * even while the DM is deep in live combat. The provider renders no DOM.
 */
export function EncounterSyncProvider({
  campaignCode,
  children,
}: {
  campaignCode: string;
  children: ReactNode;
}) {
  const campaign = useDmStore(state =>
    state.campaigns.find(item => item.code === campaignCode)
  );
  const controller = useEncounterSyncController(campaign);

  return (
    <EncounterSyncContext.Provider value={controller}>
      {children}
    </EncounterSyncContext.Provider>
  );
}

export function useEncounterSyncContext(): EncounterSyncController | null {
  return useContext(EncounterSyncContext);
}
