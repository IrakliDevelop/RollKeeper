'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Book, Users, Scroll, Skull, Library } from 'lucide-react';
import { HeaderAuthButton } from '@/components/ui/auth/AuthButton';

interface ResourceItem {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
  hoverGradient: string;
  available: boolean;
  comingSoon?: boolean;
}

const resourceItems: ResourceItem[] = [
  {
    title: 'Spellbook',
    description: '540+ D&D spells with advanced filtering',
    href: '/spellbook',
    icon: Book,
    gradient: 'from-purple-600 via-violet-600 to-indigo-600',
    hoverGradient: 'from-purple-700 via-violet-700 to-indigo-700',
    available: true,
  },
  {
    title: 'Classes',
    description: 'Complete compendium of all D&D classes',
    href: '/classes',
    icon: Users,
    gradient: 'from-amber-600 via-orange-600 to-red-600',
    hoverGradient: 'from-amber-700 via-orange-700 to-red-700',
    available: true,
  },
  {
    title: 'Feats',
    description: 'Browse and manage character feats',
    href: '/feats',
    icon: Scroll,
    gradient: 'from-emerald-600 via-teal-600 to-cyan-600',
    hoverGradient: 'from-emerald-700 via-teal-700 to-cyan-700',
    available: false,
    comingSoon: true,
  },
  {
    title: 'Bestiary',
    description: 'Monster manual and creature database',
    href: '/bestiary',
    icon: Skull,
    gradient: 'from-red-600 via-rose-600 to-pink-600',
    hoverGradient: 'from-red-700 via-rose-700 to-pink-700',
    available: true,
    comingSoon: false,
  },
];

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="font-medium">Back to Home</span>
              </Link>
              <div className="h-6 w-px bg-slate-300"></div>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 p-2 shadow-md">
                  <Library className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">
                  D&D Resources & Tools
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <nav className="hidden space-x-6 md:flex">
                <Link
                  href="/player"
                  className="font-medium text-slate-600 transition-colors hover:text-indigo-600"
                >
                  Player Dashboard
                </Link>
                <Link
                  href="/dm"
                  className="font-medium text-slate-600 transition-colors hover:text-indigo-600"
                >
                  DM Toolset
                </Link>
              </nav>
              <HeaderAuthButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Complete D&D Reference Library
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Access comprehensive D&D resources, tools, and databases to enhance your tabletop experience. 
            From spellbooks to monster manuals, everything you need is right here.
          </p>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {resourceItems.map((item) => {
            const IconComponent = item.icon;
            
            if (!item.available) {
              return (
                <div
                  key={item.title}
                  className="group relative overflow-hidden rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 opacity-60"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200"></div>
                  <div className="relative">
                    <div className="mb-4 flex items-center justify-between">
                      <div className={`rounded-lg bg-gradient-to-br ${item.gradient} p-3 shadow-md grayscale`}>
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                      {item.comingSoon && (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group relative overflow-hidden rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-indigo-300 hover:-translate-y-1"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-5`}></div>
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between">
                    <div className={`rounded-lg bg-gradient-to-br ${item.gradient} p-3 shadow-md transition-all duration-300 group-hover:bg-gradient-to-br group-hover:${item.hoverGradient} group-hover:scale-110`}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex items-center gap-1 text-indigo-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <span className="text-sm font-medium">Explore</span>
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900 transition-colors group-hover:text-indigo-900">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 group-hover:text-slate-700 transition-colors">
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Additional Info Section */}
        <div className="mt-16 rounded-xl bg-white/60 border border-slate-200 p-8 shadow-sm backdrop-blur-sm">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">
              More Resources Coming Soon
            </h3>
            <p className="text-slate-600 mb-6">
              We&apos;re constantly expanding our collection of D&D tools and resources. 
              Stay tuned for equipment databases, encounter builders, and more!
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-700">
                🛡️ Equipment Database
              </span>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-700">
                ⚔️ Encounter Builder
              </span>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-700">
                🎲 Random Generators
              </span>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-700">
                📊 Campaign Tools
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
