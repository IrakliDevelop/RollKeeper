'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';

import { EncounterSyncProvider } from '@/components/ui/campaign/EncounterSyncControls';
import { NpcSyncProvider } from '@/components/ui/campaign/NpcSyncControls';

/**
 * Layouts persist across navigations between the child routes, so this is the
 * single mount point of the NPC and encounter hydration and autosave owners for
 * the whole campaign route group: the campaign dashboard, encounters,
 * locations, and battlemaps all write those stores and now share one owner per
 * family (ruling 7). The encounter owner is nested inside the NPC owner because
 * one DM action can produce an independent mutation in each family. Both
 * providers render no DOM, so every route below keeps its existing markup.
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
        {children}
      </EncounterSyncProvider>
    </NpcSyncProvider>
  );
}
