import { Suspense } from 'react';
import { loadAllBestiary } from '@/utils/bestiaryDataLoader';
import { BookOpen, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import BestiaryCompendiumClient from '@/components/bestiary/BestiaryCompendiumClient';

// Loading fallback component
function BestiaryCompendiumLoadingFallback() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-center space-x-3 text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="text-xl font-medium">Loading Bestiary...</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-6 animate-pulse">
            <div className="h-6 bg-slate-700/50 rounded-md mb-4"></div>
            <div className="h-4 bg-slate-700/50 rounded-md mb-3"></div>
            <div className="h-4 bg-slate-700/50 rounded-md w-3/4 mb-3"></div>
            <div className="h-20 bg-slate-700/50 rounded-md"></div>
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
          <div className="max-w-7xl mx-auto">
            {/* Back Button */}
            <div className="mb-6">
              <Link 
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 hover:text-white rounded-lg transition-all backdrop-blur-sm border border-slate-600/60 hover:border-slate-500/60 shadow-lg"
              >
                <ArrowLeft size={16} />
                <span>Back to Character Sheet</span>
              </Link>
            </div>
            
            <div className="text-center">
              {/* Decorative elements */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-red-500/5 to-emerald-500/5 rounded-full blur-3xl"></div>
              
              <div className="relative">
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-600/20 to-red-800/20 border-2 border-red-500/30 rounded-xl shadow-lg backdrop-blur-sm">
                    <BookOpen className="h-10 w-10 text-red-400" />
                  </div>
                  <h1 className="text-5xl md:text-7xl font-bold text-white tracking-wide">
                    Bestiary
                  </h1>
                </div>
                <p className="text-xl text-slate-200 max-w-3xl mx-auto leading-relaxed">
                  Discover the creatures that roam the realms of D&D. Explore <span className="text-emerald-400 font-semibold">{bestiary.length} monsters</span> with their unique abilities, legendary powers, and ancient lore.
                </p>
                
                {/* Decorative accent lines */}
                <div className="flex items-center justify-center gap-4 mt-6">
                  <div className="h-px w-20 bg-gradient-to-r from-transparent to-red-500/50"></div>
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  <div className="h-px w-20 bg-gradient-to-l from-transparent to-emerald-500/50"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto">
          <Suspense fallback={<BestiaryCompendiumLoadingFallback />}>
            <BestiaryCompendiumClient initialMonsters={bestiary} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
