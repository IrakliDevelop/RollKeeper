'use client';

import React, { useMemo } from 'react';
import { ProcessedSpell } from '@/types/spells';
import { useCharacterStore } from '@/store/characterStore';
import { Star, Circle, CheckCircle, Bookmark } from 'lucide-react';
import SpellCard from '@/components/spellbook/SpellCard';

interface PersonalSpellbookProps {
  allSpells: ProcessedSpell[];
  displayMode: 'grid' | 'list';
  sortBy?: 'name' | 'level';
  sortOrder?: 'asc' | 'desc';
}

export default function PersonalSpellbook({
  allSpells,
  displayMode,
  sortBy = 'name',
  sortOrder = 'asc',
}: PersonalSpellbookProps) {
  const {
    character,
    removeSpellFromSpellbook,
    toggleSpellFavorite,
    prepareSpell,
    unprepareSpell,
  } = useCharacterStore();

  // Get the actual spell objects for known, prepared, and favorite spells
  const knownSpells = useMemo(() => {
    return (character.spellbook?.knownSpells || [])
      .map(spellId => allSpells.find(spell => spell.id === spellId))
      .filter((spell): spell is ProcessedSpell => spell !== undefined);
  }, [character.spellbook?.knownSpells, allSpells]);

  const preparedSpells = useMemo(() => {
    return (character.spellbook?.preparedSpells || [])
      .map(spellId => allSpells.find(spell => spell.id === spellId))
      .filter((spell): spell is ProcessedSpell => spell !== undefined);
  }, [character.spellbook?.preparedSpells, allSpells]);

  const favoriteSpells = useMemo(() => {
    return (character.spellbook?.favoriteSpells || [])
      .map(spellId => allSpells.find(spell => spell.id === spellId))
      .filter((spell): spell is ProcessedSpell => spell !== undefined);
  }, [character.spellbook?.favoriteSpells, allSpells]);

  // Sort spells function
  const sortSpells = (spells: ProcessedSpell[]) => {
    return [...spells].sort((a, b) => {
      if (sortBy === 'name') {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? comparison : -comparison;
      } else if (sortBy === 'level') {
        const levelComparison = a.level - b.level;
        if (levelComparison === 0) {
          // If levels are equal, sort by name as secondary
          return a.name.localeCompare(b.name);
        }
        return sortOrder === 'asc' ? levelComparison : -levelComparison;
      }
      return 0;
    });
  };

  // Organize spells by level
  const organizeSpellsByLevel = (spells: ProcessedSpell[]) => {
    const byLevel: { [level: number]: ProcessedSpell[] } = {};
    for (let i = 0; i <= 9; i++) {
      byLevel[i] = [];
    }

    spells.forEach(spell => {
      const level = spell.isCantrip ? 0 : spell.level;
      byLevel[level].push(spell);
    });

    // Sort spells within each level
    for (let level = 0; level <= 9; level++) {
      if (byLevel[level].length > 0) {
        byLevel[level] = sortSpells(byLevel[level]);
      }
    }

    return byLevel;
  };

  const knownByLevel = organizeSpellsByLevel(knownSpells);
  const preparedByLevel = organizeSpellsByLevel(preparedSpells);
  const favoritesByLevel = organizeSpellsByLevel(favoriteSpells);

  // Helper functions
  const isSpellInSpellbook = (spellId: string) =>
    character.spellbook?.knownSpells?.includes(spellId) || false;
  const isSpellFavorite = (spellId: string) =>
    character.spellbook?.favoriteSpells?.includes(spellId) || false;
  const isSpellPrepared = (spellId: string) =>
    character.spellbook?.preparedSpells?.includes(spellId) || false;

  // Tab state
  const [activeTab, setActiveTab] = React.useState<
    'known' | 'prepared' | 'favorites'
  >('known');

  const renderSpellLevel = (level: number, spells: ProcessedSpell[]) => {
    if (spells.length === 0) return null;

    const levelName = level === 0 ? 'Cantrips' : `Level ${level}`;

    return (
      <div key={level} className="mb-12">
        {/* Decorative Level Header */}
        <div className="relative mb-6">
          {/* Top decorative line */}
          <div className="absolute top-1/2 right-0 left-0 z-0 h-px -translate-y-1/2 transform bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

          {/* Level title with background */}
          <div className="relative z-10 flex items-center justify-center">
            <div className="rounded-lg border border-amber-500/30 bg-slate-900/90 px-6 py-3 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-4">
                {/* Level indicator circle */}
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg font-bold ${
                    level === 0
                      ? 'border-slate-400 bg-slate-800/50 text-slate-400'
                      : `border-amber-400 bg-amber-500/10 text-amber-400`
                  }`}
                >
                  {level === 0 ? '∞' : level}
                </div>

                {/* Level name */}
                <h3 className="text-2xl font-bold tracking-wide text-amber-400">
                  {levelName}
                </h3>

                {/* Spell count badge */}
                <div className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-amber-400 opacity-60" />
                  <span className="rounded-full border border-amber-500/30 bg-amber-600/20 px-3 py-1 text-sm font-medium text-amber-300">
                    {spells.length} spell{spells.length !== 1 ? 's' : ''}
                  </span>
                  <div className="h-1 w-1 rounded-full bg-amber-400 opacity-60" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom accent line */}
          <div className="absolute top-1/2 right-1/4 left-1/4 z-0 h-px translate-y-3 transform bg-gradient-to-r from-amber-500/20 via-amber-400/40 to-amber-500/20" />
        </div>

        {/* Spells Grid */}
        <div
          className={
            displayMode === 'grid'
              ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
              : 'space-y-3'
          }
        >
          {spells.map(spell => (
            <SpellCard
              key={spell.id}
              spell={spell}
              displayMode={displayMode}
              isInSpellbook={isSpellInSpellbook(spell.id)}
              isFavorite={isSpellFavorite(spell.id)}
              isPrepared={isSpellPrepared(spell.id)}
              onRemoveFromSpellbook={() => removeSpellFromSpellbook(spell.id)}
              onToggleFavorite={() => toggleSpellFavorite(spell.id)}
              onPrepareSpell={() => prepareSpell(spell.id)}
              onUnprepareSpell={() => unprepareSpell(spell.id)}
            />
          ))}
        </div>

        {/* Section bottom divider (except for last section) */}
        <div className="mt-8 flex items-center justify-center">
          <div className="flex items-center gap-2 opacity-40">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            <div className="h-1 w-1 rounded-full bg-amber-400" />
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            <div className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
        </div>
      </div>
    );
  };

  const getTabData = () => {
    switch (activeTab) {
      case 'known':
        return { spells: knownByLevel, title: 'Known Spells', icon: Circle };
      case 'prepared':
        return {
          spells: preparedByLevel,
          title: 'Prepared Spells',
          icon: CheckCircle,
        };
      case 'favorites':
        return {
          spells: favoritesByLevel,
          title: 'Favorite Spells',
          icon: Star,
        };
      default:
        return { spells: knownByLevel, title: 'Known Spells', icon: Circle };
    }
  };

  const tabData = getTabData();
  const totalSpellsInTab = Object.values(tabData.spells).flat().length;

  if (knownSpells.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Empty State */}
        <div className="rounded-lg border border-slate-600/50 bg-gradient-to-r from-slate-800/50 to-slate-700/50 p-8 text-center">
          <Bookmark className="mx-auto mb-4 h-16 w-16 text-slate-400" />
          <h2 className="mb-2 text-2xl font-bold text-white">
            Your Spellbook is Empty
          </h2>
          <p className="mb-4 text-slate-300">
            Start building your personal spellbook by adding spells from the
            Browse tab.
          </p>
          <p className="text-sm text-slate-400">
            Click the &quot;Add&quot; button on any spell to add it to your
            collection!
          </p>
        </div>

        {/* Getting Started Tips */}
        <div className="rounded-lg border border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6">
          <h3 className="mb-3 text-lg font-semibold text-blue-400">
            💡 Getting Started
          </h3>
          <div className="grid grid-cols-1 gap-4 text-sm text-slate-300 md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-medium text-blue-300">Finding Spells</h4>
              <ul className="space-y-1">
                <li>• Use filters to find spells for your class</li>
                <li>• Search by spell name or description</li>
                <li>• Browse by spell level and school</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-medium text-blue-300">
                Managing Your Spellbook
              </h4>
              <ul className="space-y-1">
                <li>• ⭐ Mark spells as favorites for quick access</li>
                <li>• 📝 Prepare spells for daily use</li>
                <li>• 📚 Build class-specific spell collections</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-2 text-3xl font-bold text-white">
            Personal Spellbook
          </h2>
          <p className="text-slate-300">
            Manage your character&apos;s known spells, preparations, and
            favorites
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-slate-800/50 p-3">
            <div className="text-2xl font-bold text-green-400">
              {knownSpells.length}
            </div>
            <div className="text-xs text-slate-400">Known</div>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-3">
            <div className="text-2xl font-bold text-blue-400">
              {preparedSpells.length}
            </div>
            <div className="text-xs text-slate-400">Prepared</div>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-3">
            <div className="text-2xl font-bold text-yellow-400">
              {favoriteSpells.length}
            </div>
            <div className="text-xs text-slate-400">Favorites</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 rounded-lg bg-slate-800/50 p-1">
        {[
          {
            key: 'known' as const,
            label: 'Known Spells',
            icon: Circle,
            count: knownSpells.length,
          },
          {
            key: 'prepared' as const,
            label: 'Prepared',
            icon: CheckCircle,
            count: preparedSpells.length,
          },
          {
            key: 'favorites' as const,
            label: 'Favorites',
            icon: Star,
            count: favoriteSpells.length,
          },
        ].map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 rounded-md px-4 py-3 transition-all ${
              activeTab === key
                ? 'bg-amber-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Icon
              size={18}
              className={
                activeTab === key && key === 'favorites' ? 'fill-current' : ''
              }
            />
            <span className="font-medium">{label}</span>
            {count > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === key
                    ? 'bg-amber-500/30 text-amber-100'
                    : 'bg-slate-600 text-slate-300'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {totalSpellsInTab > 0 ? (
          <div>
            {Object.entries(tabData.spells)
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              .filter(([_, spells]) => spells.length > 0)
              .map(([level, spells]) =>
                renderSpellLevel(parseInt(level), spells)
              )}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-600/50 bg-slate-800/30 p-12 text-center">
            <tabData.icon className="mx-auto mb-4 h-16 w-16 text-slate-400" />
            <h3 className="mb-2 text-xl font-semibold text-white">
              No {tabData.title}
            </h3>
            <p className="text-slate-400">
              {activeTab === 'known' &&
                'Add spells from the Browse tab to get started.'}
              {activeTab === 'prepared' &&
                'Prepare some spells from your known spells for daily use.'}
              {activeTab === 'favorites' &&
                'Mark spells as favorites to quickly find your most-used spells.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
