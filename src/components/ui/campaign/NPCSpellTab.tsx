'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Moon,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Eye,
  Trash2,
  Plus,
  Star,
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
import { Input } from '@/components/ui/forms/input';
import { Badge } from '@/components/ui/layout/badge';
import { SpellSlotTracker } from '@/components/shared/spells/SpellSlotTracker';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import { SpellAutocomplete } from '@/components/ui/forms/SpellAutocomplete';
import { useSpellsData } from '@/hooks/useSpellsData';
import { useNPCStore } from '@/store/npcStore';
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
} from '@/utils/spellConversion';
import type { CampaignNPC } from '@/types/encounter';
import type { Spell, SpellSlots } from '@/types/character';
import type { ProcessedSpell } from '@/types/spells';
import type { FreeCastMode } from '@/utils/spellConversion';

interface NPCSpellTabProps {
  npc: CampaignNPC;
  campaignCode: string;
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

export function NPCSpellTab({ npc, campaignCode }: NPCSpellTabProps) {
  const sc = npc.spellcasting;

  const [collapsedLevels, setCollapsedLevels] = useState<Set<number>>(
    new Set()
  );
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null);
  const [addSpellOpen, setAddSpellOpen] = useState(false);

  // Add spell form state
  const [freeCastMode, setFreeCastMode] = useState<FreeCastMode>('normal');
  const [freeCastMax, setFreeCastMax] = useState(1);
  const [customSpellName, setCustomSpellName] = useState('');
  const [customSpellLevel, setCustomSpellLevel] = useState(0);
  const [showCustomForm, setShowCustomForm] = useState(false);

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

  // Build spell slots for SpellSlotTracker
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

  const sortedLevels = useMemo(
    () =>
      Object.keys(spellsByLevel)
        .map(Number)
        .sort((a, b) => a - b),
    [spellsByLevel]
  );

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

  const handleRemoveSpell = useCallback(
    (spellId: string) => {
      useNPCStore.getState().removeSpellFromNPC(campaignCode, npc.id, spellId);
    },
    [campaignCode, npc.id]
  );

  const handleAddSpellFromDb = useCallback(
    (processedSpell: ProcessedSpell) => {
      const formData = convertProcessedSpellToFormData(processedSpell);
      // Apply free cast mode
      formData.freeCastMode = freeCastMode;
      formData.freeCastMax = freeCastMax;
      const spell = convertFormDataToSpell(formData);
      useNPCStore.getState().addSpellToNPC(campaignCode, npc.id, spell);
      setAddSpellOpen(false);
      resetAddForm();
    },
    [campaignCode, npc.id, freeCastMode, freeCastMax]
  );

