'use client';

import React, { useId, useState, useMemo } from 'react';
import { Spell } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import {
  Plus,
  Edit2,
  Trash2,
  Eye,
  BookOpen,
  Search,
  Filter,
  Star,
  ChevronDown,
  ChevronRight,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  X,
  Wand2,
  Zap,
  Infinity,
} from 'lucide-react';
import { AppIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Input } from '@/components/ui/forms/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/feedback/dialog';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import DragDropList from '@/components/ui/layout/DragDropList';
import { SpellAutocomplete } from '@/components/ui/forms/SpellAutocomplete';
import { useSpellsData } from '@/hooks/useSpellsData';
import {
  getScaledSpellDamage,
  resolveDamageScalingOnEdit,
} from '@/utils/cantripScaling';
import { getTotalLevel } from '@/utils/multiclass';
import {
  convertProcessedSpellToFormData,
  spellToFormData,
  createInitialSpellFormData,
  isSpellPrepared,
  type SpellFormData,
} from '@/utils/spellConversion';
import { SpellFormFields } from '@/components/shared/spells';
import { ProcessedSpell } from '@/types/spells';
import { SummonCreaturePickerModal } from '@/components/ui/character/summons';
import { isSummoningSpell } from '@/utils/summonConverter';
import {
  calculateSpellAttackBonus,
  getSpellcastingAbilityModifier,
} from '@/utils/calculations';
import {
  SPELL_SCHOOLS,
  ACTION_TYPES,
  DAMAGE_TYPES,
} from '@/utils/spellConstants';
import {
  alertDialog,
  confirmDialog,
} from '@/components/ui/feedback/confirm-dialog';
import { castCostAlertTitle } from '@/utils/spellCastCost';
import { SlotPips } from '@/components/ui/game/SlotPips';
import { Section } from '@/components/ui/layout/section';

interface SpellFilters {
  searchQuery: string;
  level: number | 'all';
  school: string | 'all';
  actionType: string | 'all';
  damageType: string | 'all';
  prepared: 'all' | 'prepared' | 'unprepared';
  concentration: 'all' | 'yes' | 'no';
  ritual: 'all' | 'yes' | 'no';
  favorites: boolean;
}

interface SpellsByLevel {
  [level: number]: Spell[];
}

const initialFilters: SpellFilters = {
  searchQuery: '',
  level: 'all',
  school: 'all',
  actionType: 'all',
  damageType: 'all',
  prepared: 'all',
  concentration: 'all',
  ritual: 'all',
  favorites: false,
};

