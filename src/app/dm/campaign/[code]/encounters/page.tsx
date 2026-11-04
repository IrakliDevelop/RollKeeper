'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { CampaignHeader } from '@/components/ui/campaign/CampaignHeader';
import { CombatLogArchiveSyncControls } from '@/components/ui/campaign/CombatLogArchiveSyncControls';
import { EncounterSyncControls } from '@/components/ui/campaign/EncounterSyncControls';
import { EncounterList } from '@/components/ui/encounter/EncounterList';
import { useHydration } from '@/hooks/useHydration';
import { useDmStore } from '@/store/dmStore';

export default function CampaignEncountersPage() {
  const params = useParams();
  const code = params.code as string;
  const hasHydrated = useHydration();
  const { getCampaign } = useDmStore();
  const campaign = getCampaign(code);

  if (!hasHydrated) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center">
        <div className="text-muted">Loading encounters…</div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen">
      <CampaignHeader
        crumb={{
          href: `/dm/campaign/${code}`,
          label: campaign?.name ?? 'Campaign',
        }}
        title={<h1 className="type-heading text-heading">Encounters</h1>}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <EncounterList campaignCode={code} />

        {/*
          The card only reads the route-level EncounterSyncProvider owner,
          mounted in app/dm/campaign/[code]/layout.tsx, so hydration and
          autosave already cover every /dm/campaign/[code]/* route that writes
          the encounter store. It renders nothing while the client flag is off.
        */}
        {campaign && <EncounterSyncControls campaign={campaign} />}

        {/*
          Same shape as the encounter card above it: the combat log archive
          card only reads the route-level CombatLogArchiveSyncProvider owner,
          also mounted in app/dm/campaign/[code]/layout.tsx, and renders
          nothing while the client flag is off. Each card carries its own `mt-6`
          spacing, so they stack without a wrapper.
        */}
        {campaign && <CombatLogArchiveSyncControls campaign={campaign} />}
      </main>
    </div>
  );
}
