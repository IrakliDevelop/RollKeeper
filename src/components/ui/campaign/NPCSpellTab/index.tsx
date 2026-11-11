'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Section } from '@/components/ui/layout/section';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import { ToastContainer } from '@/components/ui/feedback/Toast';
import { SpellSlotTracker } from '@/components/shared/spells';
import { NpcSpellRow } from '../NpcSpellRow';
import { SpellcastingSummary } from './SpellcastingSummary';
import { SpellFilters } from './SpellFilters';
import { SpellLevelSection } from './SpellLevelSection';
import { SpellTabDialogs } from './SpellTabDialogs';
import type { SpellEdit } from './SpellTabDialogs';
import {
  useNpcSpellSlots,
  useRemoveSpell,
  useSpellButtons,
  useSpellCasting,
  useSpellFilters,
  useSpellSlotActions,
} from './NPCSpellTab.hooks';
import { getAbilityScores, getProfBonus } from './NPCSpellTab.utils';
import { useNPCStore } from '@/store/npcStore';
import { useEncounterStore } from '@/store/encounterStore';
import { useDmStore } from '@/store/dmStore';
import {
  calculateNPCSpellAttack,
  calculateNPCSpellDC,
  getNPCSpellcastingAbilityScore,
} from '@/utils/npcSpellcasting';
import type { CampaignNPC } from '@/types/encounter';
import type { Spell, SpellSlots } from '@/types/character';

interface NPCSpellTabProps {
  npc: CampaignNPC;
  campaignCode: string;
  addSpellRef?: React.MutableRefObject<(() => void) | null>;
  encounterId?: string;
  npcEntityId?: string;
  /** Hides spell Edit and Remove; casting, pips and Reset slots stay. */
  readOnly?: boolean;
  /** Where focus lands after the last spell is removed. */
  addSpellButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

const NO_SPELLS: Spell[] = [];

export function NPCSpellTab({
  npc,
  campaignCode,
  addSpellRef,
  encounterId,
  npcEntityId,
  readOnly,
  addSpellButtonRef,
}: NPCSpellTabProps) {
  const sc = npc.spellcasting;
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
  const [edit, setEdit] = useState<SpellEdit | null>(null);

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
  const filters = useSpellFilters(sc?.spells ?? NO_SPELLS);
  const { spellsByLevel, filteredSpellsByLevel, isFiltering } = filters;
  const { registerButton, findButton } = useSpellButtons();
  const spellIds = useMemo(
    () => (sc?.spells ?? NO_SPELLS).map(spell => spell.id),
    [sc?.spells]
  );
  const { registerTarget, removeSpell } = useRemoveSpell({
    campaignCode,
    npcId: npc.id,
    npcName: npc.name,
    spellIds,
    addSpellButtonRef,
  });
  const {
    castingSpell,
    setCastingSpell,
    handleCastSpell,
    toasts,
    dismissToast,
  } = useSpellCasting({
    campaignCode,
    npcId: npc.id,
    npcName: npc.name,
    changeSlot,
    encounterId,
    npcEntityId,
  });

  const shownByLevel = isFiltering ? filteredSpellsByLevel : spellsByLevel;

  // Merge spell levels with slot levels so empty-spell levels with slots still show
  const sortedLevels = useMemo(() => {
    const levels = new Set(Object.keys(shownByLevel).map(Number));
    if (!isFiltering) {
      for (let l = 1; l <= 9; l++) {
        if ((spellSlots[l as keyof SpellSlots]?.max ?? 0) > 0) levels.add(l);
      }
    }
    return Array.from(levels).sort((a, b) => a - b);
  }, [shownByLevel, spellSlots, isFiltering]);

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
      const store = useNPCStore.getState();
      const current =
        store.getNPC(campaignCode, npc.id)?.collapsedSpellSections ?? [];
      const next = current.includes(section)
        ? current.filter(s => s !== section)
        : [...current, section];
      store.updateNPC(campaignCode, npc.id, { collapsedSpellSections: next });
    },
    [campaignCode, npc.id]
  );

  const handleRemoveSpell = (spell: Spell) => {
    // Neighbours are the rows on screen: collapsed levels are not in the list.
    const visibleIds = sortedLevels
      .filter(level => !collapsedLevels.has(level))
      .flatMap(level => (shownByLevel[level] ?? []).map(s => s.id));
    return removeSpell(spell, visibleIds);
  };

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
        <SpellFilters
          categoryCounts={filters.categoryCounts}
          activeCategories={filters.activeCategories}
          onToggleCategory={filters.toggleCategory}
          tags={filters.allTags}
          activeTags={filters.activeTags}
          onToggleTag={filters.toggleTag}
          onClearTags={filters.clearTags}
        />
        {sortedLevels.length > 0 ? (
          <div className="space-y-4">
            {sortedLevels.map(level => (
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
                {(shownByLevel[level] ?? []).map(spell => (
                  <NpcSpellRow
                    key={spell.id}
                    spell={spell}
                    usage="play"
                    onCast={() => setCastingSpell(spell)}
                    onView={() => setViewingSpell(spell)}
                    onEdit={
                      readOnly
                        ? undefined
                        : () => setEdit({ spell, open: true })
                    }
                    onRemove={
                      readOnly ? undefined : () => handleRemoveSpell(spell)
                    }
                    buttonRef={(action, element) => {
                      registerButton(spell.id, action, element);
                      if (action === 'cast') registerTarget(spell.id)(element);
                    }}
                  />
                ))}
              </SpellLevelSection>
            ))}
          </div>
        ) : (
          !isFiltering && (
            <p className="type-body text-muted py-8 text-center">
              No spells yet.
            </p>
          )
        )}
      </Section>

      {viewingSpell && (
        <SpellDetailsModal
          spell={viewingSpell}
          isOpen={!!viewingSpell}
          onClose={() => setViewingSpell(null)}
        />
      )}

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

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <SpellTabDialogs
        npcId={npc.id}
        npcName={npc.name}
        campaignCode={campaignCode}
        existingTags={filters.allTags}
        addSpellRef={addSpellRef}
        edit={edit}
        onEditOpenChange={open => setEdit(e => (e ? { ...e, open } : e))}
        findButton={findButton}
      />
    </div>
  );
}
