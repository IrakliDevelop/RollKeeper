'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Moon,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Eye,
  Trash2,
  Star,
  Wand2,
  Filter,
  Pencil,
  Tag,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import { SpellAutocomplete } from '@/components/ui/forms/SpellAutocomplete';
import { useSpellsData } from '@/hooks/useSpellsData';
import { useToast, ToastContainer } from '@/components/ui/feedback/Toast';
import { SpellSlotTracker, SpellFormFields } from '@/components/shared/spells';
import { useNPCStore } from '@/store/npcStore';
import { useEncounterStore } from '@/store/encounterStore';
import { useDmStore } from '@/store/dmStore';
import {
  getNPCSpellSlots,
  calculateNPCSpellAttack,
  calculateNPCSpellDC,
  getNPCSpellcastingAbilityScore,
  getProficiencyBonusFromCR,
  resetNPCSpellcasting,
} from '@/utils/npcSpellcasting';
import {
  convertProcessedSpellToFormData,
  convertFormDataToSpell,
  spellToFormData,
  createInitialSpellFormData,
} from '@/utils/spellConversion';
import type { CampaignNPC } from '@/types/encounter';
import type { Spell, SpellSlots } from '@/types/character';
import type { ProcessedSpell } from '@/types/spells';
import type { SpellFormData } from '@/utils/spellConversion';

interface NPCSpellTabProps {
  npc: CampaignNPC;
  campaignCode: string;
  addSpellRef?: React.MutableRefObject<(() => void) | null>;
  encounterId?: string;
  npcEntityId?: string;
}

type SpellCategory = 'regular' | 'at_will' | 'innate';

const SPELL_CATEGORY_LABELS: Record<SpellCategory, string> = {
  regular: 'Slot',
  at_will: 'At Will',
  innate: 'Innate',
};

const ALL_SPELL_CATEGORIES: SpellCategory[] = ['regular', 'at_will', 'innate'];

function getSpellCategory(spell: Spell): SpellCategory {
  if (spell.freeCastMax !== undefined && spell.freeCastMax === 0)
    return 'at_will';
  if (spell.freeCastMax !== undefined && spell.freeCastMax > 0) return 'innate';
  return 'regular';
}

