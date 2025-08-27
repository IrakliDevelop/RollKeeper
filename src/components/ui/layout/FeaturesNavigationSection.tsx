'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Book, Users, Scroll, Skull } from 'lucide-react';

interface NavigationItem {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
  hoverGradient: string;
  available: boolean;
  comingSoon?: boolean;
}

const navigationItems: NavigationItem[] = [
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

export default function FeaturesNavigationSection() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section className="mx-auto mb-8 max-w-7xl">
      <div className="relative overflow-hidden rounded-xl border-2 border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100 shadow-lg backdrop-blur-sm">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-gradient-to-br from-slate-400/10 to-slate-500/10 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-gradient-to-tr from-slate-300/10 to-slate-400/10 blur-xl"></div>

        <div className="relative">
          {/* Collapsible Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full rounded-t-xl p-6 text-left transition-colors hover:bg-slate-200/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 p-2 shadow-md">
                  <Book className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                    🎯 D&D Resources & Tools
                  </h2>
                  {!isExpanded && (
                    <p className="mt-1 text-sm text-slate-600">
                      Spellbook, Classes, and more D&D content...
                    </p>
                  )}
                </div>
              </div>
              <div
                className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              >
                <svg
                  className="h-5 w-5 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </button>

          {/* Expandable Content */}
          <div
            className={`transition-all duration-300 ease-in-out ${
              isExpanded
                ? 'max-h-96 opacity-100'
                : 'max-h-0 overflow-hidden opacity-0'
            }`}
          >
            <div className="px-6 pb-6">
              <div className="border-t border-slate-300/50 pt-6">
                {/* Description */}
                <div className="mb-6 text-center">
                  <p className="text-slate-600">
                    Explore comprehensive D&D content and tools to enhance your
                    gameplay
                  </p>
                </div>

                {/* Navigation Grid */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {navigationItems.map(item => {
                    const IconComponent = item.icon;

                    if (!item.available) {
                      return (
                        <div
                          key={item.title}
                          className="relative rounded-lg border-2 border-slate-200 bg-white p-4 opacity-60 shadow-sm"
                        >
                          {/* Coming Soon Badge */}
                          {item.comingSoon && (
                            <div className="absolute -top-2 -right-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 px-2 py-1 text-xs font-bold text-white shadow-md">
                              Soon
                            </div>
                          )}

                          <div className="mb-3 flex items-center gap-3">
                            <div
                              className={`bg-gradient-to-br ${item.gradient} rounded-lg p-2 opacity-50 shadow-md`}
                            >
                              <IconComponent className="h-5 w-5 text-white" />
                            </div>
                            <h3 className="font-semibold text-slate-800">
                              {item.title}
                            </h3>
                          </div>

                          <p className="mb-3 text-sm text-slate-500">
                            {item.description}
                          </p>

                          <div className="text-xs font-medium text-slate-400">
                            Coming Soon...
                          </div>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.title}
                        href={item.href}
                        className="group relative rounded-lg border-2 border-slate-200 bg-white p-4 shadow-sm transition-all hover:scale-105 hover:border-slate-300 hover:shadow-lg"
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <div
                            className={`bg-gradient-to-br ${item.gradient} group-hover:bg-gradient-to-br group-hover:${item.hoverGradient} rounded-lg p-2 shadow-md transition-all`}
                          >
                            <IconComponent className="h-5 w-5 text-white" />
                          </div>
                          <h3 className="font-semibold text-slate-800 transition-colors group-hover:text-slate-900">
                            {item.title}
                          </h3>
                        </div>

                        <p className="mb-3 text-sm text-slate-600 transition-colors group-hover:text-slate-700">
                          {item.description}
                        </p>

                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">
                            Click to explore
                          </span>
                          <div className="text-slate-400 transition-colors group-hover:text-slate-600">
                            →
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Bottom accent line */}
                <div className="mt-6 border-t border-slate-300 pt-4">
                  <p className="text-center text-xs text-slate-500">
                    More tools and resources coming soon to enhance your D&D
                    experience!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
