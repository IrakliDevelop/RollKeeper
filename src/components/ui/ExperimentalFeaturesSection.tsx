'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Book, Users } from 'lucide-react';

export default function ExperimentalFeaturesSection() {
  const [experimentalFeaturesExpanded, setExperimentalFeaturesExpanded] = useState(false);

  return (
    <section className="max-w-7xl mx-auto mb-6">
      <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-indigo-50 border-2 border-purple-200 rounded-xl shadow-lg relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/10 to-indigo-400/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-violet-400/10 to-purple-400/10 rounded-full blur-xl"></div>
        
        <div className="relative">
          {/* Collapsible Header */}
          <button
            onClick={() => setExperimentalFeaturesExpanded(!experimentalFeaturesExpanded)}
            className="w-full p-4 text-left hover:bg-purple-100/50 transition-colors rounded-t-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-2 rounded-lg shadow-md">
                  <Book className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    🧙‍♂️ New Experimental Features
                    <span className="bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-300 animate-pulse">
                      NEW
                    </span>
                  </h3>
                  {!experimentalFeaturesExpanded && (
                    <p className="text-sm text-gray-600 mt-1">
                      Advanced Spellbook & Complete Class Compendium with detailed features...
                    </p>
                  )}
                </div>
              </div>
              <div className={`transform transition-transform duration-200 ${experimentalFeaturesExpanded ? 'rotate-180' : ''}`}>
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </button>
          
          {/* Expandable Content */}
          <div className={`transition-all duration-300 ease-in-out ${
            experimentalFeaturesExpanded 
              ? 'max-h-96 opacity-100' 
              : 'max-h-0 opacity-0 overflow-hidden'
          }`}>
            <div className="px-4 pb-6">
              <div className="border-t border-purple-200/50 pt-4 space-y-6">
                
                {/* Advanced Spellbook System */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-3 rounded-xl shadow-lg">
                      <Book className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-gray-800 mb-2">
                      Advanced Spellbook System
                    </h4>
                    
                    <p className="text-gray-700 mb-3 leading-relaxed">
                      Comprehensive spellbook with <strong>540+ D&D spells</strong>, advanced filtering, 
                      personal grimoire management, and beautiful spell details with 5etools reference parsing.
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium border border-purple-200">
                        🔍 Search & Filters
                      </span>
                      <span className="bg-violet-100 text-violet-800 px-2 py-1 rounded-full text-xs font-medium border border-violet-200">
                        📚 Personal Spellbook
                      </span>
                      <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-medium border border-indigo-200">
                        ⭐ Favorites & Preparation
                      </span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium border border-blue-200">
                        🔄 Sorting & PHB2024
                      </span>
                    </div>
                    
                    <Link 
                      href="/spellbook"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg transform hover:scale-105 font-medium text-sm"
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
                    <div className="bg-gradient-to-br from-amber-600 to-orange-600 p-3 rounded-xl shadow-lg">
                      <Users className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-gray-800 mb-2">
                      Complete Class Compendium
                    </h4>
                    
                    <p className="text-gray-700 mb-3 leading-relaxed">
                      Detailed class information with <strong>all 14 D&D classes</strong>, subclass features, 
                      spell lists, progression tables, and comprehensive feature descriptions.
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-medium border border-amber-200">
                        ⚔️ All Classes & Subclasses
                      </span>
                      <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium border border-orange-200">
                        📜 Feature Descriptions
                      </span>
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium border border-yellow-200">
                        🔮 Oath/Domain Spells
                      </span>
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium border border-red-200">
                        📊 Progression Tables
                      </span>
                    </div>
                    
                    <Link 
                      href="/classes"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white px-4 py-2 rounded-lg hover:from-amber-700 hover:via-orange-700 hover:to-red-700 transition-all shadow-md hover:shadow-lg transform hover:scale-105 font-medium text-sm"
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