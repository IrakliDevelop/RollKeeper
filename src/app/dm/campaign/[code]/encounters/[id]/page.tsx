'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { CampaignHeader } from '@/components/ui/campaign/CampaignHeader';
import { EncounterView } from '@/components/ui/encounter/EncounterView';
import { useHydration } from '@/hooks/useHydration';

export default function EncounterPage() {
  const params = useParams();
  const encounterId = params.id as string;
  const campaignCode = params.code as string;
  const hasHydrated = useHydration();

  if (!hasHydrated) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center">
        <div className="text-muted">Loading encounter…</div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen">
      <CampaignHeader
        title={<h1 className="type-heading text-heading">Encounter</h1>}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <EncounterView encounterId={encounterId} campaignCode={campaignCode} />
      </main>
    </div>
  );
}
