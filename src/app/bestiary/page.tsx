import { Suspense } from 'react';
import { loadAllBestiary } from '@/utils/bestiaryDataLoader';
import { Skull, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import BestiaryCompendiumClient from '@/components/bestiary/BestiaryCompendiumClient';

function BestiaryCompendiumLoadingFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-muted flex items-center justify-center gap-3">
        <Loader2 className="text-accent-red-text h-8 w-8 animate-spin" />
        <span className="text-xl font-medium">Loading Bestiary...</span>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="border-divider bg-surface-raised animate-pulse rounded-lg border p-6"
          >
            <div className="bg-surface-secondary mb-4 h-6 rounded-md" />
            <div className="bg-surface-secondary mb-3 h-4 rounded-md" />
            <div className="bg-surface-secondary mb-3 h-4 w-3/4 rounded-md" />
            <div className="bg-surface-secondary h-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function BestiaryPage() {
  const bestiary = await loadAllBestiary();

  return (
    <div className="bg-surface min-h-screen">
      <div className="bg-surface-raised border-divider border-b">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mb-4">
            <Link
              href="/resources"
              className="text-muted hover:text-heading inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back to Resources</span>
            </Link>
          </div>
          <div className="text-center">
            <div className="mb-3 flex items-center justify-center gap-3">
              <Skull className="text-accent-red-text h-10 w-10 sm:h-12 sm:w-12" />
              <h1 className="text-heading text-3xl font-bold sm:text-4xl md:text-5xl">
                Bestiary
              </h1>
            </div>
            <p className="text-body mx-auto max-w-2xl text-base sm:text-lg">
              Discover {bestiary.length} creatures from across the realms of
              D&D, with stat blocks, abilities, and legendary powers.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<BestiaryCompendiumLoadingFallback />}>
            <BestiaryCompendiumClient initialMonsters={bestiary} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
