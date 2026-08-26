'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { useDmStore } from '@/store/dmStore';

import {
  useNpcSyncController,
  type NpcSyncController,
} from './NpcSyncControls.hooks';

const NpcSyncContext = createContext<NpcSyncController | null>(null);

/**
 * Mounts the single NPC sync owner for one campaign route group. Layouts
 * persist across child navigations, so the hydration and autosave effects keep
 * covering every `/dm/campaign/[code]/*` route that writes the NPC store even
 * while the DM is on an encounter, location, or battlemap page. The provider
 * renders no DOM of its own.
 */
export function NpcSyncProvider({
  campaignCode,
  children,
}: {
  campaignCode: string;
  children: ReactNode;
}) {
  const campaign = useDmStore(state =>
    state.campaigns.find(item => item.code === campaignCode)
  );
  const controller = useNpcSyncController(campaign);

  return (
    <NpcSyncContext.Provider value={controller}>
      {children}
    </NpcSyncContext.Provider>
  );
}

export function useNpcSyncContext(): NpcSyncController | null {
  return useContext(NpcSyncContext);
}
