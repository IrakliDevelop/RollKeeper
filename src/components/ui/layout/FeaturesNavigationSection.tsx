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
      <div className="border-divider-strong from-surface-secondary to-surface-inset relative overflow-hidden rounded-xl border-2 bg-gradient-to-r shadow-lg backdrop-blur-sm">
        {/* Background decoration */}
        <div className="from-surface-secondary/10 to-surface-inset/10 absolute top-0 right-0 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl"></div>
        <div className="from-surface-secondary/10 to-surface-inset/10 absolute bottom-0 left-0 h-24 w-24 rounded-full bg-gradient-to-tr blur-xl"></div>

        <div className="relative">
          {/* Collapsible Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:bg-surface-hover w-full rounded-t-xl p-6 text-left transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="from-surface-secondary to-surface-inset rounded-lg bg-gradient-to-br p-2 shadow-md">
                  <Book className="text-inverse h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-heading flex items-center gap-2 text-2xl font-bold">
                    🎯 D&D Resources & Tools
                  </h2>
                  {!isExpanded && (
                    <p className="text-muted mt-1 text-sm">
                      Spellbook, Classes, and more D&D content...
                    </p>
                  )}
                </div>
              </div>
              <div
                className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              >
                <svg
                  className="text-muted h-5 w-5"
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
              <div className="border-divider/50 border-t pt-6">
                {/* Description */}
                <div className="mb-6 text-center">
                  <p className="text-muted">
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
                          className="border-divider bg-surface-raised relative rounded-lg border-2 p-4 opacity-60 shadow-sm"
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
                            <h3 className="text-heading font-semibold">
                              {item.title}
                            </h3>
                          </div>

                          <p className="text-muted mb-3 text-sm">
                            {item.description}
                          </p>

                          <div className="text-faint text-xs font-medium">
                            Coming Soon...
                          </div>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.title}
                        href={item.href}
                        className="group border-divider bg-surface-raised hover:border-divider-strong relative rounded-lg border-2 p-4 shadow-sm transition-all hover:scale-105 hover:shadow-lg"
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <div
                            className={`bg-gradient-to-br ${item.gradient} group-hover:bg-gradient-to-br group-hover:${item.hoverGradient} rounded-lg p-2 shadow-md transition-all`}
                          >
                            <IconComponent className="h-5 w-5 text-white" />
                          </div>
                          <h3 className="text-heading font-semibold transition-colors">
                            {item.title}
                          </h3>
                        </div>

                        <p className="text-muted group-hover:text-body mb-3 text-sm transition-colors">
                          {item.description}
                        </p>

                        <div className="flex items-center justify-between">
                          <span className="text-muted text-xs font-medium">
                            Click to explore
                          </span>
                          <div className="text-faint group-hover:text-muted transition-colors">
                            →
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Bottom accent line */}
                <div className="border-divider mt-6 border-t pt-4">
                  <p className="text-muted text-center text-xs">
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
