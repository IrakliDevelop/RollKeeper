'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { HeaderTrailing } from '@/components/auth/HeaderTrailing';
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
      <header className="border-divider bg-surface-secondary border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <Button
                asChild
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeft size={20} />}
              >
                <Link href={`/dm/campaign/${code}`}>
                  {campaign?.name ?? 'Campaign'}
                </Link>
              </Button>
              <h1 className="type-heading text-heading">Encounters</h1>
            </div>
            <HeaderTrailing showSystemOption />
          </div>
        </div>
      </header>

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
