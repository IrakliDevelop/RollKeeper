'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';

import { CombatLogArchiveSyncProvider } from '@/components/ui/campaign/CombatLogArchiveSyncControls';
import { EncounterSyncProvider } from '@/components/ui/campaign/EncounterSyncControls';
import { NpcSyncProvider } from '@/components/ui/campaign/NpcSyncControls';

/**
 * Layouts persist across navigations between the child routes, so this is the
 * single mount point of the NPC, encounter, and combat log archive hydration
 * and autosave owners for the whole campaign route group: the campaign
 * dashboard, encounters, locations, and battlemaps all write those stores and
 * now share one owner per family (ruling 7). Each newer owner is nested inside
 * the previous one because one DM action can produce an independent mutation
 * in each family. All three providers render no DOM, so every route below keeps
 * its existing markup.
 */
export default function CampaignRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const params = useParams<{ code: string }>();

  return (
    <NpcSyncProvider campaignCode={params.code}>
      <EncounterSyncProvider campaignCode={params.code}>
        <CombatLogArchiveSyncProvider campaignCode={params.code}>
          {children}
        </CombatLogArchiveSyncProvider>
      </EncounterSyncProvider>
    </NpcSyncProvider>
  );
}
