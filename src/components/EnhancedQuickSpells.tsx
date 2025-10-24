'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Dice6,
  Wand2,
  Search,
  ChevronDown,
  ChevronRight,
  Star,
  Heart,
  Grid3X3,
  List,
} from 'lucide-react';
import { useCharacterStore } from '@/store/characterStore';
import { Spell } from '@/types/character';
import {
  calculateSpellAttackBonus,
  calculateSpellSaveDC,
  getCharacterSpellcastingAbility,
  rollDamage,
} from '@/utils/calculations';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import { RollSummary } from '@/types/dice';

interface EnhancedQuickSpellsProps {
  showAttackRoll: (
    weaponName: string,
    roll: number,
    bonus: number,
    isCrit: boolean,
    damage?: string,
    damageType?: string
  ) => void;
  showSavingThrow: (
    spellName: string,
    saveDC: number,
    saveType?: string,
    damage?: string,
    damageType?: string
  ) => void;
  showDamageRoll: (
    weaponName: string,
    damageRoll: string,
    damageType?: string,
    versatile?: boolean
  ) => void;
  animateRoll?: (notation: string) => Promise<unknown> | void;
}

interface SpellsByLevel {
  [level: number]: Spell[];
}

interface LevelSectionProps {
  level: number;
  spells: Spell[];
  isExpanded: boolean;
  onToggle: () => void;
  compactView: boolean;
  spellSaveDC: number | null;
  onSpellAction: (spell: Spell, action: string) => void;
  favoriteSpells: string[];
  onToggleFavorite: (spellId: string) => void;
}

