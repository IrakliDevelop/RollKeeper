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
  full: 'text-accent-purple-text bg-accent-purple-bg border-accent-purple-border',
  half: 'text-accent-blue-text bg-accent-blue-bg border-accent-blue-border',
  third: 'text-accent-blue-text bg-accent-blue-bg border-accent-blue-border',
  warlock:
    'text-accent-purple-text bg-accent-purple-bg border-accent-purple-border',
  none: 'text-muted bg-surface-secondary border-divider',
};

const HIT_DIE_COLORS = {
  d6: 'text-accent-red-text bg-accent-red-bg border-accent-red-border',
  d8: 'text-accent-orange-text bg-accent-orange-bg border-accent-orange-border',
  d10: 'text-accent-amber-text bg-accent-amber-bg border-accent-amber-border',
  d12: 'text-accent-emerald-text bg-accent-emerald-bg border-accent-emerald-border',
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

  const isFlavorText = (feature: ClassFeature): boolean => {
    if (classData.name !== 'Paladin' || !feature.isSubclassFeature)
      return false;

    const featureName = feature.name.toLowerCase();
    const contentText = feature.entries?.join(' ').toLowerCase() || '';

    const isExplicitTenet =
      featureName.includes('tenet') ||
      (featureName.includes('oath') && !featureName.includes('spell'));

    const tenetIndicators = ['tenet', 'sworn to', 'guide you', 'follow these'];
    const principleIndicators = ['principle', 'ideal', 'creed', 'belief'];

    const hasTenetContent = tenetIndicators.some(indicator =>
      contentText.includes(indicator)
    );
    const hasPrincipleContent = principleIndicators.some(indicator =>
      contentText.includes(indicator)
    );

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

  const groupedFeaturesWithSubclasses = { ...groupedFeatures };
  selectedSubclassData.forEach(subclass => {
    subclass.features.forEach(feature => {
      if (!groupedFeaturesWithSubclasses[feature.level]) {
        groupedFeaturesWithSubclasses[feature.level] = [];
      }
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
        className="border-divider bg-surface-raised rounded-xl border p-6 shadow-xl backdrop-blur-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="border-accent-purple-border bg-accent-purple-bg flex h-10 w-10 items-center justify-center rounded-lg border">
            <span className="text-accent-purple-text text-lg font-bold">
              {level}
            </span>
          </div>
          <h3 className="text-heading text-xl font-bold">Level {level}</h3>
          {level === 1 && (
            <span className="border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text rounded-full border px-3 py-1 text-sm">
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
                    ? 'border-accent-amber-border bg-accent-amber-bg hover:bg-accent-amber-bg'
                    : feature.isSubclassFeature
                      ? 'border-accent-emerald-border bg-accent-emerald-bg hover:bg-accent-emerald-bg'
                      : 'border-divider bg-surface-secondary hover:bg-surface-hover'
                }`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <h4 className="text-heading text-lg font-semibold">
                        {feature.name}
                      </h4>
                      {feature.isSubclassFeature && (
                        <span
                          className={`rounded border px-2 py-1 text-xs ${
                            isFlavorFeature
                              ? 'border-accent-amber-border bg-accent-amber-bg text-accent-amber-text'
                              : 'border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text'
                          }`}
                        >
                          {feature.subclassShortName || 'Subclass'}
                        </span>
                      )}
                      {isFlavorFeature && (
                        <span className="border-accent-amber-border bg-accent-amber-bg text-accent-amber-text rounded border px-2 py-1 text-xs">
                          Flavor
                        </span>
                      )}
                    </div>

                    <div className="text-muted flex items-center gap-4 text-sm">
                      {feature.source && (
                        <span>
                          Source:{' '}
                          <span className="text-body">{feature.source}</span>
                        </span>
                      )}
                      <span>Level {feature.level}</span>
                    </div>
                  </div>

                  <div className="text-faint flex items-center gap-2 text-xs">
                    <Zap
                      size={14}
                      className={
                        feature.isSubclassFeature
                          ? 'text-accent-emerald-text'
                          : 'text-accent-purple-text'
                      }
                    />
                    <span>Lv. {level}</span>
                  </div>
                </div>

                {feature.entries && feature.entries.length > 0 && (
                  <div className="border-divider border-t pt-4">
                    {isFlavorFeature ? (
                      <div>
                        <button
                          onClick={() => toggleTenetCollapse(featureId)}
                          className="hover:bg-accent-amber-bg mb-3 flex min-h-[44px] w-full items-center gap-2 rounded p-2 text-left transition-colors"
                        >
                          <div
                            className={`transform transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                          >
                            <svg
                              className="text-accent-amber-text h-4 w-4"
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
                          <span className="text-accent-amber-text font-medium">
                            {isCollapsed ? 'Show' : 'Hide'} Oath Details
                          </span>
                          <span className="text-accent-amber-text ml-auto text-xs opacity-60">
                            (Flavor Text - Not Mechanically Required)
                          </span>
                        </button>

                        {!isCollapsed && (
                          <div className="border-accent-amber-border bg-accent-amber-bg rounded-lg border p-4">
                            <div className="prose prose-invert prose-sm max-w-none">
                              {feature.entries.map((entry, entryIndex) => (
                                <div
                                  key={entryIndex}
                                  className="text-accent-amber-text mb-3 leading-relaxed"
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
                            className="text-body mb-3 leading-relaxed"
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
      <div className="border-divider bg-surface-raised rounded-xl border p-6 shadow-xl backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="border-accent-blue-border bg-accent-blue-bg flex h-10 w-10 items-center justify-center rounded-lg border">
            <Book className="text-accent-blue-text h-5 w-5" />
          </div>
          <h3 className="text-heading text-2xl font-bold">Level Progression</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-divider border-b">
                <th className="text-body p-3 text-left font-semibold">Level</th>
                <th className="text-body p-3 text-left font-semibold">
                  Proficiency Bonus
                </th>
                <th className="text-body p-3 text-left font-semibold">
                  Features
                </th>
                {classData.spellcasting.type !== 'none' && (
                  <>
                    <th className="text-body p-3 text-center font-semibold">
                      Cantrips
                    </th>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(spellLevel => (
                      <th
                        key={spellLevel}
                        className="text-body p-3 text-center font-semibold"
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
                    className={`border-divider hover:bg-surface-hover border-b transition-colors ${
                      level === 1 ? 'bg-accent-emerald-bg' : ''
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            level === 1
                              ? 'border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text border'
                              : 'bg-surface-secondary text-body'
                          }`}
                        >
                          {level}
                        </div>
                        {level === 1 && (
                          <span className="text-accent-emerald-text text-xs">
                            Start
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="text-body p-3 font-medium">
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
                                    ? 'text-accent-emerald-text'
                                    : 'text-body'
                                }`}
                              >
                                {feature.name}
                              </span>
                              {feature.isSubclassFeature && (
                                <span className="border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text rounded border px-1 py-0.5 text-xs">
                                  Sub
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-faint text-xs">—</span>
                      )}
                    </td>

                    {classData.spellcasting.type !== 'none' && (
                      <>
                        <td className="text-body p-3 text-center">
                          {cantrips || '—'}
                        </td>

                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(spellLevel => (
                          <td
                            key={spellLevel}
                            className="text-body p-3 text-center"
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

        <div className="border-divider mt-6 border-t pt-4">
          <div className="text-muted flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="border-accent-emerald-border bg-accent-emerald-bg h-3 w-3 rounded border"></div>
              <span>Subclass Feature</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-surface-secondary h-3 w-3 rounded"></div>
              <span>Class Feature</span>
            </div>
            {classData.spellcasting.type !== 'none' && (
              <div className="flex items-center gap-2">
                <Book size={12} className="text-accent-purple-text" />
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
        <div className="border-divider bg-surface-raised rounded-lg border p-6 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-3">
            <Heart className="text-accent-red-text h-6 w-6" />
            <h3 className="text-heading text-lg font-semibold">Hit Die</h3>
          </div>
          <div
            className={`rounded-lg border px-4 py-2 text-2xl font-bold ${hitDieColorClass} inline-block`}
          >
            {classData.hitDie}
          </div>
        </div>

        {/* Spellcasting */}
        <div className="border-divider bg-surface-raised rounded-lg border p-6 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-3">
            <Star className="text-accent-purple-text h-6 w-6" />
            <h3 className="text-heading text-lg font-semibold">Spellcasting</h3>
          </div>
          <div
            className={`rounded-lg border px-3 py-2 text-lg font-medium ${spellcastingColorClass} inline-block`}
          >
            {formatSpellcastingType(classData.spellcasting.type)}
          </div>
          {classData.spellcasting.ability && (
            <div className="text-muted mt-2 text-sm">
              Ability:{' '}
              <span className="text-accent-emerald-text">
                {formatSpellcastingAbility(classData.spellcasting.ability)}
              </span>
            </div>
          )}
        </div>

        {/* Saving Throws */}
        <div className="border-divider bg-surface-raised rounded-lg border p-6 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-3">
            <Brain className="text-accent-blue-text h-6 w-6" />
            <h3 className="text-heading text-lg font-semibold">
              Saving Throws
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {classData.proficiencies.savingThrows?.map(ability => (
              <span
                key={ability}
                className="border-accent-blue-border bg-accent-blue-bg text-accent-blue-text rounded-lg border px-3 py-1 text-sm"
              >
                {formatProficiencyType(ability)}
              </span>
            )) || <span className="text-muted">None</span>}
          </div>
        </div>

        {/* Subclasses */}
        <div className="border-divider bg-surface-raised rounded-lg border p-6 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-3">
            <Users className="text-accent-emerald-text h-6 w-6" />
            <h3 className="text-heading text-lg font-semibold">Subclasses</h3>
          </div>
          <div className="text-accent-emerald-text text-2xl font-bold">
            {classData.subclasses.length}
          </div>
          <div className="text-muted mt-1 text-sm">
            {selectedSubclasses.length} selected for comparison
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-divider bg-surface-raised flex space-x-1 rounded-lg border p-1 shadow-lg backdrop-blur-sm">
        {[
          { key: 'overview' as const, label: 'Overview', icon: Info },
          { key: 'features' as const, label: 'Class Features', icon: Zap },
          { key: 'subclasses' as const, label: 'Subclasses', icon: Users },
          { key: 'progression' as const, label: 'Progression', icon: Book },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex min-h-[44px] items-center gap-3 rounded-md px-6 py-4 font-medium transition-all ${
              activeTab === key
                ? 'bg-accent-emerald-bg text-heading scale-[1.02] transform shadow-lg'
                : 'text-body hover:bg-surface-hover hover:text-heading'
            }`}
          >
            <Icon size={20} />
            <span>{label}</span>
            {activeTab === key && (
              <div className="bg-accent-emerald-text h-2 w-2 animate-pulse rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Proficiencies */}
            <div className="border-divider bg-surface-raised rounded-xl border p-8 shadow-xl backdrop-blur-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="border-accent-emerald-border bg-accent-emerald-bg flex h-10 w-10 items-center justify-center rounded-lg border">
                  <Sword className="text-accent-emerald-text h-5 w-5" />
                </div>
                <h3 className="text-heading text-2xl font-bold">
                  Proficiencies
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                {/* Armor */}
                {classData.proficiencies.armor &&
                  classData.proficiencies.armor.length > 0 && (
                    <div className="border-divider bg-surface-secondary hover:bg-surface-hover rounded-lg border p-4 transition-colors">
                      <div className="mb-3 flex items-center gap-2">
                        <Shield className="text-accent-blue-text h-4 w-4" />
                        <h4 className="text-body font-semibold">Armor</h4>
                      </div>
                      <div className="space-y-2">
                        {classData.proficiencies.armor.map((item, index) => (
                          <div
                            key={index}
                            className="text-body flex items-center gap-2 text-sm"
                          >
                            <div className="bg-accent-blue-text h-1.5 w-1.5 rounded-full"></div>
                            <span dangerouslySetInnerHTML={{ __html: item }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Weapons */}
                {classData.proficiencies.weapons &&
                  classData.proficiencies.weapons.length > 0 && (
                    <div className="border-divider bg-surface-secondary hover:bg-surface-hover rounded-lg border p-4 transition-colors">
                      <div className="mb-3 flex items-center gap-2">
                        <Sword className="text-accent-red-text h-4 w-4" />
                        <h4 className="text-body font-semibold">Weapons</h4>
                      </div>
                      <div className="space-y-2">
                        {classData.proficiencies.weapons.map((item, index) => (
                          <div
                            key={index}
                            className="text-body flex items-center gap-2 text-sm"
                          >
                            <div className="bg-accent-red-text h-1.5 w-1.5 rounded-full"></div>
                            <span dangerouslySetInnerHTML={{ __html: item }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Tools */}
                {classData.proficiencies.tools &&
                  classData.proficiencies.tools.length > 0 && (
                    <div className="border-divider bg-surface-secondary hover:bg-surface-hover rounded-lg border p-4 transition-colors">
                      <div className="mb-3 flex items-center gap-2">
                        <Zap className="text-accent-amber-text h-4 w-4" />
                        <h4 className="text-body font-semibold">Tools</h4>
                      </div>
                      <div className="space-y-2">
                        {classData.proficiencies.tools.map((item, index) => (
                          <div
                            key={index}
                            className="text-body flex items-center gap-2 text-sm"
                          >
                            <div className="bg-accent-amber-text h-1.5 w-1.5 rounded-full"></div>
                            <span dangerouslySetInnerHTML={{ __html: item }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Skills */}
                {classData.proficiencies.skillChoices && (
                  <div className="border-divider bg-surface-secondary hover:bg-surface-hover rounded-lg border p-4 transition-colors">
                    <div className="mb-3 flex items-center gap-2">
                      <Brain className="text-accent-purple-text h-4 w-4" />
                      <h4 className="text-body font-semibold">Skills</h4>
                    </div>
                    <div className="mb-2">
                      <span className="border-accent-purple-border bg-accent-purple-bg text-accent-purple-text rounded border px-2 py-1 text-xs">
                        Choose {classData.proficiencies.skillChoices.count}
                      </span>
                    </div>
                    <div className="max-h-32 space-y-2 overflow-y-auto">
                      {classData.proficiencies.skillChoices.from.map(
                        (skill, index) => (
                          <div
                            key={index}
                            className="text-body flex items-center gap-2 text-sm"
                          >
                            <div className="bg-accent-purple-text h-1.5 w-1.5 rounded-full"></div>
                            <span dangerouslySetInnerHTML={{ __html: skill }} />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Starting Equipment */}
            {classData.startingEquipment &&
              classData.startingEquipment.length > 0 && (
                <div className="border-divider bg-surface-raised rounded-xl border p-8 shadow-xl backdrop-blur-sm">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="border-accent-amber-border bg-accent-amber-bg flex h-10 w-10 items-center justify-center rounded-lg border">
                      <div className="text-accent-amber-text font-bold">⚔️</div>
                    </div>
                    <h3 className="text-heading text-2xl font-bold">
                      Starting Equipment
                    </h3>
                  </div>
                  <div className="grid gap-4">
                    {classData.startingEquipment.map((item, index) => (
                      <div
                        key={index}
                        className="border-divider bg-surface-secondary hover:bg-surface-hover flex items-start gap-3 rounded-lg border p-4 transition-colors"
                      >
                        <div className="bg-accent-emerald-text mt-2 h-2 w-2 shrink-0 rounded-full"></div>
                        <div
                          className="text-body leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: item }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Multiclassing */}
            {classData.multiclassing && (
              <div className="border-divider bg-surface-raised rounded-xl border p-8 shadow-xl backdrop-blur-sm">
                <div className="mb-6 flex items-center gap-3">
                  <div className="border-accent-blue-border bg-accent-blue-bg flex h-10 w-10 items-center justify-center rounded-lg border">
                    <Users className="text-accent-blue-text h-5 w-5" />
                  </div>
                  <h3 className="text-heading text-2xl font-bold">
                    Multiclassing
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  {/* Requirements */}
                  {Object.keys(classData.multiclassing.requirements).length >
                    0 && (
                    <div className="border-divider bg-surface-secondary rounded-lg border p-6">
                      <div className="mb-4 flex items-center gap-2">
                        <CheckCircle className="text-accent-emerald-text h-5 w-5" />
                        <h4 className="text-body text-lg font-semibold">
                          Prerequisites
                        </h4>
                      </div>
                      <div className="space-y-3">
                        {Object.entries(
                          classData.multiclassing.requirements
                        ).map(([ability, score]) => (
                          <div
                            key={ability}
                            className="border-divider bg-surface-secondary flex items-center justify-between rounded border p-3"
                          >
                            <span className="text-body font-medium capitalize">
                              {ability}
                            </span>
                            <span className="text-accent-emerald-text text-lg font-bold">
                              {score}+
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proficiencies Gained */}
                  <div className="border-divider bg-surface-secondary rounded-lg border p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <Star className="text-accent-amber-text h-5 w-5" />
                      <h4 className="text-body text-lg font-semibold">
                        Proficiencies Gained
                      </h4>
                    </div>
                    <div className="space-y-4">
                      {classData.multiclassing.proficienciesGained.armor &&
                        classData.multiclassing.proficienciesGained.armor
                          .length > 0 && (
                          <div className="border-divider bg-surface-secondary rounded border p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <Shield className="text-accent-blue-text h-4 w-4" />
                              <span className="text-body font-medium">
                                Armor
                              </span>
                            </div>
                            <div
                              className="text-muted"
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
                          <div className="border-divider bg-surface-secondary rounded border p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <Sword className="text-accent-red-text h-4 w-4" />
                              <span className="text-body font-medium">
                                Weapons
                              </span>
                            </div>
                            <div
                              className="text-muted"
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
                          <div className="border-divider bg-surface-secondary rounded border p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <Zap className="text-accent-amber-text h-4 w-4" />
                              <span className="text-body font-medium">
                                Tools
                              </span>
                            </div>
                            <div
                              className="text-muted"
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
            {/* Subclass Spell Lists */}
            {selectedSubclassData.length > 0 &&
              selectedSubclassData.some(
                sub => sub.spellList && sub.spellList.length > 0
              ) && (
                <div className="border-accent-purple-border bg-accent-purple-bg rounded-xl border p-6 shadow-xl backdrop-blur-sm">
                  <h3 className="text-heading mb-4 flex items-center gap-2 text-xl font-bold">
                    <BookOpen className="text-accent-purple-text h-6 w-6" />
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
                        <h4 className="text-accent-purple-text mb-3 flex items-center gap-2 text-lg font-semibold">
                          <Star size={16} className="text-accent-purple-text" />
                          {subclass.name}
                        </h4>
                        <div className="border-divider bg-surface-raised overflow-hidden rounded-lg border">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-surface-secondary">
                                <th className="text-body p-3 text-left font-medium">
                                  {classData.name} Level
                                </th>
                                <th className="text-body p-3 text-left font-medium">
                                  Spells
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {subclass.spellList!.map((spellLevel, index) => (
                                <tr
                                  key={index}
                                  className="border-divider hover:bg-surface-hover border-t transition-colors"
                                >
                                  <td className="text-accent-purple-text p-3 font-semibold">
                                    {spellLevel.level}
                                    {spellLevel.level === 1
                                      ? 'st'
                                      : spellLevel.level === 2
                                        ? 'nd'
                                        : spellLevel.level === 3
                                          ? 'rd'
                                          : 'th'}
                                  </td>
                                  <td className="text-body p-3">
                                    <div className="flex flex-wrap gap-1">
                                      {spellLevel.spells.map(
                                        (spell, spellIndex) => (
                                          <span
                                            key={spellIndex}
                                            className="border-accent-purple-border bg-accent-purple-bg text-accent-purple-text rounded border px-2 py-1 text-sm"
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
                <div className="border-accent-blue-border bg-accent-blue-bg rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      <Info className="text-accent-blue-text h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-accent-blue-text mb-1 font-medium">
                        {classData.name === 'Paladin'
                          ? 'Oath Spells Available'
                          : classData.name === 'Cleric'
                            ? 'Domain Spells Available'
                            : classData.name === 'Warlock'
                              ? 'Expanded Spell Lists Available'
                              : 'Additional Spells Available'}
                      </h4>
                      <p className="text-accent-blue-text text-sm">
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
            <div className="border-divider bg-surface-raised rounded-lg border p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-heading text-xl font-semibold">
                  Choose Subclasses to Compare
                </h3>
                {selectedSubclasses.length > 0 && (
                  <button
                    onClick={() => setSelectedSubclasses([])}
                    className="text-muted hover:text-heading min-h-[44px] text-sm transition-colors"
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
                        ? 'border-accent-emerald-border bg-accent-emerald-bg shadow-lg'
                        : 'border-divider bg-surface-secondary hover:border-accent-emerald-border hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          {selectedSubclasses.includes(subclass.id) ? (
                            <CheckCircle className="text-accent-emerald-text h-5 w-5" />
                          ) : (
                            <Circle className="text-muted h-5 w-5" />
                          )}
                          <h4 className="text-heading font-semibold">
                            {subclass.name}
                          </h4>
                        </div>
                        <div className="text-muted mb-2 text-sm">
                          {subclass.source}
                          {subclass.page && ` • p. ${subclass.page}`}
                        </div>
                        <div className="text-faint flex items-center gap-2 text-xs">
                          <span>{subclass.features.length} features</span>
                          {subclass.spellList &&
                            subclass.spellList.length > 0 && (
                              <span className="border-accent-purple-border bg-accent-purple-bg text-accent-purple-text flex items-center gap-1 rounded border px-2 py-1">
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
              <div className="border-divider bg-surface-raised rounded-lg border p-6 backdrop-blur-sm">
                <h3 className="text-heading mb-4 text-xl font-semibold">
                  Comparing {selectedSubclassData.length} Subclass
                  {selectedSubclassData.length > 1 ? 'es' : ''}
                </h3>

                <div className="grid gap-6">
                  {selectedSubclassData.map(subclass => (
                    <div
                      key={subclass.id}
                      className="border-divider rounded-lg border p-4"
                    >
                      <h4 className="text-heading mb-3 text-lg font-semibold">
                        {subclass.name}
                      </h4>
                      <div className="text-muted mb-3 text-sm">
                        {subclass.source}
                        {subclass.page && ` • Page ${subclass.page}`}
                      </div>
                      <div className="text-body space-y-4 text-sm">
                        {/* Spell List */}
                        {subclass.spellList &&
                          subclass.spellList.length > 0 && (
                            <div>
                              <div className="text-body mb-2 flex items-center gap-2 font-medium">
                                <BookOpen
                                  size={16}
                                  className="text-accent-purple-text"
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
                              <div className="border-divider bg-surface-secondary overflow-hidden rounded-lg border">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-surface-secondary">
                                      <th className="text-body p-2 text-left font-medium">
                                        {classData.name} Level
                                      </th>
                                      <th className="text-body p-2 text-left font-medium">
                                        Spells
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {subclass.spellList.map(
                                      (spellLevel, index) => (
                                        <tr
                                          key={index}
                                          className="border-divider border-t"
                                        >
                                          <td className="text-body p-2 font-medium">
                                            {spellLevel.level}
                                            {spellLevel.level === 1
                                              ? 'st'
                                              : spellLevel.level === 2
                                                ? 'nd'
                                                : spellLevel.level === 3
                                                  ? 'rd'
                                                  : 'th'}
                                          </td>
                                          <td className="text-muted p-2">
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
                          <div className="text-body mb-2 font-medium">
                            Features:
                          </div>
                          <ul className="space-y-1">
                            {subclass.features.map((feature, index) => (
                              <li key={index} className="text-muted">
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
          <div className="space-y-6">{renderProgressionTable()}</div>
        )}
      </div>
    </div>
  );
}
