'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ProcessedClass } from '@/types/classes';
import {
  formatSpellcastingType,
  formatSpellcastingAbility,
  formatProficiencyType,
} from '@/utils/classFilters';
import {
  Shield,
  Heart,
  Star,
  Users,
  ChevronDown,
  ChevronUp,
  Brain,
} from 'lucide-react';

interface ClassCardProps {
  classData: ProcessedClass;
  displayMode: 'grid' | 'list';
}

const SPELLCASTING_TYPE_COLORS = {
  full: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  half: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  third: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  warlock: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  none: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
};

const HIT_DIE_COLORS = {
  d6: 'text-red-400 bg-red-500/10 border-red-500/20',
  d8: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  d10: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  d12: 'text-green-400 bg-green-500/10 border-green-500/20',
};

export default function ClassCard({ classData, displayMode }: ClassCardProps) {
  const [showSubclasses, setShowSubclasses] = useState(false);

  const spellcastingColorClass =
    SPELLCASTING_TYPE_COLORS[classData.spellcasting.type] ||
    SPELLCASTING_TYPE_COLORS.none;
  const hitDieColorClass =
    HIT_DIE_COLORS[classData.hitDie as keyof typeof HIT_DIE_COLORS] ||
    HIT_DIE_COLORS.d8;

  if (displayMode === 'list') {
    return (
      <Link href={`/classes/${classData.id}`} className="block">
        <div className="cursor-pointer rounded-lg border border-slate-600/50 bg-slate-800/40 shadow-lg backdrop-blur-sm transition-all hover:border-emerald-500/50 hover:shadow-xl">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <Shield className="h-8 w-8 text-emerald-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-xl font-bold text-white">
                      {classData.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-slate-400">
                        {classData.source}
                      </span>
                      {classData.page && (
                        <span className="text-xs text-slate-500">
                          • p. {classData.page}
                        </span>
                      )}
                      {classData.isSrd && (
                        <span className="rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                          SRD
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                  {/* Hit Die */}
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-400" />
                    <div>
                      <div className="text-xs text-slate-400">Hit Die</div>
                      <div
                        className={`rounded border px-2 py-1 text-sm font-medium ${hitDieColorClass}`}
                      >
                        {classData.hitDie}
                      </div>
                    </div>
                  </div>

                  {/* Spellcasting */}
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-purple-400" />
                    <div>
                      <div className="text-xs text-slate-400">Spellcasting</div>
                      <div
                        className={`rounded border px-2 py-1 text-sm font-medium ${spellcastingColorClass}`}
                      >
                        {formatSpellcastingType(classData.spellcasting.type)}
                      </div>
                    </div>
                  </div>

                  {/* Primary Abilities */}
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-blue-400" />
                    <div>
                      <div className="text-xs text-slate-400">Saves</div>
                      <div className="text-sm text-white">
                        {classData.primaryAbilities
                          ?.map(formatProficiencyType)
                          .join(', ') || 'None'}
                      </div>
                    </div>
                  </div>

                  {/* Subclasses Count */}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <div>
                      <div className="text-xs text-slate-400">Subclasses</div>
                      <div className="text-sm font-medium text-white">
                        {classData.subclasses.length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ml-4 flex items-center gap-2">
                {classData.subclasses.length > 0 && (
                  <button
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowSubclasses(!showSubclasses);
                    }}
                    className="p-2 text-slate-400 transition-colors hover:text-emerald-400"
                    title="Show subclasses"
                  >
                    {showSubclasses ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Subclasses expansion */}
            {showSubclasses && classData.subclasses.length > 0 && (
              <div className="mt-4 border-t border-slate-600/50 pt-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Users size={16} />
                  Subclasses ({classData.subclasses.length})
                </h4>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {classData.subclasses.map(subclass => (
                    <div
                      key={subclass.id}
                      className="rounded-lg border border-slate-600/30 bg-slate-700/30 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-white">
                            {subclass.name}
                          </div>
                          <div className="text-xs text-slate-400">
                            {subclass.source}
                            {subclass.page && ` • p. ${subclass.page}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Grid mode
  return (
    <Link href={`/classes/${classData.id}`} className="block">
      <div className="group cursor-pointer overflow-hidden rounded-lg border border-slate-600/50 bg-slate-800/40 shadow-lg backdrop-blur-sm transition-all hover:border-emerald-500/50 hover:shadow-xl">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-600/20 to-emerald-800/20">
                  <Shield className="h-6 w-6 text-emerald-400" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-bold text-white transition-colors group-hover:text-emerald-100">
                  {classData.name}
                </h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm text-slate-400">
                    {classData.source}
                  </span>
                  {classData.page && (
                    <span className="text-xs text-slate-500">
                      • p. {classData.page}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {classData.isSrd && (
              <span className="flex-shrink-0 rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-1 text-xs text-emerald-400">
                SRD
              </span>
            )}
          </div>

          {/* Quick stats */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 flex-shrink-0 text-red-400" />
              <div className="min-w-0">
                <div className="text-xs text-slate-400">Hit Die</div>
                <div
                  className={`inline-block rounded border px-2 py-0.5 text-sm font-medium ${hitDieColorClass}`}
                >
                  {classData.hitDie}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 flex-shrink-0 text-purple-400" />
              <div className="min-w-0">
                <div className="text-xs text-slate-400">Casting</div>
                <div
                  className={`rounded border px-2 py-0.5 text-xs font-medium ${spellcastingColorClass}`}
                >
                  {formatSpellcastingType(classData.spellcasting.type)}
                </div>
              </div>
            </div>
          </div>

          {/* Saving Throws */}
          {classData.primaryAbilities &&
            classData.primaryAbilities.length > 0 && (
              <div className="mb-4">
                <div className="mb-1 text-xs text-slate-400">
                  Saving Throw Proficiencies
                </div>
                <div className="flex flex-wrap gap-1">
                  {classData.primaryAbilities.map(ability => (
                    <span
                      key={ability}
                      className="rounded border border-blue-500/30 bg-blue-500/20 px-2 py-1 text-xs text-blue-400"
                    >
                      {formatProficiencyType(ability)}
                    </span>
                  ))}
                </div>
              </div>
            )}

          {/* Spellcasting ability if applicable */}
          {classData.spellcasting.ability && (
            <div className="mb-4">
              <div className="mb-1 text-xs text-slate-400">
                Spellcasting Ability
              </div>
              <span className="text-sm font-medium text-emerald-400">
                {formatSpellcastingAbility(classData.spellcasting.ability)}
              </span>
            </div>
          )}

          {/* Subclasses preview */}
          {classData.subclasses.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  Subclasses ({classData.subclasses.length})
                </div>
                <button
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSubclasses(!showSubclasses);
                  }}
                  className="flex items-center gap-1 text-xs text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  {showSubclasses ? 'Hide' : 'Show'}
                  {showSubclasses ? (
                    <ChevronUp size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                </button>
              </div>

              {!showSubclasses ? (
                <div className="text-xs text-slate-500">
                  {classData.subclasses
                    .slice(0, 3)
                    .map(sub => sub.shortName)
                    .join(', ')}
                  {classData.subclasses.length > 3 &&
                    ` +${classData.subclasses.length - 3} more`}
                </div>
              ) : (
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {classData.subclasses.map(subclass => (
                    <div
                      key={subclass.id}
                      className="rounded border border-slate-600/30 bg-slate-700/30 p-2"
                    >
                      <div className="text-xs font-medium text-white">
                        {subclass.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {subclass.source}
                        {subclass.page && ` • p. ${subclass.page}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
