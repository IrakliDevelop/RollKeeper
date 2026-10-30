'use client';

import React, { useState, useMemo } from 'react';
import {
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
  Zap,
  Infinity,
} from 'lucide-react';
import { AppIcon } from '@/components/ui/icons';
import { useCharacterStore } from '@/store/characterStore';
import { useCastSpell } from '@/hooks/useCastSpell';
import { Spell } from '@/types/character';
import {
  calculateSpellAttackBonus,
  calculateSpellSaveDC,
  getCharacterSpellcastingAbility,
  rollDamage,
} from '@/utils/calculations';
import { getScaledSpellDamage } from '@/utils/cantripScaling';
import { getTotalLevel } from '@/utils/multiclass';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import { RollSummary } from '@/types/dice';
import { d20Notation } from '@/utils/sheetRoll';
import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';
import { alertDialog } from '@/components/ui/feedback/confirm-dialog';
import { castCostAlertTitle } from '@/utils/spellCastCost';
import { SlotPips } from '@/components/ui/game/SlotPips';

const NO_SPELLCASTING_ABILITY = {
  title: "Can't cast spells",
  message: 'This character has no spellcasting ability set.',
};

interface QuickSpellsProps {
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
  totalLevel: number;
  slotMax?: number;
  slotUsed?: number;
}

