'use client';

import React, { useState } from 'react';
import { ProcessedClass, ClassFeature } from '@/types/classes';
import { formatSpellcastingType, formatSpellcastingAbility, formatProficiencyType } from '@/utils/classFilters';
import { 
  Shield, 
  Heart, 
  Star, 
  Users, 
  Book, 
  Sword,
  Brain,
  Zap,
  CheckCircle,
  Circle,
  Info
} from 'lucide-react';

interface ClassDetailClientProps {
  classData: ProcessedClass;
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



export default function ClassDetailClient({ classData }: ClassDetailClientProps) {
  const [selectedSubclasses, setSelectedSubclasses] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'subclasses' | 'progression'>('overview');

  const spellcastingColorClass = SPELLCASTING_TYPE_COLORS[classData.spellcasting.type] || SPELLCASTING_TYPE_COLORS.none;
  const hitDieColorClass = HIT_DIE_COLORS[classData.hitDie as keyof typeof HIT_DIE_COLORS] || HIT_DIE_COLORS.d8;

  const toggleSubclass = (subclassId: string) => {
    setSelectedSubclasses(prev => 
      prev.includes(subclassId) 
        ? prev.filter(id => id !== subclassId)
        : [...prev, subclassId]
    );
  };

  const selectedSubclassData = classData.subclasses.filter(sub => selectedSubclasses.includes(sub.id));

  // Group features by level (now using ClassFeature objects)
  const groupedFeatures = classData.features.reduce((acc, feature) => {
    if (!acc[feature.level]) {
      acc[feature.level] = [];
    }
    acc[feature.level].push(feature);
    return acc;
  }, {} as Record<number, ClassFeature[]>);

  // Also include selected subclass features
  const groupedFeaturesWithSubclasses = { ...groupedFeatures };
  selectedSubclassData.forEach(subclass => {
    subclass.features.forEach(feature => {
      if (!groupedFeaturesWithSubclasses[feature.level]) {
        groupedFeaturesWithSubclasses[feature.level] = [];
      }
      // Features are already properly processed with correct levels and subclass info
      groupedFeaturesWithSubclasses[feature.level].push(feature);
    });
  });

  const renderFeaturesByLevel = () => {
    const levels = Object.keys(groupedFeaturesWithSubclasses)
      .map(Number)
      .sort((a, b) => a - b);

    return levels.map(level => (
      <div key={level} className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/50 rounded-xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-lg flex items-center justify-center border border-purple-500/30">
            <span className="text-lg font-bold text-purple-400">{level}</span>
          </div>
          <h3 className="text-xl font-bold text-white">Level {level}</h3>
          {level === 1 && (
            <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm border border-emerald-500/30">
              Starting Level
            </span>
          )}
        </div>

        <div className="grid gap-4">
          {groupedFeaturesWithSubclasses[level].map((feature, index) => (
            <div 
              key={index}
              className={`p-6 rounded-lg border transition-colors ${
                feature.isSubclassFeature 
                  ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15'
                  : 'bg-slate-700/30 border-slate-600/30 hover:bg-slate-700/40'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-lg font-semibold text-white">{feature.name}</h4>
                    {feature.isSubclassFeature && (
                      <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs border border-emerald-500/30">
                        {feature.subclassShortName || 'Subclass'}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    {feature.source && (
                      <span>Source: <span className="text-slate-300">{feature.source}</span></span>
                    )}
                    <span>Level {feature.level}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Zap size={14} className={feature.isSubclassFeature ? 'text-emerald-400' : 'text-purple-400'} />
                  <span>Lv. {level}</span>
                </div>
              </div>

              {/* Feature Description */}
              {feature.entries && feature.entries.length > 0 && (
                <div className="border-t border-slate-600/30 pt-4">
                  <div className="prose prose-invert prose-sm max-w-none">
                    {feature.entries.map((entry, entryIndex) => (
                      <div 
                        key={entryIndex}
                        className="mb-3 text-slate-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: entry }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    ));
  };

  const renderProgressionTable = () => {
    const levels = Array.from({ length: 20 }, (_, i) => i + 1);
    const proficiencyBonus = (level: number) => Math.ceil(level / 4) + 1;
    
    return (
      <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/50 rounded-xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
            <Book className="h-5 w-5 text-indigo-400" />
          </div>
          <h3 className="text-2xl font-bold text-white">Level Progression</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600/50">
                <th className="text-left p-3 text-slate-300 font-semibold">Level</th>
                <th className="text-left p-3 text-slate-300 font-semibold">Proficiency Bonus</th>
                <th className="text-left p-3 text-slate-300 font-semibold">Features</th>
                {classData.spellcasting.type !== 'none' && (
                  <>
                    <th className="text-center p-3 text-slate-300 font-semibold">Cantrips</th>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(spellLevel => (
                      <th key={spellLevel} className="text-center p-3 text-slate-300 font-semibold">
                        {spellLevel}
                      </th>
                    ))}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {levels.map(level => {
                const levelFeatures = groupedFeatures[level] || [];
                const spellSlots = classData.spellSlotProgression?.[level] || {};
                const cantrips = classData.spellcasting.cantripProgression?.[level - 1];
                
                return (
                  <tr 
                    key={level} 
                    className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${
                      level === 1 ? 'bg-emerald-500/5' : ''
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          level === 1 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-600/30 text-slate-300'
                        }`}>
                          {level}
                        </div>
                        {level === 1 && <span className="text-xs text-emerald-400">Start</span>}
                      </div>
                    </td>
                    
                    <td className="p-3 text-slate-300 font-medium">+{proficiencyBonus(level)}</td>
                    
                    <td className="p-3">
                      {levelFeatures.length > 0 ? (
                        <div className="space-y-1">
                          {levelFeatures.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className={`text-sm ${
                                feature.isSubclassFeature ? 'text-emerald-400' : 'text-slate-300'
                              }`}>
                                {feature.name}
                              </span>
                              {feature.isSubclassFeature && (
                                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/30">
                                  Sub
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </td>

                    {classData.spellcasting.type !== 'none' && (
                      <>
                        {/* Cantrips */}
                        <td className="p-3 text-center text-slate-300">
                          {cantrips || '—'}
                        </td>
                        
                        {/* Spell Slots */}
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(spellLevel => (
                          <td key={spellLevel} className="p-3 text-center text-slate-300">
                            {spellSlots[spellLevel] || '—'}
                          </td>
                        ))}
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-slate-600/30">
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500/20 rounded border border-emerald-500/30"></div>
              <span>Subclass Feature</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-slate-600/30 rounded"></div>
              <span>Class Feature</span>
            </div>
            {classData.spellcasting.type !== 'none' && (
              <div className="flex items-center gap-2">
                <Book size={12} className="text-purple-400" />
                <span>Numbers under spell levels indicate spell slots per day</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Quick Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Hit Die */}
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-600/50 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <Heart className="h-6 w-6 text-red-400" />
            <h3 className="text-lg font-semibold text-white">Hit Die</h3>
          </div>
          <div className={`text-2xl font-bold px-4 py-2 rounded-lg border ${hitDieColorClass} inline-block`}>
            {classData.hitDie}
          </div>
        </div>

        {/* Spellcasting */}
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-600/50 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <Star className="h-6 w-6 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Spellcasting</h3>
          </div>
          <div className={`text-lg font-medium px-3 py-2 rounded-lg border ${spellcastingColorClass} inline-block`}>
            {formatSpellcastingType(classData.spellcasting.type)}
          </div>
          {classData.spellcasting.ability && (
            <div className="mt-2 text-sm text-slate-400">
              Ability: <span className="text-emerald-400">{formatSpellcastingAbility(classData.spellcasting.ability)}</span>
            </div>
          )}
        </div>

        {/* Saving Throws */}
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-600/50 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <Brain className="h-6 w-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Saving Throws</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            {classData.primaryAbilities?.map((ability) => (
              <span
                key={ability}
                className="text-sm bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/30"
              >
                {formatProficiencyType(ability)}
              </span>
            )) || <span className="text-slate-400">None</span>}
          </div>
        </div>

        {/* Subclasses */}
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-600/50 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <Users className="h-6 w-6 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Subclasses</h3>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {classData.subclasses.length}
          </div>
          <div className="text-sm text-slate-400 mt-1">
            {selectedSubclasses.length} selected for comparison
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-slate-800/50 backdrop-blur-sm p-1 rounded-lg border border-slate-600/50 shadow-lg">
        {[
          { key: 'overview' as const, label: 'Overview', icon: Info },
          { key: 'features' as const, label: 'Class Features', icon: Zap },
          { key: 'subclasses' as const, label: 'Subclasses', icon: Users },
          { key: 'progression' as const, label: 'Progression', icon: Book }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-3 px-6 py-4 rounded-md transition-all font-medium ${
              activeTab === key
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg transform scale-[1.02]'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Icon size={20} />
            <span>{label}</span>
            {activeTab === key && (
              <div className="w-2 h-2 bg-emerald-200 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
                 {activeTab === 'overview' && (
           <div className="space-y-8">
             {/* Proficiencies - Enhanced Visual Design */}
             <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/50 rounded-xl p-8 shadow-xl">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
                   <Sword className="h-5 w-5 text-emerald-400" />
                 </div>
                 <h3 className="text-2xl font-bold text-white">Proficiencies</h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                 {/* Armor */}
                 {classData.proficiencies.armor && classData.proficiencies.armor.length > 0 && (
                   <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-4 hover:bg-slate-700/40 transition-colors">
                     <div className="flex items-center gap-2 mb-3">
                       <Shield className="h-4 w-4 text-blue-400" />
                       <h4 className="font-semibold text-slate-200">Armor</h4>
                     </div>
                     <div className="space-y-2">
                       {classData.proficiencies.armor.map((item, index) => (
                         <div key={index} className="flex items-center gap-2 text-sm text-slate-300">
                           <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                           <span dangerouslySetInnerHTML={{ __html: item }} />
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

                 {/* Weapons */}
                 {classData.proficiencies.weapons && classData.proficiencies.weapons.length > 0 && (
                   <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-4 hover:bg-slate-700/40 transition-colors">
                     <div className="flex items-center gap-2 mb-3">
                       <Sword className="h-4 w-4 text-red-400" />
                       <h4 className="font-semibold text-slate-200">Weapons</h4>
                     </div>
                     <div className="space-y-2">
                       {classData.proficiencies.weapons.map((item, index) => (
                         <div key={index} className="flex items-center gap-2 text-sm text-slate-300">
                           <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                           <span dangerouslySetInnerHTML={{ __html: item }} />
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

                 {/* Tools */}
                 {classData.proficiencies.tools && classData.proficiencies.tools.length > 0 && (
                   <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-4 hover:bg-slate-700/40 transition-colors">
                     <div className="flex items-center gap-2 mb-3">
                       <Zap className="h-4 w-4 text-yellow-400" />
                       <h4 className="font-semibold text-slate-200">Tools</h4>
                     </div>
                     <div className="space-y-2">
                       {classData.proficiencies.tools.map((item, index) => (
                         <div key={index} className="flex items-center gap-2 text-sm text-slate-300">
                           <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                           <span dangerouslySetInnerHTML={{ __html: item }} />
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

                 {/* Skills */}
                 {classData.proficiencies.skillChoices && (
                   <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-4 hover:bg-slate-700/40 transition-colors">
                     <div className="flex items-center gap-2 mb-3">
                       <Brain className="h-4 w-4 text-purple-400" />
                       <h4 className="font-semibold text-slate-200">Skills</h4>
                     </div>
                     <div className="mb-2">
                       <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded border border-purple-500/30">
                         Choose {classData.proficiencies.skillChoices.count}
                       </span>
                     </div>
                                            <div className="space-y-2 max-h-32 overflow-y-auto">
                         {classData.proficiencies.skillChoices.from.map((skill, index) => (
                           <div key={index} className="flex items-center gap-2 text-sm text-slate-300">
                             <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                             <span dangerouslySetInnerHTML={{ __html: skill }} />
                           </div>
                         ))}
                       </div>
                   </div>
                 )}
               </div>
             </div>

             {/* Starting Equipment - Enhanced with Reference Parsing */}
             {classData.startingEquipment && classData.startingEquipment.length > 0 && (
               <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/50 rounded-xl p-8 shadow-xl">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-lg flex items-center justify-center border border-amber-500/30">
                     <div className="text-amber-400 font-bold">⚔️</div>
                   </div>
                   <h3 className="text-2xl font-bold text-white">Starting Equipment</h3>
                 </div>
                 <div className="grid gap-4">
                   {classData.startingEquipment.map((item, index) => (
                     <div 
                       key={index} 
                       className="flex items-start gap-3 p-4 bg-slate-700/20 border border-slate-600/20 rounded-lg hover:bg-slate-700/30 transition-colors"
                     >
                       <div className="flex-shrink-0 w-2 h-2 bg-emerald-400 rounded-full mt-2"></div>
                       <div 
                         className="text-slate-200 leading-relaxed"
                         dangerouslySetInnerHTML={{ __html: item }}
                       />
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {/* Multiclassing - Enhanced Visual Design */}
             {classData.multiclassing && (
               <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-600/50 rounded-xl p-8 shadow-xl">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
                     <Users className="h-5 w-5 text-indigo-400" />
                   </div>
                   <h3 className="text-2xl font-bold text-white">Multiclassing</h3>
                 </div>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {/* Requirements */}
                   {Object.keys(classData.multiclassing.requirements).length > 0 && (
                     <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-6">
                       <div className="flex items-center gap-2 mb-4">
                         <CheckCircle className="h-5 w-5 text-green-400" />
                         <h4 className="text-lg font-semibold text-slate-200">Prerequisites</h4>
                       </div>
                       <div className="space-y-3">
                         {Object.entries(classData.multiclassing.requirements).map(([ability, score]) => (
                           <div key={ability} className="flex justify-between items-center p-3 bg-slate-600/20 rounded border border-slate-500/20">
                             <span className="text-slate-300 font-medium capitalize">{ability}</span>
                             <span className="text-green-400 font-bold text-lg">{score}+</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {/* Proficiencies Gained */}
                   <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-6">
                     <div className="flex items-center gap-2 mb-4">
                       <Star className="h-5 w-5 text-yellow-400" />
                       <h4 className="text-lg font-semibold text-slate-200">Proficiencies Gained</h4>
                     </div>
                     <div className="space-y-4">
                                                {classData.multiclassing.proficienciesGained.armor && classData.multiclassing.proficienciesGained.armor.length > 0 && (
                           <div className="p-3 bg-slate-600/20 rounded border border-slate-500/20">
                             <div className="flex items-center gap-2 mb-2">
                               <Shield className="h-4 w-4 text-blue-400" />
                               <span className="text-slate-300 font-medium">Armor</span>
                             </div>
                             <div 
                               className="text-slate-400"
                               dangerouslySetInnerHTML={{ __html: classData.multiclassing.proficienciesGained.armor.join(', ') }}
                             />
                           </div>
                         )}
                                                {classData.multiclassing.proficienciesGained.weapons && classData.multiclassing.proficienciesGained.weapons.length > 0 && (
                           <div className="p-3 bg-slate-600/20 rounded border border-slate-500/20">
                             <div className="flex items-center gap-2 mb-2">
                               <Sword className="h-4 w-4 text-red-400" />
                               <span className="text-slate-300 font-medium">Weapons</span>
                             </div>
                             <div 
                               className="text-slate-400"
                               dangerouslySetInnerHTML={{ __html: classData.multiclassing.proficienciesGained.weapons.join(', ') }}
                             />
                           </div>
                         )}
                                                {classData.multiclassing.proficienciesGained.tools && classData.multiclassing.proficienciesGained.tools.length > 0 && (
                           <div className="p-3 bg-slate-600/20 rounded border border-slate-500/20">
                             <div className="flex items-center gap-2 mb-2">
                               <Zap className="h-4 w-4 text-yellow-400" />
                               <span className="text-slate-300 font-medium">Tools</span>
                             </div>
                             <div 
                               className="text-slate-400"
                               dangerouslySetInnerHTML={{ __html: classData.multiclassing.proficienciesGained.tools.join(', ') }}
                             />
                           </div>
                         )}
                     </div>
                   </div>
                 </div>
               </div>
             )}
           </div>
         )}

                 {activeTab === 'features' && (
           <div className="space-y-6">
             {/* Features organized by level */}
             {renderFeaturesByLevel()}
           </div>
         )}

        {activeTab === 'subclasses' && (
          <div className="space-y-6">
            {/* Subclass Selection */}
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-600/50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">Choose Subclasses to Compare</h3>
                {selectedSubclasses.length > 0 && (
                  <button
                    onClick={() => setSelectedSubclasses([])}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classData.subclasses.map((subclass) => (
                  <div
                    key={subclass.id}
                    onClick={() => toggleSubclass(subclass.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedSubclasses.includes(subclass.id)
                        ? 'bg-emerald-500/20 border-emerald-500/50 shadow-lg'
                        : 'bg-slate-700/30 border-slate-600/30 hover:border-emerald-500/30 hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {selectedSubclasses.includes(subclass.id) ? (
                            <CheckCircle className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <Circle className="h-5 w-5 text-slate-400" />
                          )}
                          <h4 className="font-semibold text-white">{subclass.name}</h4>
                        </div>
                        <div className="text-sm text-slate-400 mb-2">
                          {subclass.source}
                          {subclass.page && ` • p. ${subclass.page}`}
                        </div>
                        <div className="text-xs text-slate-500">
                          {subclass.features.length} features
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subclass Comparison */}
            {selectedSubclassData.length > 0 && (
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-600/50 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Comparing {selectedSubclassData.length} Subclass{selectedSubclassData.length > 1 ? 'es' : ''}
                </h3>
                
                <div className="grid gap-6">
                  {selectedSubclassData.map((subclass) => (
                    <div key={subclass.id} className="border border-slate-600/30 rounded-lg p-4">
                      <h4 className="text-lg font-semibold text-white mb-3">{subclass.name}</h4>
                      <div className="text-sm text-slate-400 mb-3">
                        {subclass.source}
                        {subclass.page && ` • Page ${subclass.page}`}
                      </div>
                      <div className="text-sm text-slate-300">
                        <div className="font-medium text-slate-200 mb-2">Features:</div>
                        <ul className="space-y-1">
                          {subclass.features.map((feature, index) => (
                            <li key={index} className="text-slate-400">• {feature.name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

                 {activeTab === 'progression' && (
           <div className="space-y-6">
             {/* Level Progression Table */}
             {renderProgressionTable()}
           </div>
         )}
      </div>
    </div>
  );
} 