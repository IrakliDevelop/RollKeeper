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
}> = ({
  spell,
  compact,
  isFavorite,
  spellSaveDC,
  onAction,
  onToggleFavorite,
}) => {
  const isCantrip = spell.level === 0;

  if (compact) {
    return (
      <div className="group border-divider bg-surface-raised hover:border-divider-strong flex items-center justify-between rounded-lg border-2 p-2.5 transition-all hover:shadow-md">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            onClick={onToggleFavorite}
            className={`flex-shrink-0 transition-colors ${
              isFavorite
                ? 'text-accent-amber-text hover:text-accent-amber-text-muted'
                : 'text-faint hover:text-accent-amber-text'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <span className="text-heading truncate text-sm font-medium">
            {spell.name}
          </span>
          {spell.concentration && (
            <Badge variant="warning" size="sm" className="flex-shrink-0">
              ⏱
            </Badge>
          )}
        </div>
        <div className="flex flex-shrink-0 gap-1.5">
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
    <div className="border-divider bg-surface-raised hover:border-divider-strong rounded-lg border-2 p-4 transition-all hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onToggleFavorite}
            className={`transition-colors ${
              isFavorite
                ? 'text-accent-amber-text hover:text-accent-amber-text-muted'
                : 'text-faint hover:text-accent-amber-text'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <span className="text-heading font-bold">{spell.name}</span>
          <Badge variant={isCantrip ? 'warning' : 'primary'} size="sm">
            {isCantrip ? 'Cantrip' : `Level ${spell.level}`}
          </Badge>
          {spell.concentration && (
            <Badge variant="warning" size="sm">
              ⏱ Concentration
            </Badge>
          )}
        </div>
      </div>

      <div className="text-muted mb-3 flex flex-wrap items-center gap-2 text-xs">
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
  const levelColor = isCantrip
    ? 'text-accent-amber-text'
    : 'text-accent-purple-text';
  const levelBg = isCantrip
    ? 'bg-gradient-to-r from-[var(--gradient-amber-from)] to-[var(--gradient-amber-to)]'
    : 'bg-gradient-to-r from-[var(--gradient-purple-from)] to-[var(--gradient-purple-to)]';
  const borderColor = isCantrip
    ? 'border-accent-amber-border'
    : 'border-accent-purple-border';

  return (
    <div
      className={`border-2 ${borderColor} bg-surface-raised overflow-hidden rounded-lg`}
    >
      <button
        onClick={onToggle}
        className={`flex w-full items-center justify-between p-4 ${levelBg} transition-all hover:opacity-90`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown size={18} className={levelColor} />
            ) : (
              <ChevronRight size={18} className={levelColor} />
            )}
            <span className={`text-base font-bold ${levelColor}`}>
              {levelName}
            </span>
          </div>
          <Badge variant={isCantrip ? 'warning' : 'primary'} size="sm">
            {spells.length} spell{spells.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </button>

      {isExpanded && (
        <div className="bg-surface-raised border-divider border-t-2 p-4">
          <div className={compactView ? 'space-y-2' : 'space-y-3'}>
            {spells.map(spell => (
              <SpellCard
                key={spell.id}
                spell={spell}
                compact={compactView}
                isFavorite={favoriteSpells.includes(spell.id)}
                spellSaveDC={spellSaveDC}
                onAction={action => onSpellAction(spell, action)}
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
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(
    new Set([0, 1, 2])
  ); // Default: cantrips and levels 1-2 expanded

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
    return actionSpells.filter(
      spell =>
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
        if (
          rollResult &&
          typeof rollResult === 'object' &&
          'individualValues' in rollResult
        ) {
          const summary = rollResult as RollSummary;
          const roll = summary.individualValues[0] || 1;
          const isCrit = roll === 20;
          showAttackToast(
            spell.name,
            roll,
            spellAttackBonus,
            isCrit,
            spell.damage,
            spell.damageType
          );
          return;
        }
      } catch (error) {
        console.warn(
          'Dice animation failed, falling back to random roll:',
          error
        );
      }
    }

    const roll = Math.floor(Math.random() * 20) + 1;
    const isCrit = roll === 20;
    showAttackToast(
      spell.name,
      roll,
      spellAttackBonus,
      isCrit,
      spell.damage,
      spell.damageType
    );
  };

  const showSavingThrow = async (spell: Spell) => {
    if (spellSaveDC === null) {
      alert('Cannot cast spells - no spellcasting ability detected');
      return;
    }
    showSaveToast(
      spell.name,
      spellSaveDC,
      spell.savingThrow,
      spell.damage,
      spell.damageType
    );
  };

  const rollSpellDamage = async (spell: Spell) => {
    if (!spell.damage) {
      alert('This spell does not have damage dice specified');
      return;
    }

    if (animateRoll) {
      try {
        const rollResult = await animateRoll(spell.damage);
        if (
          rollResult &&
          typeof rollResult === 'object' &&
          'finalTotal' in rollResult
        ) {
          const summary = rollResult as RollSummary;
          const damageResult = `${summary.finalTotal}`;
          showDamageRoll(spell.name, damageResult, spell.damageType);
          return;
        }
      } catch (error) {
        console.warn(
          'Dice animation failed, falling back to calculated roll:',
          error
        );
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
        character.spellSlots[spellLevel as keyof typeof character.spellSlots]
          .used + 1
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
      <div className="border-divider bg-surface-raised rounded-lg border-2 p-8 text-center">
        <div className="mb-3 text-5xl">🔮</div>
        <p className="text-heading text-lg font-semibold">No spells prepared</p>
        <p className="text-muted mt-2 text-sm">
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles size={16} className="text-accent-purple-text-muted" />
                <Badge variant="primary" size="sm">
                  Attack: +{spellAttackBonus ?? 0}
                </Badge>
                <Badge variant="primary" size="sm">
                  Save DC: {spellSaveDC ?? 8}
                </Badge>
                {spellcastingAbility && (
                  <Badge variant="secondary" size="sm">
                    {spellcastingAbility.charAt(0).toUpperCase() +
                      spellcastingAbility.slice(1)}
                  </Badge>
                )}
              </div>
            </div>

            <Button
              onClick={() => setCompactView(!compactView)}
              variant={compactView ? 'primary' : 'ghost'}
              size="sm"
              leftIcon={
                compactView ? <List size={16} /> : <Grid3X3 size={16} />
              }
              title={
                compactView
                  ? 'Switch to detailed view'
                  : 'Switch to compact view'
              }
              className={compactView ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              {compactView ? 'Detailed' : 'Compact'}
            </Button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="text-faint absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search spells..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="border-divider-strong bg-surface-raised text-heading placeholder:text-faint focus:border-accent-purple-border-strong focus:ring-accent-purple-bg-strong w-full rounded-lg border-2 py-2.5 pr-4 pl-10 text-sm transition-all focus:ring-2 focus:outline-none"
            />
          </div>
        </div>

        {/* Favorites section */}
        {favoriteActionSpells.length > 0 && (
          <div className="border-accent-amber-border rounded-lg border-2 bg-gradient-to-r from-[var(--gradient-amber-from)] to-[var(--gradient-amber-to)] p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <Heart
                className="text-accent-amber-text"
                size={18}
                fill="currentColor"
              />
              <span className="text-accent-amber-text font-bold">
                Favorite Spells
              </span>
              <Badge variant="warning" size="sm">
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
                  onAction={action => handleSpellAction(spell, action)}
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
          <div className="border-divider bg-surface-raised rounded-lg border-2 p-8 text-center">
            <div className="mb-2 text-4xl">🔍</div>
            <p className="text-heading font-semibold">No spells found</p>
            <p className="text-muted mt-1 text-sm">
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