  const handleAddCustomSpell = useCallback(() => {
    if (!customSpellName.trim()) return;
    const now = new Date().toISOString();
    const spell: Spell = {
      id: `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: customSpellName.trim(),
      level: customSpellLevel,
      school: 'Unknown',
      castingTime: '1 action',
      range: 'Self',
      components: { verbal: false, somatic: false, material: false },
      duration: 'Instantaneous',
      description: '',
      freeCastMax:
        freeCastMode === 'at_will'
          ? 0
          : freeCastMode === 'innate'
            ? freeCastMax
            : undefined,
      freeCastsUsed: freeCastMode !== 'normal' ? 0 : undefined,
      createdAt: now,
      updatedAt: now,
    };
    useNPCStore.getState().addSpellToNPC(campaignCode, npc.id, spell);
    setAddSpellOpen(false);
    resetAddForm();
  }, [
    campaignCode,
    npc.id,
    customSpellName,
    customSpellLevel,
    freeCastMode,
    freeCastMax,
  ]);

  function resetAddForm() {
    setFreeCastMode('normal');
    setFreeCastMax(1);
    setCustomSpellName('');
    setCustomSpellLevel(0);
    setShowCustomForm(false);
  }

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
    <div className="flex min-h-full flex-col space-y-3">
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

      {/* Spell Slots section */}
      <div>
        <SectionHeader
          title="Spell Slots"
          isCollapsed={isSectionCollapsed('slots')}
          onToggle={() => toggleSection('slots')}
          badge={
            isSectionCollapsed('slots') ? (
              <Badge variant="neutral" size="sm">
                {totalUsedSlots}/{totalMaxSlots} used
              </Badge>
            ) : undefined
          }
        />
        {!isSectionCollapsed('slots') && (
          <div className="mt-2">
            <SpellSlotTracker
              spellSlots={spellSlots}
              onSpellSlotChange={handleSpellSlotChange}
              onResetSpellSlots={handleResetSlots}
              compact
              hideResetButtons
            />
          </div>
        )}
      </div>

      {/* Spell List section */}
      <div>
        <SectionHeader
          title="Spell List"
          isCollapsed={isSectionCollapsed('spells')}
          onToggle={() => toggleSection('spells')}
          badge={
            isSectionCollapsed('spells') ? (
              <Badge variant="neutral" size="sm">
                {totalSpells} {totalSpells === 1 ? 'spell' : 'spells'}
              </Badge>
            ) : undefined
          }
        />
        {!isSectionCollapsed('spells') && (
          <div className="mt-2">
            {/* Spell List — collapsible by level */}
            {sortedLevels.length > 0 ? (
              <div className="space-y-2">
                {sortedLevels.map(level => {
                  const spells = spellsByLevel[level];
                  const isCollapsed = collapsedLevels.has(level);
                  const isCantrip = level === 0;

                  return (
                    <div
                      key={level}
                      className={`overflow-hidden rounded-lg border-2 ${
                        isCantrip
                          ? 'border-accent-amber-border'
                          : 'border-accent-purple-border'
                      }`}
                    >
                      {/* Level header */}
                      <button
                        type="button"
                        onClick={() => toggleLevel(level)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${
                          isCantrip
                            ? 'bg-accent-amber-bg hover:bg-accent-amber-bg'
                            : 'bg-accent-purple-bg hover:bg-accent-purple-bg'
                        }`}
                      >
                        <div className="flex items-center gap-2">
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
                        </div>
                        <Badge
                          variant={isCantrip ? 'warning' : 'secondary'}
                          size="sm"
                        >
                          {spells.length}
                        </Badge>
                      </button>

                      {/* Spell rows */}
                      {!isCollapsed && (
                        <div className="divide-y divide-[var(--border-divider)]">
                          {spells.map(spell => (
                            <SpellRow
                              key={spell.id}
                              spell={spell}
                              onView={() => setViewingSpell(spell)}
                              onRemove={() => handleRemoveSpell(spell.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Star className="text-faint mb-2 h-8 w-8" />
                <p className="text-muted text-sm">No spells added yet</p>
              </div>
            )}
          </div>
        )}

        {/* Add Spell button — always visible, pushed to bottom */}
        <Button
          variant="secondary"
          size="sm"
          className="mt-auto pt-2"
          onClick={() => setAddSpellOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add Spell
        </Button>
      </div>

      {/* Spell Details modal */}
      {viewingSpell && (
        <SpellDetailsModal
          spell={viewingSpell}
          isOpen={!!viewingSpell}
          onClose={() => setViewingSpell(null)}
        />
      )}

      {/* Add Spell dialog */}
      <Dialog
        open={addSpellOpen}
        onOpenChange={open => {
          if (!open) {
            setAddSpellOpen(false);
            resetAddForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Spell to {npc.name}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {/* Free cast mode selector */}
            <div>
              <label className="text-heading mb-1.5 block text-sm font-medium">
                Cast Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFreeCastMode('normal')}
                  className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                    freeCastMode === 'normal'
                      ? 'border-accent-purple-border bg-accent-purple-bg text-accent-purple-text'
                      : 'border-divider bg-surface-raised text-muted hover:text-body'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setFreeCastMode('at_will')}
                  className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                    freeCastMode === 'at_will'
                      ? 'border-accent-purple-border bg-accent-purple-bg text-accent-purple-text'
                      : 'border-divider bg-surface-raised text-muted hover:text-body'
                  }`}
                >
                  At Will
                </button>
                <button
                  type="button"
                  onClick={() => setFreeCastMode('innate')}
                  className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                    freeCastMode === 'innate'
                      ? 'border-accent-purple-border bg-accent-purple-bg text-accent-purple-text'
                      : 'border-divider bg-surface-raised text-muted hover:text-body'
                  }`}
                >
                  Innate
                </button>
              </div>
              {freeCastMode === 'innate' && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-muted text-sm">Uses per day:</label>
                  <Input
                    type="number"
                    min={1}
                    max={9}
                    value={freeCastMax}
                    onChange={e =>
                      setFreeCastMax(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-20"
                    size="sm"
                  />
                </div>
              )}
            </div>

            {/* Database search */}
            <SpellAutocomplete
              spells={dbSpells}
              onSelect={handleAddSpellFromDb}
              loading={spellsLoading}
            />

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="border-divider flex-1 border-t" />
              <span className="text-muted text-xs">or</span>
              <div className="border-divider flex-1 border-t" />
            </div>

            {/* Custom spell quick add */}
            {!showCustomForm ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCustomForm(true)}
                className="w-full"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Quick Custom Spell
              </Button>
            ) : (
              <div className="bg-surface-secondary space-y-3 rounded-lg p-3">
                <h4 className="text-heading text-sm font-semibold">
                  Custom Spell
                </h4>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Spell name"
                      value={customSpellName}
                      onChange={e => setCustomSpellName(e.target.value)}
                      size="sm"
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min={0}
                      max={9}
                      value={customSpellLevel}
                      onChange={e =>
                        setCustomSpellLevel(
                          Math.max(
                            0,
                            Math.min(9, parseInt(e.target.value) || 0)
                          )
                        )
                      }
                      placeholder="Lv"
                      size="sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setShowCustomForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={handleAddCustomSpell}
                    disabled={!customSpellName.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setAddSpellOpen(false);
                resetAddForm();
              }}
            >
              Close
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
  onRemove,
}: {
  spell: Spell;
  onView: () => void;
  onRemove: () => void;
}) {
  const isAtWill = spell.freeCastMax !== undefined && spell.freeCastMax === 0;
  const isInnate = spell.freeCastMax !== undefined && spell.freeCastMax > 0;
  const innateRemaining = isInnate
    ? spell.freeCastMax! - (spell.freeCastsUsed ?? 0)
    : 0;

  return (
    <div className="bg-surface-raised flex items-center gap-2 px-3 py-1.5">
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
          onClick={onView}
          className="text-muted hover:text-accent-blue-text rounded p-1 transition-colors"
          title="View spell details"
        >
          <Eye className="h-3.5 w-3.5" />
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
  );
}
