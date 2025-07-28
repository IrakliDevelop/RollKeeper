'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ProcessedClass } from '@/types/classes';
import { formatSpellcastingType, formatSpellcastingAbility, formatProficiencyType } from '@/utils/classFilters';
import { 
  Shield, 
  Heart, 
  Star, 
  Users,
  ChevronDown, 
  ChevronUp,
  Brain
} from 'lucide-react';

interface ClassCardProps {
  classData: ProcessedClass;
  displayMode: 'grid' | 'list';
}

const SPELLCASTING_TYPE_COLORS = {
  'full': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  'half': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'third': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  'warlock': 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  'none': 'text-gray-400 bg-gray-500/10 border-gray-500/20',
};

const HIT_DIE_COLORS = {
  'd6': 'text-red-400 bg-red-500/10 border-red-500/20',
  'd8': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'd10': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  'd12': 'text-green-400 bg-green-500/10 border-green-500/20',
};

export default function ClassCard({ classData, displayMode }: ClassCardProps) {
  const [showSubclasses, setShowSubclasses] = useState(false);

  const spellcastingColorClass = SPELLCASTING_TYPE_COLORS[classData.spellcasting.type] || SPELLCASTING_TYPE_COLORS.none;
  const hitDieColorClass = HIT_DIE_COLORS[classData.hitDie as keyof typeof HIT_DIE_COLORS] || HIT_DIE_COLORS.d8;

  if (displayMode === 'list') {
    return (
      <Link href={`/classes/${classData.id}`} className="block">
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-600/50 rounded-lg hover:border-emerald-500/50 transition-all shadow-lg hover:shadow-xl cursor-pointer">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-shrink-0">
                  <Shield className="h-8 w-8 text-emerald-400" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white truncate">{classData.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-slate-400">{classData.source}</span>
                    {classData.page && (
                      <span className="text-xs text-slate-500">• p. {classData.page}</span>
                    )}
                    {classData.isSrd && (
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                        SRD
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* Hit Die */}
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-400" />
                  <div>
                    <div className="text-xs text-slate-400">Hit Die</div>
                    <div className={`text-sm font-medium px-2 py-1 rounded border ${hitDieColorClass}`}>
                      {classData.hitDie}
                    </div>
                  </div>
                </div>

                {/* Spellcasting */}
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-purple-400" />
                  <div>
                    <div className="text-xs text-slate-400">Spellcasting</div>
                    <div className={`text-sm font-medium px-2 py-1 rounded border ${spellcastingColorClass}`}>
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
                       {classData.primaryAbilities?.map(formatProficiencyType).join(', ') || 'None'}
                     </div>
                   </div>
                 </div>

                {/* Subclasses Count */}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-400" />
                  <div>
                    <div className="text-xs text-slate-400">Subclasses</div>
                    <div className="text-sm text-white font-medium">
                      {classData.subclasses.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              {classData.subclasses.length > 0 && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSubclasses(!showSubclasses);
                  }}
                  className="p-2 text-slate-400 hover:text-emerald-400 transition-colors"
                  title="Show subclasses"
                >
                  {showSubclasses ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              )}
            </div>
          </div>

          {/* Subclasses expansion */}
          {showSubclasses && classData.subclasses.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-600/50">
              <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <Users size={16} />
                Subclasses ({classData.subclasses.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {classData.subclasses.map((subclass) => (
                  <div 
                    key={subclass.id}
                    className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/30"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">{subclass.name}</div>
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
      <div className="group bg-slate-800/40 backdrop-blur-sm border border-slate-600/50 rounded-lg hover:border-emerald-500/50 transition-all shadow-lg hover:shadow-xl overflow-hidden cursor-pointer">
        {/* Header */}
        <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border-2 border-emerald-500/30 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white truncate group-hover:text-emerald-100 transition-colors">
                {classData.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-slate-400">{classData.source}</span>
                {classData.page && (
                  <span className="text-xs text-slate-500">• p. {classData.page}</span>
                )}
              </div>
            </div>
          </div>
          
          {classData.isSrd && (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 flex-shrink-0">
              SRD
            </span>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-slate-400">Hit Die</div>
              <div className={`text-sm font-medium px-2 py-0.5 rounded border inline-block ${hitDieColorClass}`}>
                {classData.hitDie}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-purple-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-slate-400">Casting</div>
              <div className={`text-xs font-medium px-2 py-0.5 rounded border ${spellcastingColorClass}`}>
                {formatSpellcastingType(classData.spellcasting.type)}
              </div>
            </div>
          </div>
        </div>

        {/* Saving Throws */}
        {classData.primaryAbilities && classData.primaryAbilities.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-slate-400 mb-1">Saving Throw Proficiencies</div>
            <div className="flex gap-1 flex-wrap">
              {classData.primaryAbilities.map((ability) => (
                <span
                  key={ability}
                  className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30"
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
            <div className="text-xs text-slate-400 mb-1">Spellcasting Ability</div>
            <span className="text-sm text-emerald-400 font-medium">
              {formatSpellcastingAbility(classData.spellcasting.ability)}
            </span>
          </div>
        )}

        {/* Subclasses preview */}
        {classData.subclasses.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-400">
                Subclasses ({classData.subclasses.length})
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSubclasses(!showSubclasses);
                }}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
              >
                {showSubclasses ? 'Hide' : 'Show'}
                {showSubclasses ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
            
            {!showSubclasses ? (
              <div className="text-xs text-slate-500">
                {classData.subclasses.slice(0, 3).map(sub => sub.shortName).join(', ')}
                {classData.subclasses.length > 3 && ` +${classData.subclasses.length - 3} more`}
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {classData.subclasses.map((subclass) => (
                  <div 
                    key={subclass.id}
                    className="p-2 bg-slate-700/30 rounded border border-slate-600/30"
                  >
                    <div className="text-xs font-medium text-white">{subclass.name}</div>
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