const SpellCard: React.FC<{
  spell: Spell;
  compact: boolean;
  isFavorite: boolean;
  spellSaveDC: number | null;
  onAction: (action: string) => void;
  onToggleFavorite: () => void;
}> = ({ spell, compact, isFavorite, spellSaveDC, onAction, onToggleFavorite }) => {
  if (compact) {
    return (
      <div className="group flex items-center justify-between rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50 p-2 hover:shadow-md transition-all duration-200">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={onToggleFavorite}
            className={`flex-shrink-0 transition-colors ${
              isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'
            }`}
          >
            <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <div
            className={`h-2 w-2 rounded-full flex-shrink-0 ${
              spell.level === 0 ? 'bg-yellow-400' : 'bg-purple-400'
            }`}
          />
          <span className="font-medium text-purple-900 truncate text-sm">
            {spell.name}
          </span>
          {spell.concentration && (
            <span className="text-xs text-orange-600 flex-shrink-0">⏱</span>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => onAction('cast')}
            className="rounded bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-700 transition-colors"
            title="Cast spell"
          >
            <Wand2 size={12} />
          </button>
          {spell.actionType === 'attack' && (
            <button
              onClick={() => onAction('attack')}
              className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-700 transition-colors"
              title="Attack roll"
            >
              <Dice6 size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50 p-3 hover:shadow-md transition-all duration-200">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFavorite}
            className={`transition-colors ${
              isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'
            }`}
          >
            <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <div
            className={`h-2 w-2 rounded-full ${
              spell.level === 0 ? 'bg-yellow-400' : 'bg-purple-400'
            }`}
          />
          <span className="font-semibold text-purple-900">{spell.name}</span>
          <span className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700">
            {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
          </span>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs text-purple-600">
        <span>{spell.castingTime}</span>
        <span>•</span>
        <span>{spell.range}</span>
        {spell.concentration && (
          <>
            <span>•</span>
            <span className="text-orange-600">Concentration</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onAction('cast')}
          className="group flex transform items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-3 py-2 text-sm font-medium text-white shadow-md transition-all duration-200 hover:scale-105 hover:from-purple-700 hover:to-violet-700 hover:shadow-lg"
        >
          <Wand2 size={14} className="transition-transform group-hover:rotate-12" />
          Cast
        </button>

        {spell.actionType === 'attack' && (
          <button
            onClick={() => onAction('attack')}
            className="group flex transform items-center gap-2 rounded-lg bg-gradient-to-r from-slate-600 to-slate-700 px-3 py-2 text-sm font-medium text-white shadow-md transition-all duration-200 hover:scale-105 hover:from-slate-700 hover:to-slate-800 hover:shadow-lg"
          >
            <Dice6 size={14} className="transition-transform group-hover:rotate-12" />
            Attack
          </button>
        )}

        {/* Show spell info for reference */}
        {(spell.actionType === 'save' || spell.damage) && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            {spell.actionType === 'save' && spell.savingThrow && (
              <span className="rounded-lg border border-blue-300 bg-gradient-to-r from-blue-100 to-blue-200 px-2 py-1 font-medium shadow-sm">
                {spell.savingThrow} Save DC {spellSaveDC || '?'}
              </span>
            )}
            {spell.damage && (
              <span className="rounded-lg border border-amber-300 bg-gradient-to-r from-amber-100 to-amber-200 px-2 py-1 font-medium shadow-sm">
                {spell.damage} {spell.damageType && `${spell.damageType}`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const LevelSection: React.FC<LevelSectionProps> = ({
  level,
  spells,
  isExpanded,
  onToggle,
  compactView,
  spellSaveDC,
  onSpellAction,
  favoriteSpells,
  onToggleFavorite,
}) => {
  const levelName = level === 0 ? 'Cantrips' : `Level ${level}`;
  const levelColor = level === 0 ? 'text-yellow-600' : 'text-purple-600';
  const levelBg = level === 0 ? 'bg-yellow-50' : 'bg-purple-50';

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-3 ${levelBg} hover:bg-opacity-80 transition-colors`}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className={`font-semibold ${levelColor}`}>{levelName}</span>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-gray-600">
            {spells.length}
          </span>
        </div>
      </button>
      
      {isExpanded && (
        <div className="p-3 bg-white">
          <div className={compactView ? 'space-y-2' : 'space-y-3'}>
            {spells.map(spell => (
              <SpellCard
                key={spell.id}
                spell={spell}
                compact={compactView}
                isFavorite={favoriteSpells.includes(spell.id)}
                spellSaveDC={spellSaveDC}
                onAction={(action) => onSpellAction(spell, action)}
                onToggleFavorite={() => onToggleFavorite(spell.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export function EnhancedQuickSpells({
  showAttackRoll: showAttackToast,
  showSavingThrow: showSaveToast,
  showDamageRoll,
  animateRoll,
}: EnhancedQuickSpellsProps) {
  const {
    character,
    updateSpellSlot,
    startConcentration,
    stopConcentration,
    toggleSpellFavorite,
  } = useCharacterStore();

  // Local state
  const [castModalOpen, setCastModalOpen] = useState(false);
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [compactView, setCompactView] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set([0, 1, 2])); // Default: cantrips and levels 1-2 expanded

  // Get spellcasting stats
  const spellcastingAbility = getCharacterSpellcastingAbility(character);
  const spellAttackBonus = calculateSpellAttackBonus(character);
  const spellSaveDC = calculateSpellSaveDC(character);

  // Get all available spells for quick access (prepared cantrips + prepared spells)
  const quickAccessSpells = character.spells.filter(
    spell =>
      (spell.level === 0 && spell.isPrepared) || // Only prepared cantrips
      (spell.level > 0 && spell.isPrepared) || // Prepared spells
      spell.isAlwaysPrepared // Always prepared spells
  );

  // Show all prepared spells in quick access (not just action spells)
  const actionSpells = quickAccessSpells;

  // Filter by search query
  const filteredSpells = useMemo(() => {
    if (!searchQuery.trim()) return actionSpells;
    
    const query = searchQuery.toLowerCase();
    return actionSpells.filter(spell =>
      spell.name.toLowerCase().includes(query) ||
      spell.school.toLowerCase().includes(query) ||
      spell.damageType?.toLowerCase().includes(query)
    );
  }, [actionSpells, searchQuery]);

  // Organize spells by level
  const spellsByLevel = useMemo(() => {
    const organized: SpellsByLevel = {};
    
    filteredSpells.forEach(spell => {
      if (!organized[spell.level]) {
        organized[spell.level] = [];
      }
      organized[spell.level].push(spell);
    });

    // Sort spells within each level by name
    Object.keys(organized).forEach(level => {
      organized[parseInt(level)].sort((a, b) => a.name.localeCompare(b.name));
    });

    return organized;
  }, [filteredSpells]);

  // Get favorite spells
  const favoriteSpells = useMemo(() => {
    return character.spellbook?.favoriteSpells || [];
  }, [character.spellbook?.favoriteSpells]);
  
  const favoriteActionSpells = useMemo(() => {
    return actionSpells.filter(spell => favoriteSpells.includes(spell.id));
  }, [actionSpells, favoriteSpells]);

  // Spell action handlers
  const rollSpellAttack = async (spell: Spell) => {
    if (spellAttackBonus === null) {
      alert('Cannot cast spells - no spellcasting ability detected');
      return;
    }

    if (animateRoll) {
      try {
        const rollResult = await animateRoll('1d20');
        if (rollResult && typeof rollResult === 'object' && 'individualValues' in rollResult) {
          const summary = rollResult as RollSummary;
          const roll = summary.individualValues[0] || 1;
          const isCrit = roll === 20;
          showAttackToast(spell.name, roll, spellAttackBonus, isCrit, spell.damage, spell.damageType);
          return;
        }
      } catch (error) {
        console.warn('Dice animation failed, falling back to random roll:', error);
      }
    }

    const roll = Math.floor(Math.random() * 20) + 1;
    const isCrit = roll === 20;
    showAttackToast(spell.name, roll, spellAttackBonus, isCrit, spell.damage, spell.damageType);
  };

  const showSavingThrow = async (spell: Spell) => {
    if (spellSaveDC === null) {
      alert('Cannot cast spells - no spellcasting ability detected');
      return;
    }
    showSaveToast(spell.name, spellSaveDC, spell.savingThrow, spell.damage, spell.damageType);
  };

  const rollSpellDamage = async (spell: Spell) => {
    if (!spell.damage) {
      alert('This spell does not have damage dice specified');
      return;
    }

    if (animateRoll) {
      try {
        const rollResult = await animateRoll(spell.damage);
        if (rollResult && typeof rollResult === 'object' && 'finalTotal' in rollResult) {
          const summary = rollResult as RollSummary;
          const damageResult = `${summary.finalTotal}`;
          showDamageRoll(spell.name, damageResult, spell.damageType);
          return;
        }
      } catch (error) {
        console.warn('Dice animation failed, falling back to calculated roll:', error);
      }
    }

    const damageResult = rollDamage(spell.damage);
    showDamageRoll(spell.name, damageResult, spell.damageType);
  };

  const openCastModal = (spell: Spell) => {
    setSelectedSpell(spell);
    setCastModalOpen(true);
  };

  const handleSpellAction = (spell: Spell, action: string) => {
    switch (action) {
      case 'cast':
        openCastModal(spell);
        break;
      case 'attack':
        rollSpellAttack(spell);
        break;
      case 'save':
        showSavingThrow(spell);
        break;
      case 'damage':
        rollSpellDamage(spell);
        break;
    }
  };

  const handleCastSpell = (spellLevel: number) => {
    if (!selectedSpell) return;

    if (selectedSpell.concentration) {
      if (character.concentration.isConcentrating) {
        stopConcentration();
      }
      startConcentration(selectedSpell.name, selectedSpell.id, spellLevel);
    }

    if (selectedSpell.level > 0) {
      updateSpellSlot(
        spellLevel as keyof typeof character.spellSlots,
        character.spellSlots[spellLevel as keyof typeof character.spellSlots].used + 1
      );
    }

    setCastModalOpen(false);
    setSelectedSpell(null);
  };

  const toggleLevelExpanded = (level: number) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(level)) {
      newExpanded.delete(level);
    } else {
      newExpanded.add(level);
    }
    setExpandedLevels(newExpanded);
  };

  const sortedLevels = Object.keys(spellsByLevel)
    .map(Number)
    .sort((a, b) => a - b);

  if (actionSpells.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        <div className="mb-3 text-5xl">🔮</div>
        <p className="font-medium text-lg">No action spells ready</p>
        <p className="mt-2 text-sm">
          Add spells with attack rolls, saving throws, or damage dice to see them here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with stats and controls */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-purple-700">
              <Sparkles size={16} />
              <span className="font-medium">
                Spell Attack: +{spellAttackBonus ?? 0} | Save DC: {spellSaveDC ?? 8}
              </span>
              {spellcastingAbility && (
                <span className="rounded bg-purple-100 px-2 py-1 text-xs">
                  {spellcastingAbility.charAt(0).toUpperCase() + spellcastingAbility.slice(1)}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCompactView(!compactView)}
                className={`rounded p-2 transition-colors ${
                  compactView
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={compactView ? 'Switch to detailed view' : 'Switch to compact view'}
              >
                {compactView ? <List size={16} /> : <Grid3X3 size={16} />}
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search spells..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>
        </div>

        {/* Favorites section */}
        {favoriteActionSpells.length > 0 && (
          <div className="rounded-lg border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Heart className="text-yellow-600" size={16} />
              <span className="font-semibold text-yellow-800">Favorite Spells</span>
              <span className="rounded-full bg-yellow-200 px-2 py-1 text-xs font-medium text-yellow-800">
                {favoriteActionSpells.length}
              </span>
            </div>
            <div className={compactView ? 'space-y-2' : 'space-y-3'}>
              {favoriteActionSpells.map(spell => (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  compact={compactView}
                  isFavorite={true}
                  spellSaveDC={spellSaveDC}
                  onAction={(action) => handleSpellAction(spell, action)}
                  onToggleFavorite={() => toggleSpellFavorite(spell.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Spell levels */}
        <div className="space-y-3">
          {sortedLevels.map(level => (
            <LevelSection
              key={level}
              level={level}
              spells={spellsByLevel[level]}
              isExpanded={expandedLevels.has(level)}
              onToggle={() => toggleLevelExpanded(level)}
              compactView={compactView}
              spellSaveDC={spellSaveDC}
              onSpellAction={handleSpellAction}
              favoriteSpells={favoriteSpells}
              onToggleFavorite={toggleSpellFavorite}
            />
          ))}
        </div>

        {/* No results message */}
        {searchQuery && sortedLevels.length === 0 && (
          <div className="py-6 text-center text-gray-500">
            <div className="mb-2 text-3xl">🔍</div>
            <p className="font-medium">No spells found</p>
            <p className="mt-1 text-sm">
              Try adjusting your search terms or check your prepared spells.
            </p>
          </div>
        )}
      </div>

      {/* Spell Cast Modal */}
      {selectedSpell && (
        <SpellCastModal
          isOpen={castModalOpen}
          onClose={() => {
            setCastModalOpen(false);
            setSelectedSpell(null);
          }}
          spell={selectedSpell}
          spellSlots={character.spellSlots}
          concentration={character.concentration}
          onCastSpell={handleCastSpell}
        />
      )}
    </>
  );
}
