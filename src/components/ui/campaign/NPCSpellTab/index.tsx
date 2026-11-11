'use client';

import React from 'react';
import { Section } from '@/components/ui/layout/section';
import { SpellSlotTracker } from '@/components/shared/spells';
import { SpellcastingSummary } from './SpellcastingSummary';
import { SpellList } from './SpellList';
import { SpellTabDialogs } from './SpellTabDialogs';
import {
  useNpcSpellSlots,
  useSpellFilters,
  useSpellSections,
  useSpellSlotActions,
} from './NPCSpellTab.hooks';
import { useSpellButtons } from './NPCSpellTab.focus';
import { getAbilityScores, getProfBonus } from './NPCSpellTab.utils';
import { useDmStore } from '@/store/dmStore';
import {
  calculateNPCSpellAttack,
  calculateNPCSpellDC,
  getNPCSpellcastingAbilityScore,
} from '@/utils/npcSpellcasting';
import type { CampaignNPC } from '@/types/encounter';
import type { Spell } from '@/types/character';

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
  const sections = useSpellSections(npc, campaignCode);
  const { registerButton, findButton } = useSpellButtons();

  if (!sc) return null;

  const totalSpells = sc.spells?.length ?? 0;
  const slotsUsedText = `${totals.used} of ${totals.max} slots used`;
  const { isSectionCollapsed, toggleSection } = sections;

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

      <SpellTabDialogs
        npcId={npc.id}
        npcName={npc.name}
        campaignCode={campaignCode}
        existingTags={filters.allTags}
        spellSlots={spellSlots}
        changeSlot={changeSlot}
        encounterId={encounterId}
        npcEntityId={npcEntityId}
        addSpellRef={addSpellRef}
        findButton={findButton}
      >
        {open => (
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
            <SpellList
              npc={npc}
              campaignCode={campaignCode}
              filters={filters}
              spellSlots={spellSlots}
              showPips={showInlineSpellSlots}
              collapsedLevels={sections.collapsedLevels}
              onToggleLevel={sections.toggleLevel}
              changeSlot={changeSlot}
              readOnly={readOnly}
              onCast={open.cast}
              onView={open.view}
              onEdit={open.edit}
              registerButton={registerButton}
              addSpellButtonRef={addSpellButtonRef}
            />
          </Section>
        )}
      </SpellTabDialogs>
    </div>
  );
}
