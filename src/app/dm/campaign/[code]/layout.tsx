'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';

import { CombatLogArchiveSyncProvider } from '@/components/ui/campaign/CombatLogArchiveSyncControls';
import { EncounterSyncProvider } from '@/components/ui/campaign/EncounterSyncControls';
import { NpcSyncProvider } from '@/components/ui/campaign/NpcSyncControls';
import { ShopSalesSyncProvider } from '@/components/ui/campaign/ShopSalesSyncProvider';

/**
 * Layouts persist across navigations between the child routes, so this is the
 * single mount point of the NPC, encounter, combat log archive, and shop-sales
 * hydration/autosave/reconciliation owners for the whole campaign route
 * group: the campaign dashboard, encounters, locations, and battlemaps all
 * write those stores and now share one owner per family (ruling 7). Each
 * newer owner is nested inside the previous one because one DM action can
 * produce an independent mutation in each family. `ShopSalesSyncProvider`
 * (VTT merchants Slice 3, Task 13a) is the exception to "mutation" — it only
 * ever reconciles server-recorded sales into `npcStore` — but belongs here
 * for the same reason: it must run regardless of which route or NPC dialog
 * the DM is on, not only while a specific NPC's Shop tab happens to be open.
 * All four providers render no DOM, so every route below keeps its existing
 * markup.
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
          <ShopSalesSyncProvider campaignCode={params.code}>
            {children}
          </ShopSalesSyncProvider>
        </CombatLogArchiveSyncProvider>
      </EncounterSyncProvider>
    </NpcSyncProvider>
  );
}
