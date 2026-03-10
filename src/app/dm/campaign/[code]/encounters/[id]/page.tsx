'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Swords } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
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
              <Swords className="text-accent-red-text mr-3 h-6 w-6" />
              <h1 className="text-heading text-xl font-bold">
                Encounter Tracker
              </h1>
            </div>
            <ThemeToggle showSystemOption />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <EncounterView encounterId={encounterId} campaignCode={campaignCode} />
      </main>
    </div>
  );
}
