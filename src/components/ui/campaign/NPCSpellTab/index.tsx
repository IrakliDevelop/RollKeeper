'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Star, Filter, Tag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import { SpellAutocomplete } from '@/components/ui/forms/SpellAutocomplete';
import { useSpellsData } from '@/hooks/useSpellsData';
import { useToast, ToastContainer } from '@/components/ui/feedback/Toast';
import { SpellSlotTracker, SpellFormFields } from '@/components/shared/spells';
import { NpcSpellRow } from '../NpcSpellRow';
import { SpellcastingSummary } from './SpellcastingSummary';
import { SpellLevelSection } from './SpellLevelSection';
import {
  useNpcSpellSlots,
  useSpellFilters,
  useSpellSlotActions,
} from './NPCSpellTab.hooks';
import {
  ALL_SPELL_CATEGORIES,
  SPELL_CATEGORY_LABELS,
  castMessage,
  getAbilityScores,
  getProfBonus,
} from './NPCSpellTab.utils';
import { useNPCStore } from '@/store/npcStore';
import { useEncounterStore } from '@/store/encounterStore';
import { useDmStore } from '@/store/dmStore';
import {
  calculateNPCSpellAttack,
  calculateNPCSpellDC,
  getNPCSpellcastingAbilityScore,
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
  /** Hides spell Edit and Remove; casting, pips and Reset slots stay. */
  readOnly?: boolean;
  /** Where focus returns after the add dialog closes. */
  addSpellButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

const NO_SPELLS: Spell[] = [];

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
  const showInlineSpellSlots = !(
    campaign?.dmDashboardUi?.npcInlineSpellSlots === false &&
    campaign?.dmDashboardUi?.npcSeparateSpellSlotTracker === true
  );

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

  const abilityScore = sc
    ? getNPCSpellcastingAbilityScore(sc.ability, getAbilityScores(npc))
    : 10;
  const profBonus = getProfBonus(npc);
  const spellAttack = sc
    ? calculateNPCSpellAttack(sc, abilityScore, profBonus)
    : 0;
  const spellDC = sc ? calculateNPCSpellDC(sc, abilityScore, profBonus) : 10;

  const { spellSlots, totals } = useNpcSpellSlots(npc);
  const { changeSlot, resetSlots } = useSpellSlotActions(campaignCode, npc.id);
  const {
    spellsByLevel,
    filteredSpellsByLevel,
    isFiltering,
    categoryCounts,
    activeCategories,
    toggleCategory,
    allTags,
    activeTags,
    toggleTag,
    clearTags,
  } = useSpellFilters(sc?.spells ?? NO_SPELLS);

  const hasMultipleCategories =
    ALL_SPELL_CATEGORIES.filter(cat => categoryCounts[cat] > 0).length > 1;

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

  const isSectionCollapsed = (section: string) =>
    (npc.collapsedSpellSections ?? []).includes(section);

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

  const handleCastSpell = useCallback(
    (spellLevel: number, useFreecast: boolean, useRitual = false) => {
      if (!castingSpell) return;
      if (useRitual) {
        // A ritual spends no slot and no innate cast.
      } else if (useFreecast) {
        useNPCStore
          .getState()
          .useNPCFreeCast(campaignCode, npc.id, castingSpell.id);
      } else if (spellLevel > 0) {
        changeSlot(spellLevel, 1);
      }

      // Set concentration on encounter entity if applicable
      if (castingSpell.concentration && encounterId && npcEntityId) {
        useEncounterStore
          .getState()
          .setConcentration(encounterId, npcEntityId, castingSpell.name);
      }

      addToast({
        type: 'success',
        title: `${npc.name} cast ${castingSpell.name}`,
        message: castMessage(spellLevel, useFreecast, useRitual),
        duration: 3000,
      });
    },
    [
      campaignCode,
      npc.id,
      npc.name,
      castingSpell,
      changeSlot,
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

  const totalSpells = sc.spells?.length ?? 0;
  const slotsUsedText = `${totals.used} of ${totals.max} slots used`;

  return (
    <div className="space-y-6">
      <SpellcastingSummary
        casterLevel={sc.casterLevel}
        ability={sc.ability}
        spellAttack={spellAttack}
        spellDC={spellDC}
        onResetSlots={resetSlots}
      />

      {!showInlineSpellSlots && (
        <Section
          level={3}
          heading="Spell slots"
          collapsed={isSectionCollapsed('slotTracker')}
          onCollapsedChange={() => toggleSection('slotTracker')}
          trailing={
            isSectionCollapsed('slotTracker') ? (
              <span className="type-small text-muted tabular-nums">
                {slotsUsedText}
              </span>
            ) : undefined
          }
        >
          <SpellSlotTracker
            spellSlots={spellSlots}
            compact
            hideTitle
            hideResetButtons
            onSpellSlotChange={(level, delta) =>
              changeSlot(level, delta > 0 ? 1 : -1)
            }
          />
        </Section>
      )}

      <Section
        level={3}
        heading="Spells"
        collapsed={isSectionCollapsed('spells')}
        onCollapsedChange={() => toggleSection('spells')}
        trailing={
          isSectionCollapsed('spells') ? (
            <span className="type-small text-muted tabular-nums">
              {totalSpells} {totalSpells === 1 ? 'spell' : 'spells'}
              {showInlineSpellSlots && ` · ${slotsUsedText}`}
            </span>
          ) : undefined
        }
      >
        {/* Filters — categories + tags */}
        {(hasMultipleCategories || allTags.length > 0) && (
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
            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Tag className="text-muted h-3.5 w-3.5 shrink-0" />
                {allTags.map(tag => {
                  const isActive = activeTags.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
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
                {activeTags.size > 0 && (
                  <button
                    type="button"
                    onClick={clearTags}
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
          <div className="space-y-4">
            {sortedLevels.map(level => {
              const spells =
                (isFiltering
                  ? filteredSpellsByLevel[level]
                  : spellsByLevel[level]) ?? [];
              return (
                <SpellLevelSection
                  key={level}
                  level={level}
                  slot={spellSlots[level as keyof SpellSlots]}
                  showPips={showInlineSpellSlots}
                  collapsed={collapsedLevels.has(level)}
                  onCollapsedChange={() => toggleLevel(level)}
                  onSpend={() => changeSlot(level, 1)}
                  onRestore={() => changeSlot(level, -1)}
                >
                  {spells.map(spell => (
                    <NpcSpellRow
                      key={spell.id}
                      spell={spell}
                      usage="play"
                      onCast={() => setCastingSpell(spell)}
                      onView={() => setViewingSpell(spell)}
                      onEdit={() => handleEditSpellOpen(spell)}
                      onRemove={() => handleRemoveSpell(spell.id)}
                    />
                  ))}
                </SpellLevelSection>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Star className="text-faint mb-2 h-8 w-8" />
            <p className="text-muted text-sm">No spells added yet</p>
          </div>
        )}
      </Section>

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
            <div>
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
              existingTags={allTags}
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
                existingTags={allTags}
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
