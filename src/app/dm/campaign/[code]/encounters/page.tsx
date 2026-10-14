'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Swords } from 'lucide-react';
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
        <div className="text-muted animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen">
      <header className="border-divider bg-surface-secondary border-b shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* C3: fits 360 px; the title truncates, actions never shrink. */}
            <div className="flex min-w-0 items-center">
              <Button
                asChild
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeft size={20} />}
                className="shrink-0"
              >
                <Link
                  href={`/dm/campaign/${code}`}
                  aria-label={`Back to ${campaign?.name ?? 'Campaign'}`}
                  title={campaign?.name}
                >
                  <span className="hidden max-w-48 truncate sm:inline lg:max-w-none">
                    {campaign?.name ?? 'Campaign'}
                  </span>
                </Link>
              </Button>
              <div className="ml-2 flex min-w-0 items-center sm:ml-6">
                <Swords className="text-accent-red-text mr-2 h-6 w-6 shrink-0 sm:mr-3" />
                <h1 className="text-heading truncate text-xl font-bold">
                  Encounters
                </h1>
              </div>
            </div>
            <div className="shrink-0">
              <HeaderTrailing showSystemOption />
            </div>
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
