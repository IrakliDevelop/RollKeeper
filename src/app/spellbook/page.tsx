import { Suspense } from 'react';
import { loadAllSpells } from '@/utils/spellDataLoader';
import SpellbookClient from '@/components/spellbook/SpellbookClient';
import { Book, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function SpellbookPage() {
  const spells = await loadAllSpells();

  return (
    <div className="bg-surface min-h-screen">
      {/* Header */}
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
              <Book className="text-accent-purple-text h-10 w-10 sm:h-12 sm:w-12" />
              <h1 className="text-heading text-3xl font-bold sm:text-4xl md:text-5xl">
                Spellbook
              </h1>
            </div>
            <p className="text-body mx-auto max-w-2xl text-base sm:text-lg">
              Browse through {spells.length} spells from across the multiverse
              and build your personal spellbook.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<SpellbookLoadingFallback />}>
            <SpellbookClient initialSpells={spells} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function SpellbookLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <Loader2 className="text-accent-purple-text mx-auto mb-4 h-8 w-8 animate-spin" />
        <p className="text-muted">Loading spells...</p>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Spellbook | RollKeeper',
  description: 'Browse and manage D&D 5e spells in your personal spellbook',
};