const SpellCard: React.FC<{
  spell: Spell;
  compact: boolean;
  isFavorite: boolean;
  spellSaveDC: number | null;
  onAction: (action: string) => void;
  onToggleFavorite: () => void;
  totalLevel: number;
}> = ({
  spell,
  compact,
  isFavorite,
  spellSaveDC,
  onAction,
  onToggleFavorite,
  totalLevel,
}) => {
  const isCantrip = spell.level === 0;
  const isAtWill = spell.freeCastMax === 0;
  const isInnate = spell.freeCastMax !== undefined && spell.freeCastMax > 0;
  const freeCastsRemaining = isInnate
    ? spell.freeCastMax! - (spell.freeCastsUsed || 0)
    : 0;
  const displayDamage = getScaledSpellDamage(spell, totalLevel);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Button
            onClick={onToggleFavorite}
            variant="ghost"
            size="xs"
            selected={isFavorite}
            aria-label="Favorite"
            aria-pressed={isFavorite}
            className="shrink-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
          </Button>
          <span className="text-heading truncate text-sm font-medium">
            {spell.name}
          </span>
          {isAtWill && (
            <Badge
              variant="neutral"
              size="sm"
              className="flex-shrink-0 gap-0.5"
            >
              <Infinity size={10} />
            </Badge>
          )}
          {isInnate && (
            <Badge
              variant="neutral"
              size="sm"
              className="flex-shrink-0 gap-0.5"
            >
              <Zap size={10} /> {freeCastsRemaining}/{spell.freeCastMax}
            </Badge>
          )}
          {spell.concentration && (
            <Badge variant="magic" size="sm" className="flex-shrink-0">
              ⏱
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            onClick={() => onAction('cast')}
            variant="secondary"
            size="xs"
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
            variant="ghost"
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
    <div className="py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onToggleFavorite}
            variant="ghost"
            size="xs"
            selected={isFavorite}
            aria-label="Favorite"
            aria-pressed={isFavorite}
            className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </Button>
          <span className="text-heading font-bold">{spell.name}</span>
          <Badge variant="neutral" size="sm">
            {isCantrip ? 'Cantrip' : `Level ${spell.level}`}
          </Badge>
          {spell.concentration && (
            <Badge variant="magic" size="sm">
              ⏱ Concentration
            </Badge>
          )}
          {isAtWill && (
            <Badge variant="neutral" size="sm" className="gap-0.5">
              <Infinity size={12} /> At Will
            </Badge>
          )}
          {isInnate && (
            <Badge variant="neutral" size="sm" className="gap-0.5">
              <Zap size={12} /> {freeCastsRemaining}/{spell.freeCastMax} free
            </Badge>
          )}
          {spell.castingSource && (
            <Badge variant="neutral" size="sm">
              {spell.castingSource}
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
          variant="secondary"
          size="sm"
          leftIcon={<Wand2 size={14} />}
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
          variant="ghost"
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
        {displayDamage && (
          <Badge variant="warning" size="sm">
            {displayDamage} {spell.damageType && `${spell.damageType}`}
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
  totalLevel,
  slotMax,
  slotUsed,
}) => {
  const isCantrip = level === 0;
  const levelName = isCantrip ? 'Cantrips' : `Level ${level}`;
  const hasSlots = !isCantrip && slotMax !== undefined && slotMax > 0;
  const remaining = hasSlots ? slotMax! - (slotUsed ?? 0) : 0;

  return (
    <div>
      <div className="border-divider flex w-full flex-wrap items-center gap-3 border-b pb-2">
        <button
          onClick={onToggle}
          aria-expanded={isExpanded}
          className="text-heading flex min-h-6 items-center gap-3 hover:opacity-90 pointer-coarse:min-h-11"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
            <span className="type-label-heading">{levelName}</span>
          </div>
          <Badge variant="neutral" size="sm">
            {spells.length} spell{spells.length !== 1 ? 's' : ''}
          </Badge>
        </button>

        {/* Inline slot dots */}
        {hasSlots && (
          <div className="ml-auto flex items-center gap-1.5">
            <SlotPips total={slotMax!} available={remaining} level={level} />
            <span className="text-muted text-xs">
              {remaining}/{slotMax}
            </span>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="pt-2">
          <div className="divide-divider divide-y">
            {spells.map(spell => (
              <SpellCard
                key={spell.id}
                spell={spell}
                compact={compactView}
                isFavorite={favoriteSpells.includes(spell.id)}
                spellSaveDC={spellSaveDC}
                onAction={action => onSpellAction(spell, action)}
                onToggleFavorite={() => onToggleFavorite(spell.id)}
                totalLevel={totalLevel}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export function QuickSpells({
  showAttackRoll: showAttackToast,
  showSavingThrow: showSaveToast,
  showDamageRoll,
  animateRoll,
}: QuickSpellsProps) {
  const { character, toggleSpellFavorite, toggleReaction } =
    useCharacterStore();
  const { castSpell } = useCastSpell();
  const totalLevel = getTotalLevel(character);

  // Local state
  const [castModalOpen, setCastModalOpen] = useState(false);
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [compactView, setCompactView] = useState(true);
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
      void alertDialog(NO_SPELLCASTING_ABILITY);
      return;
    }

    if (animateRoll) {
      try {
        const rollResult = await animateRoll(d20Notation(spellAttackBonus));
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
            getScaledSpellDamage(spell, totalLevel),
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
      getScaledSpellDamage(spell, totalLevel),
      spell.damageType
    );
  };

  const showSavingThrow = async (spell: Spell) => {
    if (spellSaveDC === null) {
      void alertDialog(NO_SPELLCASTING_ABILITY);
      return;
    }
    showSaveToast(
      spell.name,
      spellSaveDC,
      spell.savingThrow,
      getScaledSpellDamage(spell, totalLevel),
      spell.damageType
    );
  };

  const rollSpellDamage = async (spell: Spell) => {
    const damage = getScaledSpellDamage(spell, totalLevel);
    if (!damage) {
      void alertDialog({ title: 'This spell has no damage dice' });
      return;
    }

    if (animateRoll) {
      try {
        const rollResult = await animateRoll(damage);
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

    const damageResult = rollDamage(damage);
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

  const handleCastSpell = (
    spellLevel: number,
    useFreecast: boolean,
    isRitual?: boolean,
    usePact?: boolean
  ) => {
    if (!selectedSpell) return;
    const cast = castSpell(selectedSpell, {
      level: spellLevel,
      useFreecast,
      isRitual,
      usePact,
    });
    if (!cast) {
      void alertDialog({
        title: castCostAlertTitle(selectedSpell, character.inventoryItems),
      });
      return;
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
      <div className="py-8 text-center">
        <AppIcon name="spell" className="text-muted mx-auto mb-3 h-12 w-12" />
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
                <Badge variant="neutral" size="sm">
                  Attack: +{spellAttackBonus ?? 0}
                </Badge>
                <Badge variant="neutral" size="sm">
                  Save DC: {spellSaveDC ?? 8}
                </Badge>
                {spellcastingAbility && (
                  <Badge variant="neutral" size="sm">
                    {spellcastingAbility.charAt(0).toUpperCase() +
                      spellcastingAbility.slice(1)}
                  </Badge>
                )}
              </div>
            </div>

            <Button
              onClick={() => setCompactView(!compactView)}
              variant="ghost"
              selected={!compactView}
              size="sm"
              leftIcon={
                compactView ? <List size={16} /> : <Grid3X3 size={16} />
              }
              title={
                compactView
                  ? 'Switch to detailed view'
                  : 'Switch to compact view'
              }
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
              className="border-input-border bg-surface text-heading placeholder:text-faint focus:border-brass-border w-full rounded-md border py-2.5 pr-4 pl-10 text-sm transition-all focus:ring-2 focus:outline-none pointer-coarse:text-base"
            />
          </div>
        </div>

        {/* Favorites section */}
        {favoriteActionSpells.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-3">
              <Heart className="text-muted" size={18} fill="currentColor" />
              <span className="text-heading font-semibold">
                Favorite Spells
              </span>
              <Badge variant="neutral" size="sm">
                {favoriteActionSpells.length}
              </Badge>
            </div>
            <div className="divide-divider divide-y">
              {favoriteActionSpells.map(spell => (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  compact={compactView}
                  isFavorite={true}
                  spellSaveDC={spellSaveDC}
                  onAction={action => handleSpellAction(spell, action)}
                  onToggleFavorite={() => toggleSpellFavorite(spell.id)}
                  totalLevel={totalLevel}
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
            totalLevel={totalLevel}
          />
        )}

        {/* Leveled spells */}
        {leveledSpells.length > 0 && (
          <div className="space-y-3">
            {leveledSpells.map(level => {
              const slot =
                character.spellSlots[
                  level as keyof typeof character.spellSlots
                ];
              return (
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
                  totalLevel={totalLevel}
                  slotMax={slot?.max}
                  slotUsed={slot?.used}
                />
              );
            })}
          </div>
        )}

        {/* No results message */}
        {searchQuery && sortedLevels.length === 0 && (
          <div className="py-8 text-center">
            <AppIcon
              name="search"
              className="text-muted mx-auto mb-2 h-10 w-10"
            />
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
          hasUsedReaction={character.reaction?.hasUsedReaction}
          pactMagic={character.pactMagic}
          onCastSpell={handleCastSpell}
          onResetReaction={toggleReaction}
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
          characterLevel={totalLevel}
        />
      )}
    </>
  );
}
