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
  Eye,
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
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import { RollSummary } from '@/types/dice';
import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';

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
  const isCantrip = spell.level === 0;
  
  if (compact) {
    return (
      <div className="group flex items-center justify-between rounded-lg border-2 border-gray-200 bg-white p-2.5 hover:shadow-md hover:border-gray-300 transition-all">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={onToggleFavorite}
            className={`flex-shrink-0 transition-colors ${
              isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <span className="font-medium text-gray-900 truncate text-sm">
            {spell.name}
          </span>
          {spell.concentration && (
            <Badge variant="warning" size="sm" className="flex-shrink-0">⏱</Badge>
          )}
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <Button
            onClick={() => onAction('cast')}
            variant="primary"
            size="xs"
            className="bg-purple-600 hover:bg-purple-700"
            title="Cast spell"
          >
            <Wand2 size={12} />
          </Button>
          {spell.actionType === 'attack' && (
            <Button
              onClick={() => onAction('attack')}
              variant="secondary"
              size="xs"
              title="Attack roll"
            >
              <Dice6 size={12} />
            </Button>
          )}
          <Button
            onClick={() => onAction('view')}
            variant="outline"
            size="xs"
            title="View details"
          >
            <Eye size={12} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-gray-200 bg-white p-4 hover:shadow-md hover:border-gray-300 transition-all">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onToggleFavorite}
            className={`transition-colors ${
              isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <span className="font-bold text-gray-900">{spell.name}</span>
          <Badge 
            variant={isCantrip ? "warning" : "primary"} 
            size="sm"
            className={isCantrip ? "bg-yellow-100 text-yellow-800" : "bg-purple-100 text-purple-800"}
          >
            {isCantrip ? 'Cantrip' : `Level ${spell.level}`}
          </Badge>
          {spell.concentration && (
            <Badge variant="warning" size="sm">⏱ Concentration</Badge>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span>{spell.castingTime}</span>
        <span>•</span>
        <span>{spell.range}</span>
        {spell.duration && (
          <>
            <span>•</span>
            <span>{spell.duration}</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => onAction('cast')}
          variant="primary"
          size="sm"
          leftIcon={<Wand2 size={14} />}
          className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
        >
          Cast
        </Button>

        {spell.actionType === 'attack' && (
          <Button
            onClick={() => onAction('attack')}
            variant="secondary"
            size="sm"
            leftIcon={<Dice6 size={14} />}
          >
            Attack
          </Button>
        )}

        <Button
          onClick={() => onAction('view')}
          variant="outline"
          size="sm"
          leftIcon={<Eye size={14} />}
        >
          View
        </Button>

        {/* Show spell info for reference */}
        {spell.actionType === 'save' && spell.savingThrow && (
          <Badge variant="info" size="sm">
            {spell.savingThrow} Save DC {spellSaveDC || '?'}
          </Badge>
        )}
        {spell.damage && (
          <Badge variant="warning" size="sm">
            {spell.damage} {spell.damageType && `${spell.damageType}`}
          </Badge>
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
  const isCantrip = level === 0;
  const levelName = isCantrip ? 'Cantrips' : `Level ${level}`;
  const levelColor = isCantrip ? 'text-yellow-700' : 'text-purple-700';
  const levelBg = isCantrip ? 'bg-gradient-to-r from-yellow-50 to-amber-50' : 'bg-gradient-to-r from-purple-50 to-violet-50';
  const borderColor = isCantrip ? 'border-yellow-200' : 'border-purple-200';

  return (
    <div className={`border-2 ${borderColor} rounded-lg overflow-hidden bg-white`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 ${levelBg} hover:opacity-90 transition-all`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown size={18} className={levelColor} />
            ) : (
              <ChevronRight size={18} className={levelColor} />
            )}
            <span className={`font-bold text-base ${levelColor}`}>{levelName}</span>
          </div>
          <Badge 
            variant={isCantrip ? "warning" : "primary"}
            size="sm"
            className={isCantrip ? "bg-yellow-100 text-yellow-800" : "bg-purple-100 text-purple-800"}
          >
            {spells.length} spell{spells.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </button>
      
      {isExpanded && (
        <div className="p-4 bg-white border-t-2 border-gray-100">
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
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null);
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
      case 'view':
        setViewingSpell(spell);
        break;
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
      <div className="rounded-lg border-2 border-gray-200 bg-white p-8 text-center">
        <div className="mb-3 text-5xl">🔮</div>
        <p className="font-semibold text-gray-700 text-lg">No spells prepared</p>
        <p className="mt-2 text-sm text-gray-500">
          Prepare spells in the Spellcasting tab to see them here.
        </p>
      </div>
    );
  }

  // Separate cantrips and leveled spells
  const cantrips = spellsByLevel[0] || [];
  const leveledSpells = Object.keys(spellsByLevel)
    .map(Number)
    .filter(level => level > 0)
    .sort((a, b) => a - b);

  return (
    <>
      <div className="space-y-4">
        {/* Header with stats and controls */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles size={16} className="text-purple-600" />
                <Badge variant="primary" size="sm" className="bg-blue-100 text-blue-800">
                  Attack: +{spellAttackBonus ?? 0}
                </Badge>
                <Badge variant="primary" size="sm" className="bg-indigo-100 text-indigo-800">
                  Save DC: {spellSaveDC ?? 8}
                </Badge>
                {spellcastingAbility && (
                  <Badge variant="secondary" size="sm">
                    {spellcastingAbility.charAt(0).toUpperCase() + spellcastingAbility.slice(1)}
                  </Badge>
                )}
              </div>
            </div>
            
            <Button
              onClick={() => setCompactView(!compactView)}
              variant={compactView ? "primary" : "ghost"}
              size="sm"
              leftIcon={compactView ? <List size={16} /> : <Grid3X3 size={16} />}
              title={compactView ? 'Switch to detailed view' : 'Switch to compact view'}
              className={compactView ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              {compactView ? 'Detailed' : 'Compact'}
            </Button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search spells..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
            />
          </div>
        </div>

        {/* Favorites section */}
        {favoriteActionSpells.length > 0 && (
          <div className="rounded-lg border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <Heart className="text-yellow-600" size={18} fill="currentColor" />
              <span className="font-bold text-yellow-800">Favorite Spells</span>
              <Badge variant="warning" size="sm" className="bg-yellow-100 text-yellow-800">
                {favoriteActionSpells.length}
              </Badge>
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

        {/* Cantrips section - Always separate and highlighted */}
        {cantrips.length > 0 && (
          <LevelSection
            key={0}
            level={0}
            spells={cantrips}
            isExpanded={expandedLevels.has(0)}
            onToggle={() => toggleLevelExpanded(0)}
            compactView={compactView}
            spellSaveDC={spellSaveDC}
            onSpellAction={handleSpellAction}
            favoriteSpells={favoriteSpells}
            onToggleFavorite={toggleSpellFavorite}
          />
        )}

        {/* Leveled spells */}
        {leveledSpells.length > 0 && (
          <div className="space-y-3">
            {leveledSpells.map(level => (
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
        )}

        {/* No results message */}
        {searchQuery && sortedLevels.length === 0 && (
          <div className="rounded-lg border-2 border-gray-200 bg-white p-8 text-center">
            <div className="mb-2 text-4xl">🔍</div>
            <p className="font-semibold text-gray-700">No spells found</p>
            <p className="mt-1 text-sm text-gray-500">
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

      {/* Spell Detail Modal */}
      {viewingSpell && (
        <SpellDetailsModal
          spell={viewingSpell}
          isOpen={true}
          onClose={() => setViewingSpell(null)}
          isFavorite={favoriteSpells.includes(viewingSpell.id)}
          onToggleFavorite={() => {
            toggleSpellFavorite(viewingSpell.id);
          }}
          onCast={() => openCastModal(viewingSpell)}
        />
      )}
    </>
  );
}