const SpellCard: React.FC<{
  spell: Spell;
  nameId: string;
  compact: boolean;
  isFavorite: boolean;
  totalLevel: number;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
  onTogglePrepared: () => void;
  onToggleFavorite: () => void;
  onCast: () => void;
}> = ({
  spell,
  nameId,
  compact,
  isFavorite,
  totalLevel,
  onEdit,
  onDelete,
  onView,
  onTogglePrepared,
  onToggleFavorite,
  onCast,
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
        <div className="flex min-w-0 flex-auto flex-wrap items-center gap-2">
          <Button
            onClick={onToggleFavorite}
            variant="ghost"
            size="xs"
            selected={isFavorite}
            aria-label="Favorite"
            aria-pressed={isFavorite}
            className="shrink-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </Button>

          <div className="flex min-w-0 flex-auto items-center gap-2">
            <span id={nameId} className="text-heading truncate font-bold">
              {spell.name}
            </span>
            <Badge variant="neutral" size="sm" className="flex-shrink-0">
              {isCantrip ? 'Cantrip' : `Lv${spell.level}`}
            </Badge>
            <span className="text-muted hidden flex-shrink-0 text-xs sm:inline">
              {spell.school}
            </span>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1">
            {isAtWill && (
              <Badge
                variant="neutral"
                size="sm"
                className="flex-shrink-0 gap-0.5"
              >
                <Infinity size={10} /> At Will
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
              <Badge variant="magic" size="sm">
                C
              </Badge>
            )}
            {spell.ritual && (
              <Badge variant="neutral" size="sm">
                R
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Button
            onClick={onCast}
            variant="secondary"
            size="xs"
            title="Cast spell"
          >
            <Wand2 size={12} />
          </Button>
          <Button
            onClick={onTogglePrepared}
            variant="outline"
            selected={isSpellPrepared(spell)}
            size="xs"
            disabled={spell.isAlwaysPrepared}
            title={
              spell.isAlwaysPrepared
                ? 'Always prepared — cannot be unprepared'
                : undefined
            }
          >
            {isSpellPrepared(spell) ? 'Prepared' : 'Prepare'}
          </Button>
          <Button
            onClick={onView}
            variant="ghost"
            size="xs"
            title="View details"
          >
            <Eye size={14} />
          </Button>
          <Button onClick={onEdit} variant="ghost" size="xs" title="Edit spell">
            <Edit2 size={14} />
          </Button>
          <Button
            onClick={onDelete}
            variant="ghost"
            size="xs"
            title="Delete spell"
            className="text-blood-text"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button
              onClick={onToggleFavorite}
              variant="ghost"
              size="xs"
              selected={isFavorite}
              aria-label="Favorite"
              aria-pressed={isFavorite}
              className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            >
              <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </Button>
            <h5 id={nameId} className="text-heading font-bold">
              {spell.name}
            </h5>
            <Badge variant="neutral" size="sm">
              {isCantrip ? 'Cantrip' : `Level ${spell.level}`}
            </Badge>
            {spell.concentration && (
              <Badge variant="magic" size="sm">
                Concentration
              </Badge>
            )}
            {spell.ritual && (
              <Badge variant="neutral" size="sm">
                Ritual
              </Badge>
            )}
            {spell.isAlwaysPrepared && (
              <Badge variant="info" size="sm">
                Always Prepared
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

          <div className="text-body mb-2 flex flex-wrap items-center gap-4 text-sm">
            <span>
              <strong>School:</strong> {spell.school}
            </span>
            <span>
              <strong>Time:</strong> {spell.castingTime}
            </span>
            <span>
              <strong>Range:</strong> {spell.range}
            </span>
            {spell.duration && (
              <span>
                <strong>Duration:</strong> {spell.duration}
              </span>
            )}
          </div>

          <div className="text-body mb-2 text-sm">
            <strong>Components:</strong>{' '}
            {[
              spell.components.verbal && 'V',
              spell.components.somatic && 'S',
              spell.components.material && 'M',
            ]
              .filter(Boolean)
              .join(', ')}
            {spell.components.material &&
              spell.components.materialDescription && (
                <span className="text-muted">
                  {' '}
                  ({spell.components.materialDescription})
                </span>
              )}
          </div>

          {displayDamage && (
            <div className="mb-2">
              <Badge variant="danger" size="sm">
                {displayDamage} {spell.damageType}
              </Badge>
            </div>
          )}

          <div
            className="text-body line-clamp-2 text-sm"
            dangerouslySetInnerHTML={{ __html: spell.description }}
          />
        </div>

        <div className="flex flex-wrap gap-2 md:max-w-56 md:justify-end">
          <Button
            onClick={onCast}
            variant="secondary"
            size="sm"
            leftIcon={<Wand2 size={14} />}
          >
            Cast
          </Button>

          <Button
            onClick={onTogglePrepared}
            variant="outline"
            selected={isSpellPrepared(spell)}
            size="sm"
            disabled={spell.isAlwaysPrepared}
            title={
              spell.isAlwaysPrepared
                ? 'Always prepared — cannot be unprepared'
                : undefined
            }
          >
            {isSpellPrepared(spell) ? 'Prepared' : 'Prepare'}
          </Button>

          <div className="flex gap-1">
            <Button
              onClick={onView}
              variant="outline"
              size="sm"
              title="View details"
            >
              <Eye size={16} />
            </Button>
            <Button
              onClick={onEdit}
              variant="outline"
              size="sm"
              title="Edit spell"
            >
              <Edit2 size={16} />
            </Button>
            <Button
              onClick={onDelete}
              variant="outline"
              size="sm"
              title="Delete spell"
              className="text-blood-text"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LevelSection: React.FC<{
  level: number;
  spells: Spell[];
  isExpanded: boolean;
  onToggle: () => void;
  compact: boolean;
  favoriteSpells: string[];
  totalLevel: number;
  onSpellEdit: (spell: Spell) => void;
  onSpellDelete: (id: string) => void;
  onSpellView: (spell: Spell) => void;
  onTogglePrepared: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onSpellCast: (spell: Spell) => void;
  onReorder: (sourceIndex: number, destinationIndex: number) => void;
  showMoveControls: boolean;
  slotMax?: number;
  slotUsed?: number;
}> = ({
  level,
  spells,
  isExpanded,
  onToggle,
  compact,
  favoriteSpells,
  totalLevel,
  onSpellEdit,
  onSpellDelete,
  onSpellView,
  onTogglePrepared,
  onToggleFavorite,
  onSpellCast,
  onReorder,
  showMoveControls,
  slotMax,
  slotUsed,
}) => {
  const levelId = useId();
  const isCantrip = level === 0;
  const levelName = isCantrip ? 'Cantrips' : `Level ${level}`;
  const preparedCount = spells.filter(
    s => s.isPrepared || s.isAlwaysPrepared
  ).length;

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
          <div className="flex items-center gap-2">
            <Badge variant="neutral" size="sm">
              {spells.length} spell{spells.length !== 1 ? 's' : ''}
            </Badge>
            {preparedCount > 0 && (
              <Badge variant="neutral" size="sm">
                {preparedCount} prepared
              </Badge>
            )}
          </div>
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
          <DragDropList
            items={spells}
            onReorder={onReorder}
            keyExtractor={spell => spell.id}
            className="divide-divider divide-y"
            itemClassName="pl-6"
            showDragHandle={true}
            dragHandlePosition="left"
            renderItem={(spell, index) => (
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <SpellCard
                    spell={spell}
                    nameId={`${levelId}-spell-${index}`}
                    compact={compact}
                    isFavorite={favoriteSpells.includes(spell.id)}
                    totalLevel={totalLevel}
                    onEdit={() => onSpellEdit(spell)}
                    onDelete={() => onSpellDelete(spell.id)}
                    onView={() => onSpellView(spell)}
                    onTogglePrepared={() => onTogglePrepared(spell.id)}
                    onToggleFavorite={() => onToggleFavorite(spell.id)}
                    onCast={() => onSpellCast(spell)}
                  />
                </div>
                {showMoveControls && (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      aria-describedby={`${levelId}-spell-${index}`}
                      disabled={index === 0}
                      className="pointer-coarse:min-h-11"
                      onClick={() => onReorder(index, index - 1)}
                    >
                      Move up
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      aria-describedby={`${levelId}-spell-${index}`}
                      disabled={index === spells.length - 1}
                      className="pointer-coarse:min-h-11"
                      onClick={() => onReorder(index, index + 1)}
                    >
                      Move down
                    </Button>
                  </div>
                )}
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
};

export const SpellManagement: React.FC<{ editing?: boolean }> = ({
  editing = false,
}) => {
  const {
    character,
    updateCharacter,
    reorderSpells,
    toggleSpellFavorite,
    spendSpellSlot,
    spendPactMagicSlot,
    startConcentration,
    stopConcentration,
    toggleReaction,
    addSummon,
    consumeInventoryCost,
  } = useCharacterStore();
  const totalLevel = getTotalLevel(character);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SpellFormData>(
    createInitialSpellFormData
  );
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null);
  const [castModalOpen, setCastModalOpen] = useState(false);
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);
  const [summonPickerOpen, setSummonPickerOpen] = useState(false);
  const [summonPickerSpell, setSummonPickerSpell] = useState<Spell | null>(
    null
  );
  const [summonPickerLevel, setSummonPickerLevel] = useState(0);
  const [filters, setFilters] = useState<SpellFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [compactView, setCompactView] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'level' | 'school'>('level');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(
    new Set([0, 1, 2])
  );
  const [justAutoFilled, setJustAutoFilled] = useState(false);

  // Load spells from spellbook for autocomplete
  const { spells: spellbookSpells, loading: spellbookLoading } =
    useSpellsData();

  // Get favorite spells
  const favoriteSpells = useMemo(() => {
    return character.spellbook?.favoriteSpells || [];
  }, [character.spellbook?.favoriteSpells]);

  // Apply filters and search
  const filteredSpells = useMemo(() => {
    let filtered = character.spells;

    // Search query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        spell =>
          spell.name.toLowerCase().includes(query) ||
          spell.school.toLowerCase().includes(query) ||
          spell.description.toLowerCase().includes(query) ||
          spell.damageType?.toLowerCase().includes(query)
      );
    }

    // Level filter
    if (filters.level !== 'all') {
      filtered = filtered.filter(spell => spell.level === filters.level);
    }

    // School filter
    if (filters.school !== 'all') {
      filtered = filtered.filter(spell => spell.school === filters.school);
    }

    // Action type filter
    if (filters.actionType !== 'all') {
      filtered = filtered.filter(
        spell => spell.actionType === filters.actionType
      );
    }

    // Damage type filter
    if (filters.damageType !== 'all') {
      filtered = filtered.filter(
        spell =>
          spell.damageType?.toLowerCase() === filters.damageType.toLowerCase()
      );
    }

    // Prepared filter
    if (filters.prepared === 'prepared') {
      filtered = filtered.filter(
        spell => spell.isPrepared || spell.isAlwaysPrepared
      );
    } else if (filters.prepared === 'unprepared') {
      filtered = filtered.filter(
        spell => !spell.isPrepared && !spell.isAlwaysPrepared
      );
    }

    // Concentration filter
    if (filters.concentration === 'yes') {
      filtered = filtered.filter(spell => spell.concentration);
    } else if (filters.concentration === 'no') {
      filtered = filtered.filter(spell => !spell.concentration);
    }

    // Ritual filter
    if (filters.ritual === 'yes') {
      filtered = filtered.filter(spell => spell.ritual);
    } else if (filters.ritual === 'no') {
      filtered = filtered.filter(spell => !spell.ritual);
    }

    // Favorites filter
    if (filters.favorites) {
      filtered = filtered.filter(spell => favoriteSpells.includes(spell.id));
    }

    return filtered;
  }, [character.spells, filters, favoriteSpells]);

  // Sort spells
  const sortedSpells = useMemo(() => {
    return [...filteredSpells].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'level':
          comparison = a.level - b.level;
          break;
        case 'school':
          comparison = a.school.localeCompare(b.school);
          if (comparison === 0) {
            comparison = a.name.localeCompare(b.name);
          }
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredSpells, sortBy, sortOrder]);

  // Group spells by level
  const spellsByLevel = useMemo(() => {
    const grouped: SpellsByLevel = {};

    sortedSpells.forEach(spell => {
      if (!grouped[spell.level]) {
        grouped[spell.level] = [];
      }
      grouped[spell.level].push(spell);
    });

    return grouped;
  }, [sortedSpells]);

  // Handle spell selection from autocomplete
  const handleSpellSelect = (spell: ProcessedSpell) => {
    const converted = convertProcessedSpellToFormData(spell);
    setFormData(converted);
    setJustAutoFilled(true);

    // Clear the animation flag after 2 seconds
    setTimeout(() => {
      setJustAutoFilled(false);
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) return;

    const {
      freeCastMode,
      freeCastMax: freeCastMaxVal,
      castingSource: castingSrc,
      ...restFormData
    } = formData;
    const spellData: Omit<Spell, 'id' | 'createdAt' | 'updatedAt'> = {
      ...restFormData,
      higherLevel: restFormData.higherLevel || undefined,
      ritual: restFormData.ritual || undefined,
      concentration: restFormData.concentration || undefined,
      isPrepared: restFormData.isPrepared || undefined,
      isAlwaysPrepared: restFormData.isAlwaysPrepared || undefined,
      actionType: restFormData.actionType || undefined,
      savingThrow: restFormData.savingThrow || undefined,
      damage: restFormData.damage || undefined,
      damageType: restFormData.damageType || undefined,
      source: restFormData.source || undefined,
      castingSource: castingSrc || undefined,
      freeCastMax:
        freeCastMode === 'at_will'
          ? 0
          : freeCastMode === 'innate'
            ? freeCastMaxVal
            : undefined,
      freeCastsUsed: freeCastMode !== 'normal' ? 0 : undefined,
    };

    if (editingId) {
      const updatedSpells = character.spells.map(spell => {
        if (spell.id !== editingId) return spell;
        const updated = {
          ...spell,
          ...spellData,
          damageScaling: resolveDamageScalingOnEdit(spell, spellData.damage),
          updatedAt: new Date().toISOString(),
        };
        if (spellData.freeCastMax === undefined) {
          delete updated.freeCastsUsed;
          delete updated.freeCastMax;
          delete updated.castingSource;
        }
        return updated;
      });
      updateCharacter({ spells: updatedSpells });
    } else {
      const newSpell: Spell = {
        ...spellData,
        id: `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateCharacter({ spells: [...character.spells, newSpell] });
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData(createInitialSpellFormData());
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleEdit = (spell: Spell) => {
    setFormData(spellToFormData(spell));
    setEditingId(spell.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    const spellName =
      character.spells.find(spell => spell.id === id)?.name ?? 'this spell';
    const confirmed = await confirmDialog({
      title: `Delete ${spellName}?`,
      message: 'It is removed from your spell list.',
      confirmLabel: 'Delete spell',
      tone: 'danger',
    });
    if (!confirmed) return;
    // Filter the latest list: the sheet may have changed while the dialog was open.
    const updatedSpells = useCharacterStore
      .getState()
      .character.spells.filter(spell => spell.id !== id);
    updateCharacter({ spells: updatedSpells });
  };

  const handlePreparedToggle = (id: string) => {
    const updatedSpells = character.spells.map(spell =>
      spell.id === id
        ? {
            ...spell,
            isPrepared: !spell.isPrepared,
            updatedAt: new Date().toISOString(),
          }
        : spell
    );
    updateCharacter({ spells: updatedSpells });
  };

  const handleReorderSpellsInLevel =
    (level: number) => (sourceIndex: number, destinationIndex: number) => {
      const spellsInLevel = spellsByLevel[level];
      const sourceSpellId = spellsInLevel[sourceIndex].id;
      const destinationSpellId = spellsInLevel[destinationIndex].id;

      const sourceGlobalIndex = character.spells.findIndex(
        spell => spell.id === sourceSpellId
      );
      const destinationGlobalIndex = character.spells.findIndex(
        spell => spell.id === destinationSpellId
      );

      if (sourceGlobalIndex !== -1 && destinationGlobalIndex !== -1) {
        reorderSpells(sourceGlobalIndex, destinationGlobalIndex);
      }
    };

  const handleCastSpell = (spell: Spell) => {
    setSelectedSpell(spell);
    setCastModalOpen(true);
  };

  const handleCastSpellConfirm = (
    spellLevel: number,
    useFreecast: boolean,
    isRitual?: boolean,
    usePact?: boolean
  ) => {
    if (!selectedSpell) return;
    if (!consumeInventoryCost(selectedSpell.inventoryCost)) {
      void alertDialog({
        title: castCostAlertTitle(selectedSpell, character.inventoryItems),
      });
      return;
    }

    if (selectedSpell.concentration) {
      if (character.concentration.isConcentrating) {
        stopConcentration();
      }
      startConcentration(selectedSpell.name, selectedSpell.id, spellLevel);
    }

    if (isRitual) {
      // Ritual casting: no slot consumed, no freecast used
    } else if (usePact) {
      spendPactMagicSlot();
    } else if (useFreecast) {
      if (selectedSpell.freeCastMax && selectedSpell.freeCastMax > 0) {
        updateCharacter({
          spells: character.spells.map(s =>
            s.id === selectedSpell.id
              ? { ...s, freeCastsUsed: (s.freeCastsUsed || 0) + 1 }
              : s
          ),
        });
      }
    } else if (selectedSpell.level > 0) {
      spendSpellSlot(spellLevel as keyof typeof character.spellSlots);
    }

    // Auto-trigger reaction usage when casting a reaction spell
    if (
      selectedSpell.castingTime?.toLowerCase().includes('reaction') &&
      !character.reaction?.hasUsedReaction
    ) {
      toggleReaction();
    }

    // Open summon creature picker for summoning spells
    if (isSummoningSpell(selectedSpell)) {
      setSummonPickerSpell(selectedSpell);
      setSummonPickerLevel(spellLevel);
      setSummonPickerOpen(true);
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

  const clearFilters = () => {
    setFilters(initialFilters);
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'searchQuery') return value.trim() !== '';
    if (typeof value === 'boolean') return value;
    return value !== 'all';
  }).length;

  const sortedLevels = Object.keys(spellsByLevel)
    .map(Number)
    .sort((a, b) => a - b);

  // Calculate total prepared spells (excluding cantrips)
  const preparedSpellsCount = useMemo(() => {
    return character.spells.filter(
      spell => spell.level > 0 && (spell.isPrepared || spell.isAlwaysPrepared)
    ).length;
  }, [character.spells]);

  return (
    <Section heading="Spells & Cantrips" level={3}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="neutral" size="sm">
          {filteredSpells.length} of {character.spells.length}
        </Badge>
        {preparedSpellsCount > 0 && (
          <Badge variant="neutral" size="sm">
            {preparedSpellsCount} prepared
          </Badge>
        )}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-48">
          <Input
            value={filters.searchQuery}
            onChange={e =>
              setFilters(prev => ({ ...prev, searchQuery: e.target.value }))
            }
            placeholder="Search spells by name, school, description, or damage type..."
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <Button
          onClick={() => setCompactView(!compactView)}
          variant="ghost"
          selected={!compactView}
          size="sm"
          title={
            compactView ? 'Switch to detailed view' : 'Switch to compact view'
          }
        >
          {compactView ? <List size={18} /> : <Grid3X3 size={18} />}
        </Button>
        <Button
          onClick={() => setShowFilters(true)}
          variant="ghost"
          selected={showFilters || activeFilterCount > 0}
          aria-expanded={showFilters}
          size="sm"
          leftIcon={<Filter size={16} />}
        >
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="neutral" size="sm" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        <Button
          onClick={() => setIsFormOpen(true)}
          variant="primary"
          size="sm"
          leftIcon={<Plus size={16} />}
        >
          Add Spell
        </Button>
      </div>

      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="mb-4 flex justify-end">
              {activeFilterCount > 0 && (
                <Button
                  onClick={clearFilters}
                  variant="ghost"
                  size="sm"
                  leftIcon={<X size={14} />}
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Level Filter */}
              <div>
                <label className="text-body mb-2 block text-sm font-medium">
                  Level
                </label>
                <SelectField
                  value={filters.level.toString()}
                  onValueChange={value =>
                    setFilters(prev => ({
                      ...prev,
                      level: value === 'all' ? 'all' : parseInt(value),
                    }))
                  }
                >
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="0">Cantrips</SelectItem>
                  {Array.from({ length: 9 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Level {i + 1}
                    </SelectItem>
                  ))}
                </SelectField>
              </div>

              {/* School Filter */}
              <div>
                <label className="text-body mb-2 block text-sm font-medium">
                  School
                </label>
                <SelectField
                  value={filters.school}
                  onValueChange={value =>
                    setFilters(prev => ({ ...prev, school: value }))
                  }
                >
                  <SelectItem value="all">All Schools</SelectItem>
                  {SPELL_SCHOOLS.map(school => (
                    <SelectItem key={school} value={school}>
                      {school}
                    </SelectItem>
                  ))}
                </SelectField>
              </div>

              {/* Action Type Filter */}
              <div>
                <label className="text-body mb-2 block text-sm font-medium">
                  Action Type
                </label>
                <SelectField
                  value={filters.actionType}
                  onValueChange={value =>
                    setFilters(prev => ({ ...prev, actionType: value }))
                  }
                >
                  <SelectItem value="all">All Types</SelectItem>
                  {ACTION_TYPES.map(type => (
                    <SelectItem
                      key={type.value || 'none'}
                      value={type.value || 'none'}
                    >
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectField>
              </div>

              {/* Damage Type Filter */}
              <div>
                <label className="text-body mb-2 block text-sm font-medium">
                  Damage Type
                </label>
                <SelectField
                  value={filters.damageType}
                  onValueChange={value =>
                    setFilters(prev => ({ ...prev, damageType: value }))
                  }
                >
                  <SelectItem value="all">All Damage Types</SelectItem>
                  {DAMAGE_TYPES.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectField>
              </div>

              {/* Prepared Filter */}
              <div>
                <label className="text-body mb-2 block text-sm font-medium">
                  Preparation
                </label>
                <SelectField
                  value={filters.prepared}
                  onValueChange={value =>
                    setFilters(prev => ({
                      ...prev,
                      prepared: value as 'all' | 'prepared' | 'unprepared',
                    }))
                  }
                >
                  <SelectItem value="all">All Spells</SelectItem>
                  <SelectItem value="prepared">Prepared Only</SelectItem>
                  <SelectItem value="unprepared">Unprepared Only</SelectItem>
                </SelectField>
              </div>

              {/* Concentration Filter */}
              <div>
                <label className="text-body mb-2 block text-sm font-medium">
                  Concentration
                </label>
                <SelectField
                  value={filters.concentration}
                  onValueChange={value =>
                    setFilters(prev => ({
                      ...prev,
                      concentration: value as 'all' | 'yes' | 'no',
                    }))
                  }
                >
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Concentration</SelectItem>
                  <SelectItem value="no">No Concentration</SelectItem>
                </SelectField>
              </div>

              {/* Ritual Filter */}
              <div>
                <label className="text-body mb-2 block text-sm font-medium">
                  Ritual
                </label>
                <SelectField
                  value={filters.ritual}
                  onValueChange={value =>
                    setFilters(prev => ({
                      ...prev,
                      ritual: value as 'all' | 'yes' | 'no',
                    }))
                  }
                >
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Ritual</SelectItem>
                  <SelectItem value="no">No Ritual</SelectItem>
                </SelectField>
              </div>

              {/* Sort Options */}
              <div>
                <label className="text-body mb-2 block text-sm font-medium">
                  Sort By
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SelectField
                      value={sortBy}
                      onValueChange={value =>
                        setSortBy(value as 'name' | 'level' | 'school')
                      }
                    >
                      <SelectItem value="level">Level</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="school">School</SelectItem>
                    </SelectField>
                  </div>
                  <Button
                    onClick={() =>
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    }
                    variant="outline"
                    size="md"
                    title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sortOrder === 'asc' ? (
                      <SortAsc size={16} />
                    ) : (
                      <SortDesc size={16} />
                    )}
                  </Button>
                </div>
              </div>

              {/* Favorites Toggle */}
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={filters.favorites}
                    onCheckedChange={checked =>
                      setFilters(prev => ({
                        ...prev,
                        favorites: checked as boolean,
                      }))
                    }
                  />
                  <span className="text-body flex items-center gap-1 text-sm font-medium">
                    Favorites Only
                    <Star size={16} className="text-accent-yellow-text" />
                  </span>
                </label>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Spell List */}
      <div className="space-y-4">
        {character.spells.length === 0 ? (
          <div className="text-muted py-12 text-center">
            <BookOpen size={64} className="text-faint mx-auto mb-4" />
            <p className="text-lg font-medium">No spells added yet</p>
            <p className="mt-2 text-sm">
              Click &quot;Add Spell&quot; to get started building your spellbook
            </p>
          </div>
        ) : filteredSpells.length === 0 ? (
          <div className="text-muted py-12 text-center">
            <Search size={64} className="text-faint mx-auto mb-4" />
            <p className="text-lg font-medium">No spells match your filters</p>
            <p className="mt-2 text-sm">
              Try adjusting your search terms or clearing some filters
            </p>
            {activeFilterCount > 0 && (
              <Button
                onClick={clearFilters}
                variant="secondary"
                size="md"
                className="mt-4"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        ) : (
          sortedLevels.map(level => (
            <LevelSection
              key={level}
              level={level}
              spells={spellsByLevel[level]}
              isExpanded={expandedLevels.has(level)}
              onToggle={() => toggleLevelExpanded(level)}
              compact={compactView}
              favoriteSpells={favoriteSpells}
              totalLevel={totalLevel}
              onSpellEdit={handleEdit}
              onSpellDelete={handleDelete}
              onSpellView={setViewingSpell}
              onTogglePrepared={handlePreparedToggle}
              onToggleFavorite={toggleSpellFavorite}
              onSpellCast={handleCastSpell}
              onReorder={handleReorderSpellsInLevel(level)}
              showMoveControls={
                editing && sortBy === 'level' && sortOrder === 'asc'
              }
              slotMax={
                level > 0
                  ? character.spellSlots[
                      level as keyof typeof character.spellSlots
                    ]?.max
                  : undefined
              }
              slotUsed={
                level > 0
                  ? character.spellSlots[
                      level as keyof typeof character.spellSlots
                    ]?.used
                  : undefined
              }
            />
          ))
        )}
      </div>

      {/* Add/Edit Spell Dialog */}
      <Dialog
        open={isFormOpen}
        onOpenChange={open => {
          if (!open) resetForm();
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Spell' : 'Add New Spell'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Spell Autocomplete - Only show when adding new spell */}
              {!editingId && (
                <div>
                  <SpellAutocomplete
                    spells={spellbookSpells}
                    onSelect={handleSpellSelect}
                    loading={spellbookLoading}
                    placeholder="Search spells from spellbook database..."
                  />
                </div>
              )}

              {/* Auto-fill success message */}
              {justAutoFilled && (
                <div className="animate-in fade-in slide-in-from-top-2 border-accent-green-border-strong bg-accent-green-bg rounded-lg border-2 p-3 duration-300">
                  <div className="text-accent-green-text flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    <p className="text-sm font-medium">
                      <AppIcon name="confirm" className="inline h-4 w-4" />{' '}
                      Spell details loaded! Review and adjust as needed.
                    </p>
                  </div>
                </div>
              )}

              <SpellFormFields
                formData={formData}
                onChange={setFormData}
                inventoryItems={character.inventoryItems}
                showPreparedOptions
              />

              {/* Form Actions */}
              <div className="border-divider flex justify-end gap-3 border-t-2 pt-4">
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="outline"
                  size="md"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md">
                  {editingId ? 'Update Spell' : 'Add Spell'}
                </Button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* View Spell Modal - Using unified SpellDetailsModal */}
      {viewingSpell && (
        <SpellDetailsModal
          spell={viewingSpell}
          isOpen={true}
          onClose={() => setViewingSpell(null)}
          isFavorite={favoriteSpells.includes(viewingSpell.id)}
          onToggleFavorite={() => toggleSpellFavorite(viewingSpell.id)}
          onCast={() => handleCastSpell(viewingSpell)}
          characterLevel={totalLevel}
        />
      )}

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
          pactMagic={character.pactMagic}
          concentration={character.concentration}
          hasUsedReaction={character.reaction?.hasUsedReaction}
          onCastSpell={handleCastSpellConfirm}
          onResetReaction={toggleReaction}
        />
      )}

      {/* Summon Creature Picker Modal */}
      {summonPickerSpell && (
        <SummonCreaturePickerModal
          open={summonPickerOpen}
          onClose={() => {
            setSummonPickerOpen(false);
            setSummonPickerSpell(null);
          }}
          spell={summonPickerSpell}
          castAtLevel={summonPickerLevel}
          onSummonCreated={addSummon}
          spellAttackBonus={calculateSpellAttackBonus(character)}
          spellcastingAbilityMod={getSpellcastingAbilityModifier(character)}
        />
      )}
    </Section>
  );
};
