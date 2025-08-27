'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Book, Users } from 'lucide-react';

export default function ExperimentalFeaturesSection() {
  const [experimentalFeaturesExpanded, setExperimentalFeaturesExpanded] =
    useState(false);

  return (
    <section className="mx-auto mb-6 max-w-7xl">
      <div className="relative overflow-hidden rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 via-violet-50 to-indigo-50 shadow-lg">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-gradient-to-br from-purple-400/10 to-indigo-400/10 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-gradient-to-tr from-violet-400/10 to-purple-400/10 blur-xl"></div>

        <div className="relative">
          {/* Collapsible Header */}
          <button
            onClick={() =>
              setExperimentalFeaturesExpanded(!experimentalFeaturesExpanded)
            }
            className="w-full rounded-t-xl p-4 text-left transition-colors hover:bg-purple-100/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 p-2 shadow-md">
                  <Book className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
                    🧙‍♂️ New Experimental Features
                    <span className="animate-pulse rounded-full border border-amber-300 bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-900">
                      NEW
                    </span>
                  </h3>
                  {!experimentalFeaturesExpanded && (
                    <p className="mt-1 text-sm text-gray-600">
                      Advanced Spellbook & Complete Class Compendium with
                      detailed features...
                    </p>
                  )}
                </div>
              </div>
              <div
                className={`transform transition-transform duration-200 ${experimentalFeaturesExpanded ? 'rotate-180' : ''}`}
              >
                <svg
                  className="h-5 w-5 text-gray-600"
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
              experimentalFeaturesExpanded
                ? 'max-h-96 opacity-100'
                : 'max-h-0 overflow-hidden opacity-0'
            }`}
          >
            <div className="px-4 pb-6">
              <div className="space-y-6 border-t border-purple-200/50 pt-4">
                {/* Advanced Spellbook System */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 p-3 shadow-lg">
                      <Book className="h-8 w-8 text-white" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <h4 className="mb-2 text-xl font-bold text-gray-800">
                      Advanced Spellbook System
                    </h4>

                    <p className="mb-3 leading-relaxed text-gray-700">
                      Comprehensive spellbook with{' '}
                      <strong>540+ D&D spells</strong>, advanced filtering,
                      personal grimoire management, and beautiful spell details
                      with 5etools reference parsing.
                    </p>

                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-purple-200 bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                        🔍 Search & Filters
                      </span>
                      <span className="rounded-full border border-violet-200 bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800">
                        📚 Personal Spellbook
                      </span>
                      <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800">
                        ⭐ Favorites & Preparation
                      </span>
                      <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                        🔄 Sorting & PHB2024
                      </span>
                    </div>

                    <Link
                      href="/spellbook"
                      className="inline-flex transform items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:scale-105 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 hover:shadow-lg"
                    >
                      <Book size={16} />
                      Explore Spellbook
                      <span className="text-purple-200">→</span>
                    </Link>
                  </div>
                </div>

                {/* Class Compendium */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 p-3 shadow-lg">
                      <Users className="h-8 w-8 text-white" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <h4 className="mb-2 text-xl font-bold text-gray-800">
                      Complete Class Compendium
                    </h4>

                    <p className="mb-3 leading-relaxed text-gray-700">
                      Detailed class information with{' '}
                      <strong>all 14 D&D classes</strong>, subclass features,
                      spell lists, progression tables, and comprehensive feature
                      descriptions.
                    </p>

                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                        ⚔️ All Classes & Subclasses
                      </span>
                      <span className="rounded-full border border-orange-200 bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
                        📜 Feature Descriptions
                      </span>
                      <span className="rounded-full border border-yellow-200 bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                        🔮 Oath/Domain Spells
                      </span>
                      <span className="rounded-full border border-red-200 bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                        📊 Progression Tables
                      </span>
                    </div>

                    <Link
                      href="/classes"
                      className="inline-flex transform items-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:scale-105 hover:from-amber-700 hover:via-orange-700 hover:to-red-700 hover:shadow-lg"
                    >
                      <Users size={16} />
                      Browse Classes
                      <span className="text-amber-200">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