const ABILITY_LABEL_MAP: Record<string, string> = {
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

const LEVEL_NAMES: Record<number, string> = {
  0: 'Cantrips',
  1: 'Level 1',
  2: 'Level 2',
  3: 'Level 3',
  4: 'Level 4',
  5: 'Level 5',
  6: 'Level 6',
  7: 'Level 7',
  8: 'Level 8',
  9: 'Level 9',
};

function getAbilityScores(npc: CampaignNPC) {
  if (npc.monsterStatBlock) {
    return {
      str: npc.monsterStatBlock.str,
      dex: npc.monsterStatBlock.dex,
      con: npc.monsterStatBlock.con,
      int: npc.monsterStatBlock.int,
      wis: npc.monsterStatBlock.wis,
      cha: npc.monsterStatBlock.cha,
    };
  }
  if (npc.abilityScores) {
    return npc.abilityScores;
  }
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
}

function getProfBonus(npc: CampaignNPC): number {
  if (npc.proficiencyBonus !== undefined) return npc.proficiencyBonus;
  return getProficiencyBonusFromCR(
    npc.monsterStatBlock?.cr,
    npc.spellcasting?.casterLevel
  );
}

function SectionHeader({
  title,
  isCollapsed,
  onToggle,
  badge,
}: {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="bg-surface-secondary text-heading hover:bg-surface-hover flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
    >
      <div className="flex items-center gap-2">
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
        />
        {title}
      </div>
      {badge}
    </button>
  );
}

export function NPCSpellTab({
  npc,
  campaignCode,
  addSpellRef,
  encounterId,
  npcEntityId,
}: NPCSpellTabProps) {
  const sc = npc.spellcasting;
  const { toasts, dismissToast, addToast } = useToast();
  const campaign = useDmStore(state =>
    state.campaigns.find(c => c.code === campaignCode)
  );
  const spellSlotDisplayMode: 'inline' | 'tracker' =
    campaign?.dmDashboardUi?.npcInlineSpellSlots === false &&
    campaign?.dmDashboardUi?.npcSeparateSpellSlotTracker === true
      ? 'tracker'
      : 'inline';
  const showInlineSpellSlots = spellSlotDisplayMode === 'inline';
  const showSeparateSpellSlotTracker = spellSlotDisplayMode === 'tracker';

  // Read concentration state from encounter entity if in encounter context
  const encounterConcentration = useEncounterStore(state => {
    if (!encounterId || !npcEntityId) return undefined;
    const enc = state.encounters.find(e => e.id === encounterId);
    const entity = enc?.entities.find(e => e.id === npcEntityId);
    return entity?.concentrationSpell;
  });

  const [collapsedLevels, setCollapsedLevels] = useState<Set<number>>(
    new Set()
  );
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null);
  const [castingSpell, setCastingSpell] = useState<Spell | null>(null);
  const [addSpellOpen, setAddSpellOpen] = useState(false);
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<SpellCategory>>(
    () => new Set(ALL_SPELL_CATEGORIES)
  );
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(
    () => new Set()
  );

  // Expose add-spell trigger to parent via ref
  React.useEffect(() => {
    if (addSpellRef) {
      addSpellRef.current = () => setAddSpellOpen(true);
    }
    return () => {
      if (addSpellRef) addSpellRef.current = null;
    };
  }, [addSpellRef]);

  // Add/edit spell form state
  const [addFormData, setAddFormData] = useState<SpellFormData>(
    createInitialSpellFormData
  );
  const [addTags, setAddTags] = useState<string[]>([]);
  const [editFormData, setEditFormData] = useState<SpellFormData>(
    createInitialSpellFormData
  );
  const [editTags, setEditTags] = useState<string[]>([]);

  const { spells: dbSpells, loading: spellsLoading } = useSpellsData();

  const abilityScores = getAbilityScores(npc);
  const profBonus = getProfBonus(npc);
  const abilityScore = sc
    ? getNPCSpellcastingAbilityScore(sc.ability, abilityScores)
    : 10;
  const spellAttack = sc
    ? calculateNPCSpellAttack(sc, abilityScore, profBonus)
    : 0;
  const spellDC = sc ? calculateNPCSpellDC(sc, abilityScore, profBonus) : 10;

  // Build spell slots
  const rawSlots = useMemo(
    () => (sc ? getNPCSpellSlots(sc.casterLevel, sc.slotOverrides) : {}),
    [sc]
  );

  const slotsUsed = sc?.slotsUsed;
  const spellSlots: SpellSlots = useMemo(
    () => ({
      1: { max: rawSlots[1] ?? 0, used: slotsUsed?.[1] ?? 0 },
      2: { max: rawSlots[2] ?? 0, used: slotsUsed?.[2] ?? 0 },
      3: { max: rawSlots[3] ?? 0, used: slotsUsed?.[3] ?? 0 },
      4: { max: rawSlots[4] ?? 0, used: slotsUsed?.[4] ?? 0 },
      5: { max: rawSlots[5] ?? 0, used: slotsUsed?.[5] ?? 0 },
      6: { max: rawSlots[6] ?? 0, used: slotsUsed?.[6] ?? 0 },
      7: { max: rawSlots[7] ?? 0, used: slotsUsed?.[7] ?? 0 },
      8: { max: rawSlots[8] ?? 0, used: slotsUsed?.[8] ?? 0 },
      9: { max: rawSlots[9] ?? 0, used: slotsUsed?.[9] ?? 0 },
    }),
    [rawSlots, slotsUsed]
  );

  const scSpells = sc?.spells;
  // Group spells by level
  const spellsByLevel = useMemo(() => {
    const groups: Record<number, Spell[]> = {};
    if (!scSpells) return groups;
    for (const spell of scSpells) {
      const lvl = spell.level;
      if (!groups[lvl]) groups[lvl] = [];
      groups[lvl].push(spell);
    }
    return groups;
  }, [scSpells]);

  const isCategoryFiltering =
    activeCategories.size > 0 &&
    activeCategories.size < ALL_SPELL_CATEGORIES.length;
  const isTagFiltering = activeTagFilters.size > 0;
  const isFiltering = isCategoryFiltering || isTagFiltering;

  const filteredSpellsByLevel = useMemo(() => {
    if (!isFiltering) return spellsByLevel;
    const filtered: Record<number, Spell[]> = {};
    for (const [lvl, spells] of Object.entries(spellsByLevel)) {
      const matching = spells.filter(s => {
        if (isCategoryFiltering && !activeCategories.has(getSpellCategory(s)))
          return false;
        if (
          isTagFiltering &&
          (!s.tags || !s.tags.some(t => activeTagFilters.has(t)))
        )
          return false;
        return true;
      });
      if (matching.length > 0) filtered[Number(lvl)] = matching;
    }
    return filtered;
  }, [
    spellsByLevel,
    activeCategories,
    activeTagFilters,
    isFiltering,
    isCategoryFiltering,
    isTagFiltering,
  ]);

  const toggleCategory = useCallback((cat: SpellCategory) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size === 1) return prev;
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<SpellCategory, number> = {
      regular: 0,
      at_will: 0,
      innate: 0,
    };
    if (!scSpells) return counts;
    for (const spell of scSpells) {
      counts[getSpellCategory(spell)]++;
    }
    return counts;
  }, [scSpells]);

  const hasMultipleCategories =
    (categoryCounts.regular > 0 ? 1 : 0) +
      (categoryCounts.at_will > 0 ? 1 : 0) +
      (categoryCounts.innate > 0 ? 1 : 0) >
    1;

  const allSpellTags = useMemo(() => {
    if (!scSpells) return [];
    const tagSet = new Set<string>();
    for (const spell of scSpells) {
      if (spell.tags) {
        for (const t of spell.tags) tagSet.add(t);
      }
    }
    return Array.from(tagSet).sort();
  }, [scSpells]);

  const toggleTagFilter = useCallback((tag: string) => {
    setActiveTagFilters(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  // Merge spell levels with slot levels so empty-spell levels with slots still show
  const sortedLevels = useMemo(() => {
    const levels = new Set(
      Object.keys(isFiltering ? filteredSpellsByLevel : spellsByLevel).map(
        Number
      )
    );
    if (!isFiltering) {
      for (let l = 1; l <= 9; l++) {
        if ((spellSlots[l as keyof SpellSlots]?.max ?? 0) > 0) levels.add(l);
      }
    }
    return Array.from(levels).sort((a, b) => a - b);
  }, [spellsByLevel, filteredSpellsByLevel, spellSlots, isFiltering]);

  const toggleLevel = useCallback((level: number) => {
    setCollapsedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }, []);

  const collapsedSections = npc.collapsedSpellSections ?? [];
  const isSectionCollapsed = (section: string) =>
    collapsedSections.includes(section);

  const toggleSection = useCallback(
    (section: string) => {
      const current = npc.collapsedSpellSections ?? [];
      const next = current.includes(section)
        ? current.filter(s => s !== section)
        : [...current, section];
      useNPCStore.getState().updateNPC(campaignCode, npc.id, {
        collapsedSpellSections: next,
      });
    },
    [campaignCode, npc.id, npc.collapsedSpellSections]
  );

  const handleSpellSlotChange = useCallback(
    (level: keyof SpellSlots, used: number) => {
      useNPCStore
        .getState()
        .setNPCSpellSlotUsed(campaignCode, npc.id, level as number, used);
    },
    [campaignCode, npc.id]
  );

  const handleResetSlots = useCallback(() => {
    if (!npc.spellcasting) return;
    const reset = resetNPCSpellcasting(npc.spellcasting);
    useNPCStore
      .getState()
      .updateNPC(campaignCode, npc.id, { spellcasting: reset });
  }, [campaignCode, npc.id, npc.spellcasting]);

  const handleLongRest = useCallback(() => {
    useNPCStore.getState().longRestNPC(campaignCode, npc.id);
  }, [campaignCode, npc.id]);

  const handleCastSpell = useCallback(
    (spellLevel: number, useFreecast: boolean) => {
      if (!castingSpell) return;
      const store = useNPCStore.getState();
      if (useFreecast) {
        store.useNPCFreeCast(campaignCode, npc.id, castingSpell.id);
      } else if (spellLevel > 0) {
        const currentUsed = sc?.slotsUsed?.[spellLevel] ?? 0;
        store.setNPCSpellSlotUsed(
          campaignCode,
          npc.id,
          spellLevel,
          currentUsed + 1
        );
      }

      // Set concentration on encounter entity if applicable
      if (castingSpell.concentration && encounterId && npcEntityId) {
        useEncounterStore
          .getState()
          .setConcentration(encounterId, npcEntityId, castingSpell.name);
      }

      // Show success toast
      const levelText =
        spellLevel === 0
          ? 'cantrip'
          : useFreecast
            ? `innate cast`
            : `level ${spellLevel}`;
      addToast({
        type: 'success',
        title: `${npc.name} cast ${castingSpell.name}`,
        message: `Cast as ${levelText}`,
        duration: 3000,
      });
    },
    [
      campaignCode,
      npc.id,
      npc.name,
      castingSpell,
      sc?.slotsUsed,
      encounterId,
      npcEntityId,
      addToast,
    ]
  );

  const handleRemoveSpell = useCallback(
    (spellId: string) => {
      useNPCStore.getState().removeSpellFromNPC(campaignCode, npc.id, spellId);
    },
    [campaignCode, npc.id]
  );

  const handleAddSpellFromDb = useCallback((processedSpell: ProcessedSpell) => {
    setAddFormData(convertProcessedSpellToFormData(processedSpell));
  }, []);

  const handleAddSubmit = useCallback(() => {
    if (!addFormData.name.trim()) return;
    const spell = convertFormDataToSpell(addFormData);
    if (addTags.length > 0) spell.tags = [...addTags];
    useNPCStore.getState().addSpellToNPC(campaignCode, npc.id, spell);
    setAddSpellOpen(false);
    setAddFormData(createInitialSpellFormData());
    setAddTags([]);
  }, [campaignCode, npc.id, addFormData, addTags]);

  const handleEditSpellOpen = useCallback((spell: Spell) => {
    setEditingSpell(spell);
    setEditFormData(spellToFormData(spell));
    setEditTags(spell.tags ?? []);
  }, []);

  const handleSaveEditSpell = useCallback(() => {
    if (!editingSpell) return;
    const updates = convertFormDataToSpell(editFormData, editingSpell.id);
    // Preserve existing freeCastsUsed — don't reset usage count when editing
    if (updates.freeCastMax !== undefined) {
      updates.freeCastsUsed = editingSpell.freeCastsUsed ?? 0;
    }
    updates.tags = editTags.length > 0 ? editTags : undefined;
    // Preserve original createdAt — convertFormDataToSpell always generates a new one
    const { createdAt: _createdAt, ...updatesWithoutCreatedAt } = updates;
    useNPCStore
      .getState()
      .updateSpellOnNPC(
        campaignCode,
        npc.id,
        editingSpell.id,
        updatesWithoutCreatedAt
      );
    setEditingSpell(null);
  }, [campaignCode, npc.id, editingSpell, editFormData, editTags]);

  if (!sc) return null;

  const attackStr = spellAttack >= 0 ? `+${spellAttack}` : `${spellAttack}`;

  const totalMaxSlots = Object.values(spellSlots).reduce(
    (sum, s) => sum + s.max,
    0
  );
  const totalUsedSlots = Object.values(spellSlots).reduce(
    (sum, s) => sum + s.used,
    0
  );
  const totalSpells = sc.spells?.length ?? 0;

  return (
    <div className="space-y-3">
      {/* Stats section */}
      <div>
        <SectionHeader
          title="Spellcasting Stats"
          isCollapsed={isSectionCollapsed('stats')}
          onToggle={() => toggleSection('stats')}
          badge={
            isSectionCollapsed('stats') ? (
              <Badge variant="neutral" size="sm">
                Lv {sc.casterLevel} · DC {spellDC} · Atk {attackStr}
              </Badge>
            ) : undefined
          }
        />
        {!isSectionCollapsed('stats') && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" size="sm">
                Caster Lv {sc.casterLevel}
              </Badge>
              <Badge variant="neutral" size="sm">
                {ABILITY_LABEL_MAP[sc.ability] ?? sc.ability}
              </Badge>
              <Badge variant="info" size="sm">
                Spell Attack: {attackStr}
              </Badge>
              <Badge variant="warning" size="sm">
                Save DC: {spellDC}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="xs"
                onClick={handleLongRest}
                title="Long Rest (reset HP, slots, free casts)"
              >
                <Moon className="mr-1 h-3.5 w-3.5" />
                Long Rest
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={handleResetSlots}
                title="Reset spell slots and free casts only"
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Reset Slots
              </Button>
            </div>
          </div>
        )}
      </div>

      {showSeparateSpellSlotTracker && (
        <div>
          <SectionHeader
            title="Spell Slot Tracker"
            isCollapsed={isSectionCollapsed('slotTracker')}
            onToggle={() => toggleSection('slotTracker')}
            badge={
              isSectionCollapsed('slotTracker') ? (
                <Badge variant="neutral" size="sm">
                  {totalUsedSlots}/{totalMaxSlots} slots used
                </Badge>
              ) : undefined
            }
          />
          {!isSectionCollapsed('slotTracker') && (
            <div className="mt-2">
              <SpellSlotTracker
                spellSlots={spellSlots}
                compact
                hideResetButtons
                onSpellSlotChange={handleSpellSlotChange}
              />
            </div>
          )}
        </div>
      )}

      {/* Spells & Slots (unified) */}
      <div>
        <SectionHeader
          title="Spells"
          isCollapsed={isSectionCollapsed('spells')}
          onToggle={() => toggleSection('spells')}
          badge={
            isSectionCollapsed('spells') ? (
              <Badge variant="neutral" size="sm">
                {totalSpells} {totalSpells === 1 ? 'spell' : 'spells'}
                {showInlineSpellSlots && (
                  <>
                    {' '}
                    · {totalUsedSlots}/{totalMaxSlots} slots used
                  </>
                )}
              </Badge>
            ) : undefined
          }
        />
        {!isSectionCollapsed('spells') && (
          <div className="mt-2">
            {/* Filters — categories + tags */}
            {(hasMultipleCategories || allSpellTags.length > 0) && (
              <div className="mb-2 space-y-1.5">
                {hasMultipleCategories && (
                  <div className="flex items-center gap-1.5">
                    <Filter className="text-muted h-3.5 w-3.5 shrink-0" />
                    {ALL_SPELL_CATEGORIES.map(cat => {
                      const count = categoryCounts[cat];
                      if (count === 0) return null;
                      const isActive = activeCategories.has(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                            isActive
                              ? 'border-accent-purple-border bg-accent-purple-bg text-accent-purple-text'
                              : 'border-divider bg-surface-raised text-faint hover:text-muted'
                          }`}
                        >
                          {SPELL_CATEGORY_LABELS[cat]}{' '}
                          <span className="opacity-60">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {allSpellTags.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Tag className="text-muted h-3.5 w-3.5 shrink-0" />
                    {allSpellTags.map(tag => {
                      const isActive = activeTagFilters.has(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTagFilter(tag)}
                          className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                            isActive
                              ? 'border-accent-amber-border bg-accent-amber-bg text-accent-amber-text'
                              : 'border-divider bg-surface-raised text-faint hover:text-muted'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                    {isTagFiltering && (
                      <button
                        type="button"
                        onClick={() => setActiveTagFilters(new Set())}
                        className="text-muted hover:text-body text-xs transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {sortedLevels.length > 0 ? (
              <div className="space-y-2">
                {sortedLevels.map(level => {
                  const spells =
                    (isFiltering
                      ? filteredSpellsByLevel[level]
                      : spellsByLevel[level]) ?? [];
                  const isCollapsed = collapsedLevels.has(level);
                  const isCantrip = level === 0;
                  const slot = spellSlots[level as keyof SpellSlots];
                  const hasSlots = !isCantrip && slot && slot.max > 0;
                  const remaining = hasSlots ? slot.max - slot.used : 0;

                  return (
                    <div
                      key={level}
                      className={`overflow-hidden rounded-lg border-2 ${
                        isCantrip
                          ? 'border-accent-amber-border'
                          : 'border-accent-purple-border'
                      }`}
                    >
                      {/* Level header with inline slots */}
                      <div
                        className={`flex w-full items-center gap-2 px-3 py-2 transition-colors ${
                          isCantrip
                            ? 'bg-accent-amber-bg'
                            : 'bg-accent-purple-bg'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleLevel(level)}
                          className="flex items-center gap-2"
                        >
                          {isCollapsed ? (
                            <ChevronRight
                              className={`h-4 w-4 ${isCantrip ? 'text-accent-amber-text' : 'text-accent-purple-text'}`}
                            />
                          ) : (
                            <ChevronDown
                              className={`h-4 w-4 ${isCantrip ? 'text-accent-amber-text' : 'text-accent-purple-text'}`}
                            />
                          )}
                          <span
                            className={`text-sm font-semibold ${isCantrip ? 'text-accent-amber-text' : 'text-accent-purple-text'}`}
                          >
                            {LEVEL_NAMES[level] ?? `Level ${level}`}
                          </span>
                          {spells.length > 0 && (
                            <Badge
                              variant={isCantrip ? 'warning' : 'secondary'}
                              size="sm"
                            >
                              {spells.length}
                            </Badge>
                          )}
                        </button>

                        {/* Inline slot dots */}
                        {showInlineSpellSlots && hasSlots && (
                          <div className="ml-auto flex items-center gap-1.5">
                            <div
                              className="flex gap-1"
                              onClick={e => e.stopPropagation()}
                            >
                              {Array.from({ length: slot.max }, (_, index) => {
                                const isUsed = index < slot.used;
                                return (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => {
                                      const newUsed = isUsed
                                        ? slot.used - 1
                                        : index + 1;
                                      handleSpellSlotChange(
                                        level as keyof SpellSlots,
                                        Math.max(0, Math.min(newUsed, slot.max))
                                      );
                                    }}
                                    className={`h-4 w-4 cursor-pointer rounded-full border-2 transition-all ${
                                      isUsed
                                        ? 'border-red-500 bg-red-500 opacity-70 hover:scale-110'
                                        : 'border-emerald-400 bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.4)] hover:scale-110'
                                    }`}
                                    title={`Slot ${index + 1} — ${isUsed ? 'Used' : 'Available'}`}
                                  />
                                );
                              })}
                            </div>
                            <span
                              className={`text-[10px] font-bold ${
                                remaining === 0
                                  ? 'text-accent-red-text'
                                  : 'text-heading'
                              }`}
                            >
                              {remaining}/{slot.max}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Spell rows */}
                      {!isCollapsed && spells.length > 0 && (
                        <div className="divide-y divide-[var(--border-divider)]">
                          {spells.map(spell => (
                            <SpellRow
                              key={spell.id}
                              spell={spell}
                              onView={() => setViewingSpell(spell)}
                              onEdit={() => handleEditSpellOpen(spell)}
                              onRemove={() => handleRemoveSpell(spell.id)}
                              onCast={() => setCastingSpell(spell)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <Star className="text-faint mb-2 h-8 w-8" />
                <p className="text-muted text-sm">No spells added yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spell Details modal */}
      {viewingSpell && (
        <SpellDetailsModal
          spell={viewingSpell}
          isOpen={!!viewingSpell}
          onClose={() => setViewingSpell(null)}
        />
      )}

      {/* Cast Spell modal */}
      {castingSpell && (
        <SpellCastModal
          isOpen={!!castingSpell}
          onClose={() => setCastingSpell(null)}
          spell={castingSpell}
          spellSlots={spellSlots}
          concentration={{
            isConcentrating: !!encounterConcentration,
            spellName: encounterConcentration,
          }}
          onCastSpell={handleCastSpell}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Add Spell dialog */}
      <Dialog
        open={addSpellOpen}
        onOpenChange={open => {
          if (!open) {
            setAddSpellOpen(false);
            setAddFormData(createInitialSpellFormData());
            setAddTags([]);
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Add Spell to {npc.name}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {/* DB search — pre-fills all form fields on select */}
            <div className="border-accent-purple-border bg-accent-purple-bg/30 rounded-lg border-2 p-4">
              <SpellAutocomplete
                spells={dbSpells}
                onSelect={handleAddSpellFromDb}
                loading={spellsLoading}
                placeholder="Search spells from database to auto-fill..."
              />
            </div>

            <SpellFormFields
              formData={addFormData}
              onChange={setAddFormData}
              tags={addTags}
              onTagsChange={setAddTags}
              existingTags={allSpellTags}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setAddSpellOpen(false);
                setAddFormData(createInitialSpellFormData());
                setAddTags([]);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddSubmit}
              disabled={!addFormData.name.trim()}
            >
              Add Spell
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Spell dialog */}
      <Dialog
        open={!!editingSpell}
        onOpenChange={open => {
          if (!open) setEditingSpell(null);
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Edit: {editingSpell?.name}</DialogTitle>
          </DialogHeader>
          {editingSpell && (
            <DialogBody>
              <SpellFormFields
                formData={editFormData}
                onChange={setEditFormData}
                tags={editTags}
                onTagsChange={setEditTags}
                existingTags={allSpellTags}
              />
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingSpell(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEditSpell}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----- Spell Row ----- */

function SpellRow({
  spell,
  onView,
  onEdit,
  onRemove,
  onCast,
}: {
  spell: Spell;
  onView: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onCast: () => void;
}) {
  const isAtWill = spell.freeCastMax !== undefined && spell.freeCastMax === 0;
  const isInnate = spell.freeCastMax !== undefined && spell.freeCastMax > 0;
  const innateRemaining = isInnate
    ? spell.freeCastMax! - (spell.freeCastsUsed ?? 0)
    : 0;
  const tags = spell.tags ?? [];

  return (
    <div className="bg-surface-raised space-y-0.5 px-3 py-1.5">
      <div className="flex items-center gap-2">
        {/* Favorite star for at-will/innate */}
        {(isAtWill || isInnate) && (
          <Star className="text-accent-amber-text h-3.5 w-3.5 shrink-0" />
        )}

        {/* Spell name */}
        <span className="text-heading min-w-0 flex-1 truncate text-sm font-medium">
          {spell.name}
        </span>

        {/* Level badge */}
        <Badge variant={spell.level === 0 ? 'warning' : 'secondary'} size="sm">
          {spell.level === 0 ? 'C' : `L${spell.level}`}
        </Badge>

        {/* School */}
        {spell.school && spell.school !== 'Unknown' && (
          <span className="text-faint hidden text-xs sm:inline">
            {spell.school}
          </span>
        )}

        {/* At-will / Innate badges */}
        {isAtWill && (
          <Badge variant="warning" size="sm">
            At Will
          </Badge>
        )}
        {isInnate && (
          <Badge variant={innateRemaining > 0 ? 'success' : 'danger'} size="sm">
            {innateRemaining}/{spell.freeCastMax}
          </Badge>
        )}

        {/* Concentration */}
        {spell.concentration && (
          <Badge variant="info" size="sm">
            C
          </Badge>
        )}

        {/* Ritual */}
        {spell.ritual && (
          <Badge variant="neutral" size="sm">
            R
          </Badge>
        )}

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onCast}
            className="text-muted hover:text-accent-purple-text rounded p-1 transition-colors"
            title="Cast spell"
          >
            <Wand2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onView}
            className="text-muted hover:text-accent-blue-text rounded p-1 transition-colors"
            title="View spell details"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="text-muted hover:text-accent-amber-text rounded p-1 transition-colors"
            title="Edit spell"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-muted hover:text-accent-red-text rounded p-1 transition-colors"
            title="Remove spell"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-5">
          {tags.map(tag => (
            <span
              key={tag}
              className="border-accent-amber-border bg-accent-amber-bg text-accent-amber-text rounded border px-1.5 py-0 text-[10px] font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
