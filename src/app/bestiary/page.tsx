import { Suspense } from 'react';
import { loadAllBestiary } from '@/utils/bestiaryDataLoader';
import { BookOpen, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import BestiaryCompendiumClient from '@/components/bestiary/BestiaryCompendiumClient';

// Loading fallback component
function BestiaryCompendiumLoadingFallback() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex items-center justify-center space-x-3 text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="text-xl font-medium">Loading Bestiary...</span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-slate-600/50 bg-slate-800/50 p-6"
          >
            <div className="mb-4 h-6 rounded-md bg-slate-700/50"></div>
            <div className="mb-3 h-4 rounded-md bg-slate-700/50"></div>
            <div className="mb-3 h-4 w-3/4 rounded-md bg-slate-700/50"></div>
            <div className="h-20 rounded-md bg-slate-700/50"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function BestiaryPage() {
  const bestiary = await loadAllBestiary();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/30 via-transparent to-emerald-900/20"></div>
        <div className="relative z-10 px-6 py-8">
          <div className="mx-auto max-w-7xl">
            {/* Back Button */}
            <div className="mb-6">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600/60 bg-slate-800/70 px-4 py-2 text-slate-300 shadow-lg backdrop-blur-sm transition-all hover:border-slate-500/60 hover:bg-slate-700/70 hover:text-white"
              >
                <ArrowLeft size={16} />
                <span>Back to Character Sheet</span>
              </Link>
            </div>

            <div className="text-center">
              {/* Decorative elements */}
              <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-gradient-to-r from-red-500/5 to-emerald-500/5 blur-3xl"></div>

              <div className="relative">
                <div className="mb-6 flex items-center justify-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-red-500/30 bg-gradient-to-br from-red-600/20 to-red-800/20 shadow-lg backdrop-blur-sm">
                    <BookOpen className="h-10 w-10 text-red-400" />
                  </div>
                  <h1 className="text-5xl font-bold tracking-wide text-white md:text-7xl">
                    Bestiary
                  </h1>
                </div>
                <p className="mx-auto max-w-3xl text-xl leading-relaxed text-slate-200">
                  Discover the creatures that roam the realms of D&D. Explore{' '}
                  <span className="font-semibold text-emerald-400">
                    {bestiary.length} monsters
                  </span>{' '}
                  with their unique abilities, legendary powers, and ancient
                  lore.
                </p>

                {/* Decorative accent lines */}
                <div className="mt-6 flex items-center justify-center gap-4">
                  <div className="h-px w-20 bg-gradient-to-r from-transparent to-red-500/50"></div>
                  <div className="h-2 w-2 animate-pulse rounded-full bg-red-400"></div>
                  <div className="h-px w-20 bg-gradient-to-l from-transparent to-emerald-500/50"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<BestiaryCompendiumLoadingFallback />}>
            <BestiaryCompendiumClient initialMonsters={bestiary} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
