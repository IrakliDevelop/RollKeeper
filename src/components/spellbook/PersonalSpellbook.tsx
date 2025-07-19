'use client';

import React, { useMemo } from 'react';
import { ProcessedSpell } from '@/types/spells';
import { useCharacterStore } from '@/store/characterStore';
import { Star, Circle, CheckCircle, Bookmark } from 'lucide-react';
import SpellCard from '@/components/spellbook/SpellCard';

interface PersonalSpellbookProps {
  allSpells: ProcessedSpell[];
  displayMode: 'grid' | 'list';
}

export default function PersonalSpellbook({ allSpells, displayMode }: PersonalSpellbookProps) {
  const { 
    character, 
    removeSpellFromSpellbook,
    toggleSpellFavorite,
    prepareSpell,
    unprepareSpell
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
    
    return byLevel;
  };

  const knownByLevel = organizeSpellsByLevel(knownSpells);
  const preparedByLevel = organizeSpellsByLevel(preparedSpells);
  const favoritesByLevel = organizeSpellsByLevel(favoriteSpells);

  // Helper functions
  const isSpellInSpellbook = (spellId: string) => character.spellbook?.knownSpells?.includes(spellId) || false;
  const isSpellFavorite = (spellId: string) => character.spellbook?.favoriteSpells?.includes(spellId) || false;
  const isSpellPrepared = (spellId: string) => character.spellbook?.preparedSpells?.includes(spellId) || false;

  // Tab state
  const [activeTab, setActiveTab] = React.useState<'known' | 'prepared' | 'favorites'>('known');

  const renderSpellLevel = (level: number, spells: ProcessedSpell[], showPreparedStatus: boolean = true) => {
    if (spells.length === 0) return null;

    const levelName = level === 0 ? 'Cantrips' : `Level ${level}`;

    return (
      <div key={level} className="mb-12">
        {/* Decorative Level Header */}
        <div className="relative mb-6">
          {/* Top decorative line */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent transform -translate-y-1/2 z-0" />
          
          {/* Level title with background */}
          <div className="relative flex items-center justify-center z-10">
            <div className="bg-slate-900/90 backdrop-blur-sm px-6 py-3 rounded-lg border border-amber-500/30 shadow-lg">
              <div className="flex items-center gap-4">
                {/* Level indicator circle */}
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold text-lg ${
                  level === 0 
                    ? 'border-slate-400 text-slate-400 bg-slate-800/50' 
                    : `border-amber-400 text-amber-400 bg-amber-500/10`
                }`}>
                  {level === 0 ? '∞' : level}
                </div>
                
                {/* Level name */}
                <h3 className="text-2xl font-bold text-amber-400 tracking-wide">
                  {levelName}
                </h3>
                
                {/* Spell count badge */}
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-amber-400 rounded-full opacity-60" />
                  <span className="px-3 py-1 bg-amber-600/20 text-amber-300 rounded-full text-sm font-medium border border-amber-500/30">
                    {spells.length} spell{spells.length !== 1 ? 's' : ''}
                  </span>
                  <div className="w-1 h-1 bg-amber-400 rounded-full opacity-60" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom accent line */}
          <div className="absolute top-1/2 left-1/4 right-1/4 h-px bg-gradient-to-r from-amber-500/20 via-amber-400/40 to-amber-500/20 transform translate-y-3 z-0" />
        </div>
        
        {/* Spells Grid */}
        <div className={displayMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
          : 'space-y-3'
        }>
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
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            <div className="w-1 h-1 bg-amber-400 rounded-full" />
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
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
        return { spells: preparedByLevel, title: 'Prepared Spells', icon: CheckCircle };
      case 'favorites':
        return { spells: favoritesByLevel, title: 'Favorite Spells', icon: Star };
      default:
        return { spells: knownByLevel, title: 'Known Spells', icon: Circle };
    }
  };

  const tabData = getTabData();
  const totalSpellsInTab = Object.values(tabData.spells).flat().length;

  if (knownSpells.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Empty State */}
        <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600/50 rounded-lg p-8 text-center">
          <Bookmark className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Your Spellbook is Empty</h2>
          <p className="text-slate-300 mb-4">
            Start building your personal spellbook by adding spells from the Browse tab.
          </p>
          <p className="text-sm text-slate-400">
            Click the &quot;Add&quot; button on any spell to add it to your collection!
          </p>
        </div>

        {/* Getting Started Tips */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-400 mb-3">💡 Getting Started</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div>
              <h4 className="font-medium text-blue-300 mb-2">Finding Spells</h4>
              <ul className="space-y-1">
                <li>• Use filters to find spells for your class</li>
                <li>• Search by spell name or description</li>
                <li>• Browse by spell level and school</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-300 mb-2">Managing Your Spellbook</h4>
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
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Personal Spellbook</h2>
          <p className="text-slate-300">
            Manage your character&apos;s known spells, preparations, and favorites
          </p>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-400">{knownSpells.length}</div>
            <div className="text-xs text-slate-400">Known</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-400">{preparedSpells.length}</div>
            <div className="text-xs text-slate-400">Prepared</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-2xl font-bold text-yellow-400">{favoriteSpells.length}</div>
            <div className="text-xs text-slate-400">Favorites</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg">
        {[
          { key: 'known' as const, label: 'Known Spells', icon: Circle, count: knownSpells.length },
          { key: 'prepared' as const, label: 'Prepared', icon: CheckCircle, count: preparedSpells.length },
          { key: 'favorites' as const, label: 'Favorites', icon: Star, count: favoriteSpells.length }
        ].map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 rounded-md transition-all ${
              activeTab === key
                ? 'bg-amber-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Icon size={18} className={activeTab === key && key === 'favorites' ? 'fill-current' : ''} />
            <span className="font-medium">{label}</span>
            {count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === key 
                  ? 'bg-amber-500/30 text-amber-100' 
                  : 'bg-slate-600 text-slate-300'
              }`}>
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
              .filter(([_, spells]) => spells.length > 0)
              .map(([level, spells]) => renderSpellLevel(parseInt(level), spells))
            }
          </div>
        ) : (
          <div className="bg-slate-800/30 border border-slate-600/50 rounded-lg p-12 text-center">
            <tabData.icon className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No {tabData.title}</h3>
            <p className="text-slate-400">
              {activeTab === 'known' && 'Add spells from the Browse tab to get started.'}
              {activeTab === 'prepared' && 'Prepare some spells from your known spells for daily use.'}
              {activeTab === 'favorites' && 'Mark spells as favorites to quickly find your most-used spells.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 