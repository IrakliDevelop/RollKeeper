import { Suspense } from 'react';
import { loadAllSpells } from '@/utils/spellDataLoader';
import SpellbookClient from '@/components/spellbook/SpellbookClient';
import { Book, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function SpellbookPage() {
  const spells = await loadAllSpells();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
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
                <Book className="h-12 w-12 text-amber-400" />
                <h1 className="text-4xl font-bold text-white md:text-6xl">
                  Arcane Grimoire
                </h1>
              </div>
              <p className="mx-auto max-w-2xl text-xl text-slate-300">
                Discover, study, and master the mystical arts. Browse through{' '}
                {spells.length} spells from across the multiverse and build your
                personal spellbook.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 px-6 pb-8">
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
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-amber-400" />
        <p className="text-slate-300">Loading spells...</p>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Arcane Grimoire | RollKeeper',
  description: 'Browse and manage D&D 5e spells in your personal spellbook',
};
