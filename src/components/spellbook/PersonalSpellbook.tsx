'use client';

import React, { useMemo } from 'react';
import { ProcessedSpell } from '@/types/spells';
import { useCharacterStore } from '@/store/characterStore';
import { Star, Circle, CheckCircle, Bookmark } from 'lucide-react';
import SpellCard from '@/components/spellbook/SpellCard';
import { Badge } from '@/components/ui/layout/badge';
import { Card, CardContent } from '@/components/ui/layout/card';

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

  const sortSpells = (spells: ProcessedSpell[]) => {
    return [...spells].sort((a, b) => {
      if (sortBy === 'name') {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? comparison : -comparison;
      } else if (sortBy === 'level') {
        const levelComparison = a.level - b.level;
        if (levelComparison === 0) return a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? levelComparison : -levelComparison;
      }
      return 0;
    });
  };

  const organizeSpellsByLevel = (spells: ProcessedSpell[]) => {
    const byLevel: { [level: number]: ProcessedSpell[] } = {};
    for (let i = 0; i <= 9; i++) byLevel[i] = [];
    spells.forEach(spell => {
      const level = spell.isCantrip ? 0 : spell.level;
      byLevel[level].push(spell);
    });
    for (let level = 0; level <= 9; level++) {
      if (byLevel[level].length > 0)
        byLevel[level] = sortSpells(byLevel[level]);
    }
    return byLevel;
  };

  const knownByLevel = organizeSpellsByLevel(knownSpells);
  const preparedByLevel = organizeSpellsByLevel(preparedSpells);
  const favoritesByLevel = organizeSpellsByLevel(favoriteSpells);

  const isSpellInSpellbook = (spellId: string) =>
    character.spellbook?.knownSpells?.includes(spellId) || false;
  const isSpellFavorite = (spellId: string) =>
    character.spellbook?.favoriteSpells?.includes(spellId) || false;
  const isSpellPrepared = (spellId: string) =>
    character.spellbook?.preparedSpells?.includes(spellId) || false;

  const [activeTab, setActiveTab] = React.useState<
    'known' | 'prepared' | 'favorites'
  >('known');

  const renderSpellLevel = (level: number, spells: ProcessedSpell[]) => {
    if (spells.length === 0) return null;
    const levelName = level === 0 ? 'Cantrips' : `Level ${level}`;

    return (
      <div key={level} className="mb-10">
        <div className="mb-5 flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg font-bold ${
              level === 0
                ? 'border-divider bg-surface-secondary text-muted'
                : 'border-accent-purple-border bg-accent-purple-bg text-accent-purple-text'
            }`}
          >
            {level === 0 ? '∞' : level}
          </div>
          <h3 className="text-heading text-xl font-bold">{levelName}</h3>
          <Badge variant="neutral" size="sm">
            {spells.length} spell{spells.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        <div
          className={
            displayMode === 'grid'
              ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
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
      <div className="mx-auto max-w-4xl space-y-6">
        <Card variant="bordered" padding="lg" className="text-center">
          <CardContent className="p-0">
            <Bookmark className="text-muted mx-auto mb-4 h-16 w-16" />
            <h2 className="text-heading mb-2 text-2xl font-bold">
              Your Spellbook is Empty
            </h2>
            <p className="text-body mb-4">
              Start building your personal spellbook by adding spells from the
              Browse tab.
            </p>
            <p className="text-muted text-sm">
              Click the &quot;Add&quot; button on any spell to add it to your
              collection!
            </p>
          </CardContent>
        </Card>

        <Card
          variant="bordered"
          padding="lg"
          className="border-accent-blue-border bg-accent-blue-bg/30"
        >
          <CardContent className="p-0">
            <h3 className="text-accent-blue-text mb-3 text-lg font-semibold">
              Getting Started
            </h3>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <div>
                <h4 className="text-heading mb-2 font-medium">
                  Finding Spells
                </h4>
                <ul className="text-body space-y-1">
                  <li>Use filters to find spells for your class</li>
                  <li>Search by spell name or description</li>
                  <li>Browse by spell level and school</li>
                </ul>
              </div>
              <div>
                <h4 className="text-heading mb-2 font-medium">
                  Managing Your Spellbook
                </h4>
                <ul className="text-body space-y-1">
                  <li>Mark spells as favorites for quick access</li>
                  <li>Prepare spells for daily use</li>
                  <li>Build class-specific spell collections</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header + Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-heading mb-1 text-2xl font-bold sm:text-3xl">
            Personal Spellbook
          </h2>
          <p className="text-body">
            Manage your character&apos;s known spells, preparations, and
            favorites
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Card variant="bordered" padding="sm">
            <CardContent className="p-0">
              <div className="text-accent-emerald-text text-xl font-bold">
                {knownSpells.length}
              </div>
              <div className="text-muted text-xs">Known</div>
            </CardContent>
          </Card>
          <Card variant="bordered" padding="sm">
            <CardContent className="p-0">
              <div className="text-accent-blue-text text-xl font-bold">
                {preparedSpells.length}
              </div>
              <div className="text-muted text-xs">Prepared</div>
            </CardContent>
          </Card>
          <Card variant="bordered" padding="sm">
            <CardContent className="p-0">
              <div className="text-accent-amber-text text-xl font-bold">
                {favoriteSpells.length}
              </div>
              <div className="text-muted text-xs">Favorites</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-divider bg-surface-raised flex gap-1 rounded-xl border p-1">
        {[
          {
            key: 'known' as const,
            label: 'Known',
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
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-accent-purple-bg-strong text-accent-purple-text shadow-sm'
                : 'text-muted hover:bg-surface-hover hover:text-heading'
            }`}
          >
            <Icon
              size={16}
              className={
                activeTab === key && key === 'favorites' ? 'fill-current' : ''
              }
            />
            <span className="hidden sm:inline">{label}</span>
            {count > 0 && (
              <Badge
                variant={activeTab === key ? 'primary' : 'neutral'}
                size="sm"
              >
                {count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
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
        <Card variant="bordered" padding="lg" className="text-center">
          <CardContent className="p-0">
            <tabData.icon className="text-muted mx-auto mb-4 h-16 w-16" />
            <h3 className="text-heading mb-2 text-xl font-semibold">
              No {tabData.title}
            </h3>
            <p className="text-muted">
              {activeTab === 'known' &&
                'Add spells from the Browse tab to get started.'}
              {activeTab === 'prepared' &&
                'Prepare some spells from your known spells for daily use.'}
              {activeTab === 'favorites' &&
                'Mark spells as favorites to quickly find your most-used spells.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
