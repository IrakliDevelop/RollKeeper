'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Swords } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
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
            <div className="flex items-center">
              <Link href={`/dm/campaign/${code}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft size={20} />}
                >
                  {campaign?.name ?? 'Campaign'}
                </Button>
              </Link>
              <div className="ml-6 flex items-center">
                <Swords className="text-accent-red-text mr-3 h-6 w-6" />
                <h1 className="text-heading text-xl font-bold">Encounters</h1>
              </div>
            </div>
            <ThemeToggle showSystemOption />
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
