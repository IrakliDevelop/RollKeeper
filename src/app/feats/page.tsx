import { Suspense } from 'react';
import { loadAllFeats } from '@/utils/featDataLoader';
import FeatsCompendiumClient from '@/components/feats/FeatsCompendiumClient';
import { Scroll, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function FeatsPage() {
  const feats = await loadAllFeats();

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
              <Scroll className="text-accent-amber-text h-10 w-10 sm:h-12 sm:w-12" />
              <h1 className="text-heading text-3xl font-bold sm:text-4xl md:text-5xl">
                Feats
              </h1>
            </div>
            <p className="text-body mx-auto max-w-2xl text-base sm:text-lg">
              Explore {feats.length} feats to customize your character with
              unique abilities and specializations.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<FeatsLoadingFallback />}>
            <FeatsCompendiumClient initialFeats={feats} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function FeatsLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <Loader2 className="text-accent-amber-text mx-auto mb-4 h-8 w-8 animate-spin" />
        <p className="text-muted">Loading feats...</p>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Feats | RollKeeper',
  description:
    'Browse D&D 5e feats with filtering by source, prerequisites, and abilities',
};
