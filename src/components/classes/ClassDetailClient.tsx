'use client';

import React, { useState } from 'react';
import { ProcessedClass, ClassFeature } from '@/types/classes';
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
  Book,
  BookOpen,
  Sword,
  Brain,
  Zap,
  CheckCircle,
  Circle,
  Info,
} from 'lucide-react';

interface ClassDetailClientProps {
  classData: ProcessedClass;
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

export default function ClassDetailClient({
  classData,
}: ClassDetailClientProps) {
  const [selectedSubclasses, setSelectedSubclasses] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'features' | 'subclasses' | 'progression'
  >('overview');
  const [collapsedTenets, setCollapsedTenets] = useState<Set<string>>(
    new Set()
  );

  const spellcastingColorClass =
    SPELLCASTING_TYPE_COLORS[classData.spellcasting.type] ||
    SPELLCASTING_TYPE_COLORS.none;
  const hitDieColorClass =
    HIT_DIE_COLORS[classData.hitDie as keyof typeof HIT_DIE_COLORS] ||
    HIT_DIE_COLORS.d8;

  const toggleSubclass = (subclassId: string) => {
    setSelectedSubclasses(prev =>
      prev.includes(subclassId)
        ? prev.filter(id => id !== subclassId)
        : [...prev, subclassId]
    );
  };

  const selectedSubclassData = classData.subclasses.filter(sub =>
    selectedSubclasses.includes(sub.id)
  );

  // Function to detect if a feature contains tenets/oaths (flavor text)
  const isFlavorText = (feature: ClassFeature): boolean => {
    if (classData.name !== 'Paladin' || !feature.isSubclassFeature)
      return false;

    const featureName = feature.name.toLowerCase();
    const contentText = feature.entries?.join(' ').toLowerCase() || '';

    // Be very specific about what constitutes flavor text
    // Only tenet/oath descriptions, not mechanical features
    const isExplicitTenet =
      featureName.includes('tenet') ||
      (featureName.includes('oath') && !featureName.includes('spell'));

    // Check for tenet-specific content patterns (multiple indicators required)
    const tenetIndicators = ['tenet', 'sworn to', 'guide you', 'follow these'];
    const principleIndicators = ['principle', 'ideal', 'creed', 'belief'];

    const hasTenetContent = tenetIndicators.some(indicator =>
      contentText.includes(indicator)
    );
    const hasPrincipleContent = principleIndicators.some(indicator =>
      contentText.includes(indicator)
    );

    // Only consider it flavor text if:
    // 1. Name explicitly mentions tenets/oath, OR
    // 2. Content has multiple flavor indicators AND is quite long (>600 chars) AND no mechanical keywords
    const mechanicalKeywords = [
      'damage',
      'spell',
      'attack',
      'bonus',
      'action',
      'reaction',
      'channel divinity',
      'hit points',
      'saving throw',
    ];
    const hasMechanicalContent = mechanicalKeywords.some(keyword =>
      contentText.includes(keyword)
    );

    const isLongFlavorText =
      (hasTenetContent || hasPrincipleContent) &&
      contentText.length > 600 &&
      !hasMechanicalContent;

    return isExplicitTenet || isLongFlavorText;
  };

  const toggleTenetCollapse = (featureId: string) => {
    setCollapsedTenets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(featureId)) {
        newSet.delete(featureId);
      } else {
        newSet.add(featureId);
      }
      return newSet;
    });
  };

  // Group features by level (now using ClassFeature objects)
  const groupedFeatures = classData.features.reduce(
    (acc, feature) => {
      if (!acc[feature.level]) {
        acc[feature.level] = [];
      }
      acc[feature.level].push(feature);
      return acc;
    },
    {} as Record<number, ClassFeature[]>
  );

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
      <div
        key={level}
        className="rounded-xl border border-slate-600/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-6 shadow-xl backdrop-blur-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-purple-600/20">
            <span className="text-lg font-bold text-purple-400">{level}</span>
          </div>
          <h3 className="text-xl font-bold text-white">Level {level}</h3>
          {level === 1 && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-sm text-emerald-400">
              Starting Level
            </span>
          )}
        </div>

        <div className="grid gap-4">
          {groupedFeaturesWithSubclasses[level].map((feature, index) => {
            const isFlavorFeature = isFlavorText(feature);
            const featureId = `${feature.name}-${feature.level}-${index}`;
            const isCollapsed = collapsedTenets.has(featureId);

            return (
              <div
                key={index}
                className={`rounded-lg border p-6 transition-colors ${
                  isFlavorFeature
                    ? 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15'
                    : feature.isSubclassFeature
                      ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15'
                      : 'border-slate-600/30 bg-slate-700/30 hover:bg-slate-700/40'
                }`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <h4 className="text-lg font-semibold text-white">
                        {feature.name}
                      </h4>
                      {feature.isSubclassFeature && (
                        <span
                          className={`rounded border px-2 py-1 text-xs ${
                            isFlavorFeature
                              ? 'border-amber-500/30 bg-amber-500/20 text-amber-400'
                              : 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {feature.subclassShortName || 'Subclass'}
                        </span>
                      )}
                      {isFlavorFeature && (
                        <span className="rounded border border-amber-500/30 bg-amber-500/20 px-2 py-1 text-xs text-amber-400">
                          Flavor
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      {feature.source && (
                        <span>
                          Source:{' '}
                          <span className="text-slate-300">
                            {feature.source}
                          </span>
                        </span>
                      )}
                      <span>Level {feature.level}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Zap
                      size={14}
                      className={
                        feature.isSubclassFeature
                          ? 'text-emerald-400'
                          : 'text-purple-400'
                      }
                    />
                    <span>Lv. {level}</span>
                  </div>
                </div>

                {/* Feature Description */}
                {feature.entries && feature.entries.length > 0 && (
                  <div className="border-t border-slate-600/30 pt-4">
                    {isFlavorFeature ? (
                      <div>
                        <button
                          onClick={() => toggleTenetCollapse(featureId)}
                          className="mb-3 flex w-full items-center gap-2 rounded p-2 text-left transition-colors hover:bg-amber-500/10"
                        >
                          <div
                            className={`transform transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                          >
                            <svg
                              className="h-4 w-4 text-amber-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                          <span className="font-medium text-amber-400">
                            {isCollapsed ? 'Show' : 'Hide'} Oath Details
                          </span>
                          <span className="ml-auto text-xs text-amber-300/60">
                            (Flavor Text - Not Mechanically Required)
                          </span>
                        </button>

                        {!isCollapsed && (
                          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                            <div className="prose prose-invert prose-sm max-w-none">
                              {feature.entries.map((entry, entryIndex) => (
                                <div
                                  key={entryIndex}
                                  className="mb-3 leading-relaxed text-amber-200/80"
                                  dangerouslySetInnerHTML={{ __html: entry }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none">
                        {feature.entries.map((entry, entryIndex) => (
                          <div
                            key={entryIndex}
                            className="mb-3 leading-relaxed text-slate-300"
                            dangerouslySetInnerHTML={{ __html: entry }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    ));
  };

  const renderProgressionTable = () => {
    const levels = Array.from({ length: 20 }, (_, i) => i + 1);
    const proficiencyBonus = (level: number) => Math.ceil(level / 4) + 1;

    return (
      <div className="rounded-xl border border-slate-600/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-6 shadow-xl backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-indigo-600/20">
            <Book className="h-5 w-5 text-indigo-400" />
          </div>
          <h3 className="text-2xl font-bold text-white">Level Progression</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600/50">
                <th className="p-3 text-left font-semibold text-slate-300">
                  Level
                </th>
                <th className="p-3 text-left font-semibold text-slate-300">
                  Proficiency Bonus
                </th>
                <th className="p-3 text-left font-semibold text-slate-300">
                  Features
                </th>
                {classData.spellcasting.type !== 'none' && (
                  <>
                    <th className="p-3 text-center font-semibold text-slate-300">
                      Cantrips
                    </th>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(spellLevel => (
                      <th
                        key={spellLevel}
                        className="p-3 text-center font-semibold text-slate-300"
                      >
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
                const spellSlots =
                  classData.spellSlotProgression?.[level] || {};
                const cantrips =
                  classData.spellcasting.cantripProgression?.[level - 1];

                return (
                  <tr
                    key={level}
                    className={`border-b border-slate-700/30 transition-colors hover:bg-slate-700/20 ${
                      level === 1 ? 'bg-emerald-500/5' : ''
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            level === 1
                              ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-600/30 text-slate-300'
                          }`}
                        >
                          {level}
                        </div>
                        {level === 1 && (
                          <span className="text-xs text-emerald-400">
                            Start
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 font-medium text-slate-300">
                      +{proficiencyBonus(level)}
                    </td>

                    <td className="p-3">
                      {levelFeatures.length > 0 ? (
                        <div className="space-y-1">
                          {levelFeatures.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span
                                className={`text-sm ${
                                  feature.isSubclassFeature
                                    ? 'text-emerald-400'
                                    : 'text-slate-300'
                                }`}
                              >
                                {feature.name}
                              </span>
                              {feature.isSubclassFeature && (
                                <span className="rounded border border-emerald-500/30 bg-emerald-500/20 px-1 py-0.5 text-xs text-emerald-400">
                                  Sub
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
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
                          <td
                            key={spellLevel}
                            className="p-3 text-center text-slate-300"
                          >
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
        <div className="mt-6 border-t border-slate-600/30 pt-4">
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded border border-emerald-500/30 bg-emerald-500/20"></div>
              <span>Subclass Feature</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-slate-600/30"></div>
              <span>Class Feature</span>
            </div>
            {classData.spellcasting.type !== 'none' && (
              <div className="flex items-center gap-2">
                <Book size={12} className="text-purple-400" />
                <span>
                  Numbers under spell levels indicate spell slots per day
                </span>
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {/* Hit Die */}
        <div className="rounded-lg border border-slate-600/50 bg-slate-800/30 p-6 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-3">
            <Heart className="h-6 w-6 text-red-400" />
            <h3 className="text-lg font-semibold text-white">Hit Die</h3>
          </div>
          <div
            className={`rounded-lg border px-4 py-2 text-2xl font-bold ${hitDieColorClass} inline-block`}
          >
            {classData.hitDie}
          </div>
        </div>

        {/* Spellcasting */}
        <div className="rounded-lg border border-slate-600/50 bg-slate-800/30 p-6 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-3">
            <Star className="h-6 w-6 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Spellcasting</h3>
          </div>
          <div
            className={`rounded-lg border px-3 py-2 text-lg font-medium ${spellcastingColorClass} inline-block`}
          >
            {formatSpellcastingType(classData.spellcasting.type)}
          </div>
          {classData.spellcasting.ability && (
            <div className="mt-2 text-sm text-slate-400">
              Ability:{' '}
              <span className="text-emerald-400">
                {formatSpellcastingAbility(classData.spellcasting.ability)}
              </span>
            </div>
          )}
        </div>

        {/* Saving Throws */}
        <div className="rounded-lg border border-slate-600/50 bg-slate-800/30 p-6 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-3">
            <Brain className="h-6 w-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Saving Throws</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {classData.proficiencies.savingThrows?.map(ability => (
              <span
                key={ability}
                className="rounded-lg border border-blue-500/30 bg-blue-500/20 px-3 py-1 text-sm text-blue-400"
              >
                {formatProficiencyType(ability)}
              </span>
            )) || <span className="text-slate-400">None</span>}
          </div>
        </div>

        {/* Subclasses */}
        <div className="rounded-lg border border-slate-600/50 bg-slate-800/30 p-6 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-3">
            <Users className="h-6 w-6 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Subclasses</h3>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {classData.subclasses.length}
          </div>
          <div className="mt-1 text-sm text-slate-400">
            {selectedSubclasses.length} selected for comparison
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 rounded-lg border border-slate-600/50 bg-slate-800/50 p-1 shadow-lg backdrop-blur-sm">
        {[
          { key: 'overview' as const, label: 'Overview', icon: Info },
          { key: 'features' as const, label: 'Class Features', icon: Zap },
          { key: 'subclasses' as const, label: 'Subclasses', icon: Users },
          { key: 'progression' as const, label: 'Progression', icon: Book },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-3 rounded-md px-6 py-4 font-medium transition-all ${
              activeTab === key
                ? 'scale-[1.02] transform bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Icon size={20} />
            <span>{label}</span>
            {activeTab === key && (
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-200" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Proficiencies - Enhanced Visual Design */}
            <div className="rounded-xl border border-slate-600/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-8 shadow-xl backdrop-blur-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20">
                  <Sword className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white">Proficiencies</h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                {/* Armor */}
                {classData.proficiencies.armor &&
                  classData.proficiencies.armor.length > 0 && (
                    <div className="rounded-lg border border-slate-600/30 bg-slate-700/30 p-4 transition-colors hover:bg-slate-700/40">
                      <div className="mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-400" />
                        <h4 className="font-semibold text-slate-200">Armor</h4>
                      </div>
                      <div className="space-y-2">
                        {classData.proficiencies.armor.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-sm text-slate-300"
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                            <span dangerouslySetInnerHTML={{ __html: item }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Weapons */}
                {classData.proficiencies.weapons &&
                  classData.proficiencies.weapons.length > 0 && (
                    <div className="rounded-lg border border-slate-600/30 bg-slate-700/30 p-4 transition-colors hover:bg-slate-700/40">
                      <div className="mb-3 flex items-center gap-2">
                        <Sword className="h-4 w-4 text-red-400" />
                        <h4 className="font-semibold text-slate-200">
                          Weapons
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {classData.proficiencies.weapons.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-sm text-slate-300"
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-red-400"></div>
                            <span dangerouslySetInnerHTML={{ __html: item }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Tools */}
                {classData.proficiencies.tools &&
                  classData.proficiencies.tools.length > 0 && (
                    <div className="rounded-lg border border-slate-600/30 bg-slate-700/30 p-4 transition-colors hover:bg-slate-700/40">
                      <div className="mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-400" />
                        <h4 className="font-semibold text-slate-200">Tools</h4>
                      </div>
                      <div className="space-y-2">
                        {classData.proficiencies.tools.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-sm text-slate-300"
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-yellow-400"></div>
                            <span dangerouslySetInnerHTML={{ __html: item }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Skills */}
                {classData.proficiencies.skillChoices && (
                  <div className="rounded-lg border border-slate-600/30 bg-slate-700/30 p-4 transition-colors hover:bg-slate-700/40">
                    <div className="mb-3 flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-400" />
                      <h4 className="font-semibold text-slate-200">Skills</h4>
                    </div>
                    <div className="mb-2">
                      <span className="rounded border border-purple-500/30 bg-purple-500/20 px-2 py-1 text-xs text-purple-300">
                        Choose {classData.proficiencies.skillChoices.count}
                      </span>
                    </div>
                    <div className="max-h-32 space-y-2 overflow-y-auto">
                      {classData.proficiencies.skillChoices.from.map(
                        (skill, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-sm text-slate-300"
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-purple-400"></div>
                            <span dangerouslySetInnerHTML={{ __html: skill }} />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Starting Equipment - Enhanced with Reference Parsing */}
            {classData.startingEquipment &&
              classData.startingEquipment.length > 0 && (
                <div className="rounded-xl border border-slate-600/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-8 shadow-xl backdrop-blur-sm">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-amber-600/20">
                      <div className="font-bold text-amber-400">⚔️</div>
                    </div>
                    <h3 className="text-2xl font-bold text-white">
                      Starting Equipment
                    </h3>
                  </div>
                  <div className="grid gap-4">
                    {classData.startingEquipment.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 rounded-lg border border-slate-600/20 bg-slate-700/20 p-4 transition-colors hover:bg-slate-700/30"
                      >
                        <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400"></div>
                        <div
                          className="leading-relaxed text-slate-200"
                          dangerouslySetInnerHTML={{ __html: item }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Multiclassing - Enhanced Visual Design */}
            {classData.multiclassing && (
              <div className="rounded-xl border border-slate-600/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-8 shadow-xl backdrop-blur-sm">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-indigo-600/20">
                    <Users className="h-5 w-5 text-indigo-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">
                    Multiclassing
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  {/* Requirements */}
                  {Object.keys(classData.multiclassing.requirements).length >
                    0 && (
                    <div className="rounded-lg border border-slate-600/30 bg-slate-700/30 p-6">
                      <div className="mb-4 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                        <h4 className="text-lg font-semibold text-slate-200">
                          Prerequisites
                        </h4>
                      </div>
                      <div className="space-y-3">
                        {Object.entries(
                          classData.multiclassing.requirements
                        ).map(([ability, score]) => (
                          <div
                            key={ability}
                            className="flex items-center justify-between rounded border border-slate-500/20 bg-slate-600/20 p-3"
                          >
                            <span className="font-medium text-slate-300 capitalize">
                              {ability}
                            </span>
                            <span className="text-lg font-bold text-green-400">
                              {score}+
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proficiencies Gained */}
                  <div className="rounded-lg border border-slate-600/30 bg-slate-700/30 p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-400" />
                      <h4 className="text-lg font-semibold text-slate-200">
                        Proficiencies Gained
                      </h4>
                    </div>
                    <div className="space-y-4">
                      {classData.multiclassing.proficienciesGained.armor &&
                        classData.multiclassing.proficienciesGained.armor
                          .length > 0 && (
                          <div className="rounded border border-slate-500/20 bg-slate-600/20 p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <Shield className="h-4 w-4 text-blue-400" />
                              <span className="font-medium text-slate-300">
                                Armor
                              </span>
                            </div>
                            <div
                              className="text-slate-400"
                              dangerouslySetInnerHTML={{
                                __html:
                                  classData.multiclassing.proficienciesGained.armor.join(
                                    ', '
                                  ),
                              }}
                            />
                          </div>
                        )}
                      {classData.multiclassing.proficienciesGained.weapons &&
                        classData.multiclassing.proficienciesGained.weapons
                          .length > 0 && (
                          <div className="rounded border border-slate-500/20 bg-slate-600/20 p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <Sword className="h-4 w-4 text-red-400" />
                              <span className="font-medium text-slate-300">
                                Weapons
                              </span>
                            </div>
                            <div
                              className="text-slate-400"
                              dangerouslySetInnerHTML={{
                                __html:
                                  classData.multiclassing.proficienciesGained.weapons.join(
                                    ', '
                                  ),
                              }}
                            />
                          </div>
                        )}
                      {classData.multiclassing.proficienciesGained.tools &&
                        classData.multiclassing.proficienciesGained.tools
                          .length > 0 && (
                          <div className="rounded border border-slate-500/20 bg-slate-600/20 p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <Zap className="h-4 w-4 text-yellow-400" />
                              <span className="font-medium text-slate-300">
                                Tools
                              </span>
                            </div>
                            <div
                              className="text-slate-400"
                              dangerouslySetInnerHTML={{
                                __html:
                                  classData.multiclassing.proficienciesGained.tools.join(
                                    ', '
                                  ),
                              }}
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
            {/* Subclass Spell Lists - Only show for selected subclasses */}
            {selectedSubclassData.length > 0 &&
              selectedSubclassData.some(
                sub => sub.spellList && sub.spellList.length > 0
              ) && (
                <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-purple-800/20 p-6 shadow-xl backdrop-blur-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
                    <BookOpen className="h-6 w-6 text-purple-400" />
                    {classData.name === 'Paladin'
                      ? 'Oath Spells'
                      : classData.name === 'Cleric'
                        ? 'Domain Spells'
                        : classData.name === 'Warlock'
                          ? 'Expanded Spell List'
                          : 'Additional Spells'}
                  </h3>

                  {selectedSubclassData
                    .filter(sub => sub.spellList && sub.spellList.length > 0)
                    .map(subclass => (
                      <div key={subclass.id} className="mb-6 last:mb-0">
                        <h4 className="mb-3 flex items-center gap-2 text-lg font-semibold text-purple-300">
                          <Star size={16} className="text-purple-400" />
                          {subclass.name}
                        </h4>
                        <div className="overflow-hidden rounded-lg border border-slate-600/30 bg-slate-800/40">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-slate-700/50">
                                <th className="p-3 text-left font-medium text-slate-300">
                                  {classData.name} Level
                                </th>
                                <th className="p-3 text-left font-medium text-slate-300">
                                  Spells
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {subclass.spellList!.map((spellLevel, index) => (
                                <tr
                                  key={index}
                                  className="border-t border-slate-600/20 transition-colors hover:bg-slate-700/20"
                                >
                                  <td className="p-3 font-semibold text-purple-300">
                                    {spellLevel.level}
                                    {spellLevel.level === 1
                                      ? 'st'
                                      : spellLevel.level === 2
                                        ? 'nd'
                                        : spellLevel.level === 3
                                          ? 'rd'
                                          : 'th'}
                                  </td>
                                  <td className="p-3 text-slate-300">
                                    <div className="flex flex-wrap gap-1">
                                      {spellLevel.spells.map(
                                        (spell, spellIndex) => (
                                          <span
                                            key={spellIndex}
                                            className="rounded border border-purple-500/30 bg-purple-500/20 px-2 py-1 text-sm text-purple-300"
                                          >
                                            {spell}
                                          </span>
                                        )
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              )}

            {/* Help message for classes with spell lists when no subclasses selected */}
            {selectedSubclassData.length === 0 &&
              ['Cleric', 'Paladin', 'Warlock', 'Sorcerer', 'Ranger'].includes(
                classData.name
              ) &&
              classData.subclasses.some(
                sub => sub.spellList && sub.spellList.length > 0
              ) && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      <Info className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="mb-1 font-medium text-blue-400">
                        {classData.name === 'Paladin'
                          ? 'Oath Spells Available'
                          : classData.name === 'Cleric'
                            ? 'Domain Spells Available'
                            : classData.name === 'Warlock'
                              ? 'Expanded Spell Lists Available'
                              : 'Additional Spells Available'}
                      </h4>
                      <p className="text-sm text-blue-300">
                        Select subclasses from the &quot;Subclasses&quot; tab to
                        view their{' '}
                        {classData.name === 'Paladin'
                          ? 'oath spells'
                          : classData.name === 'Cleric'
                            ? 'domain spells'
                            : classData.name === 'Warlock'
                              ? 'expanded spell lists'
                              : 'additional spells'}
                        .
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {/* Features organized by level */}
            {renderFeaturesByLevel()}
          </div>
        )}

        {activeTab === 'subclasses' && (
          <div className="space-y-6">
            {/* Subclass Selection */}
            <div className="rounded-lg border border-slate-600/50 bg-slate-800/30 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">
                  Choose Subclasses to Compare
                </h3>
                {selectedSubclasses.length > 0 && (
                  <button
                    onClick={() => setSelectedSubclasses([])}
                    className="text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {classData.subclasses.map(subclass => (
                  <div
                    key={subclass.id}
                    onClick={() => toggleSubclass(subclass.id)}
                    className={`cursor-pointer rounded-lg border p-4 transition-all ${
                      selectedSubclasses.includes(subclass.id)
                        ? 'border-emerald-500/50 bg-emerald-500/20 shadow-lg'
                        : 'border-slate-600/30 bg-slate-700/30 hover:border-emerald-500/30 hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          {selectedSubclasses.includes(subclass.id) ? (
                            <CheckCircle className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <Circle className="h-5 w-5 text-slate-400" />
                          )}
                          <h4 className="font-semibold text-white">
                            {subclass.name}
                          </h4>
                        </div>
                        <div className="mb-2 text-sm text-slate-400">
                          {subclass.source}
                          {subclass.page && ` • p. ${subclass.page}`}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{subclass.features.length} features</span>
                          {subclass.spellList &&
                            subclass.spellList.length > 0 && (
                              <span className="flex items-center gap-1 rounded border border-purple-500/30 bg-purple-500/20 px-2 py-1 text-purple-300">
                                <BookOpen size={12} />
                                {subclass.spellList.length} spell levels
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subclass Comparison */}
            {selectedSubclassData.length > 0 && (
              <div className="rounded-lg border border-slate-600/50 bg-slate-800/30 p-6 backdrop-blur-sm">
                <h3 className="mb-4 text-xl font-semibold text-white">
                  Comparing {selectedSubclassData.length} Subclass
                  {selectedSubclassData.length > 1 ? 'es' : ''}
                </h3>

                <div className="grid gap-6">
                  {selectedSubclassData.map(subclass => (
                    <div
                      key={subclass.id}
                      className="rounded-lg border border-slate-600/30 p-4"
                    >
                      <h4 className="mb-3 text-lg font-semibold text-white">
                        {subclass.name}
                      </h4>
                      <div className="mb-3 text-sm text-slate-400">
                        {subclass.source}
                        {subclass.page && ` • Page ${subclass.page}`}
                      </div>
                      <div className="space-y-4 text-sm text-slate-300">
                        {/* Spell List */}
                        {subclass.spellList &&
                          subclass.spellList.length > 0 && (
                            <div>
                              <div className="mb-2 flex items-center gap-2 font-medium text-slate-200">
                                <BookOpen
                                  size={16}
                                  className="text-purple-400"
                                />
                                {classData.name === 'Paladin'
                                  ? 'Oath Spells'
                                  : classData.name === 'Cleric'
                                    ? 'Domain Spells'
                                    : classData.name === 'Warlock'
                                      ? 'Expanded Spell List'
                                      : 'Additional Spells'}
                                :
                              </div>
                              <div className="overflow-hidden rounded-lg border border-slate-600/20 bg-slate-700/20">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-slate-600/20">
                                      <th className="p-2 text-left font-medium text-slate-300">
                                        {classData.name} Level
                                      </th>
                                      <th className="p-2 text-left font-medium text-slate-300">
                                        Spells
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {subclass.spellList.map(
                                      (spellLevel, index) => (
                                        <tr
                                          key={index}
                                          className="border-t border-slate-600/20"
                                        >
                                          <td className="p-2 font-medium text-slate-300">
                                            {spellLevel.level}
                                            {spellLevel.level === 1
                                              ? 'st'
                                              : spellLevel.level === 2
                                                ? 'nd'
                                                : spellLevel.level === 3
                                                  ? 'rd'
                                                  : 'th'}
                                          </td>
                                          <td className="p-2 text-slate-400">
                                            {spellLevel.spells.join(', ')}
                                          </td>
                                        </tr>
                                      )
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                        {/* Features */}
                        <div>
                          <div className="mb-2 font-medium text-slate-200">
                            Features:
                          </div>
                          <ul className="space-y-1">
                            {subclass.features.map((feature, index) => (
                              <li key={index} className="text-slate-400">
                                • {feature.name}
                              </li>
                            ))}
                          </ul>
                        </div>
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
