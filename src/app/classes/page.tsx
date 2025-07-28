import { Suspense } from 'react';
import { loadAllClasses } from '@/utils/classDataLoader';
import ClassCompendiumClient from '@/components/classes/ClassCompendiumClient';
import { Shield, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Loading fallback component
function ClassCompendiumLoadingFallback() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-center space-x-3 text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="text-xl font-medium">Loading Class Compendium...</span>
      </div>
      
      {/* Loading skeleton */}
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

export default async function ClassesPage() {
  const classes = await loadAllClasses();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-black opacity-40"></div>
        <div className="relative z-10 px-6 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Back Button */}
            <div className="mb-6">
              <Link 
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white rounded-lg transition-all backdrop-blur-sm border border-slate-600/50 hover:border-slate-500/50"
              >
                <ArrowLeft size={16} />
                <span>Back to Character Sheet</span>
              </Link>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Shield className="h-12 w-12 text-emerald-400" />
                <h1 className="text-4xl md:text-6xl font-bold text-white">
                  Class Compendium
                </h1>
              </div>
              <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                Explore the rich diversity of D&D classes and subclasses. Discover {classes.length} classes 
                with their unique abilities, spellcasting traditions, and paths of mastery.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto">
          <Suspense fallback={<ClassCompendiumLoadingFallback />}>
            <ClassCompendiumClient initialClasses={classes} />
          </Suspense>
        </div>
      </div>
    </div>
  );
} 