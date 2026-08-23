'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';

import { NpcSyncProvider } from '@/components/ui/campaign/NpcSyncControls';

/**
 * Layouts persist across navigations between the child routes, so this is the
 * single mount point of the NPC hydration and autosave owner for the whole
 * campaign route group: the campaign dashboard, encounters, locations, and
 * battlemaps all write the NPC store and now share one owner. The provider
 * renders no DOM, so every route below keeps its existing markup.
 */
export default function CampaignRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const params = useParams<{ code: string }>();

  return (
    <NpcSyncProvider campaignCode={params.code}>{children}</NpcSyncProvider>
  );
}
