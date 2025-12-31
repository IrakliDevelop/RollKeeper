import { Suspense } from 'react';
import { loadAllClasses } from '@/utils/classDataLoader';
import ClassCompendiumClient from '@/components/classes/ClassCompendiumClient';
import { Shield, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Loading fallback component
function ClassCompendiumLoadingFallback() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex items-center justify-center space-x-3 text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="text-xl font-medium">Loading Class Compendium...</span>
      </div>

      {/* Loading skeleton */}
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

export default async function ClassesPage() {
  const classes = await loadAllClasses();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-black opacity-40"></div>
        <div className="relative z-10 px-6 py-8">
          <div className="mx-auto max-w-7xl">
            {/* Back Button */}
            <div className="mb-6">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600/50 bg-slate-800/60 px-4 py-2 text-slate-300 backdrop-blur-sm transition-all hover:border-slate-500/50 hover:bg-slate-700/60 hover:text-white"
              >
                <ArrowLeft size={16} />
                <span>Back to Character Sheet</span>
              </Link>
            </div>

            <div className="text-center">
              <div className="mb-4 flex items-center justify-center gap-3">
                <Shield className="h-12 w-12 text-emerald-400" />
                <h1 className="text-4xl font-bold text-white md:text-6xl">
                  Class Compendium
                </h1>
              </div>
              <p className="mx-auto max-w-2xl text-xl text-slate-300">
                Explore the rich diversity of D&D classes and subclasses.
                Discover {classes.length} classes with their unique abilities,
                spellcasting traditions, and paths of mastery.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<ClassCompendiumLoadingFallback />}>
            <ClassCompendiumClient initialClasses={classes} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
