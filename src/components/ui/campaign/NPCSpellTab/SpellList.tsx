'use client';

import React, { useMemo } from 'react';
import { NpcSpellRow } from '../NpcSpellRow';
import { SpellFilters } from './SpellFilters';
import { SpellLevelSection } from './SpellLevelSection';
import { useRemoveSpell } from './NPCSpellTab.focus';
import type { SpellButtonAction } from './NPCSpellTab.focus';
import type { useSpellFilters } from './NPCSpellTab.hooks';
import type { CampaignNPC } from '@/types/encounter';
import type { Spell, SpellSlots } from '@/types/character';

const NO_SPELLS: Spell[] = [];

interface SpellListProps {
  npc: CampaignNPC;
  campaignCode: string;
  filters: ReturnType<typeof useSpellFilters>;
  spellSlots: SpellSlots;
  showPips: boolean;
  collapsedLevels: ReadonlySet<number>;
  onToggleLevel: (level: number) => void;
  changeSlot: (level: number, delta: 1 | -1) => void;
  readOnly?: boolean;
  onCast: (spell: Spell) => void;
  onView: (spell: Spell) => void;
  onEdit: (spell: Spell) => void;
  registerButton: (
    spellId: string,
    action: SpellButtonAction,
    element: HTMLButtonElement | null
  ) => void;
  /** Where focus lands after the last spell is removed. */
  addSpellButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

/** The filters, then spells grouped under their level headings. */
export function SpellList({
  npc,
  campaignCode,
  filters,
  spellSlots,
  showPips,
  collapsedLevels,
  onToggleLevel,
  changeSlot,
  readOnly,
  onCast,
  onView,
  onEdit,
  registerButton,
  addSpellButtonRef,
}: SpellListProps) {
  const { spellsByLevel, filteredSpellsByLevel, isFiltering } = filters;
  const shownByLevel = isFiltering ? filteredSpellsByLevel : spellsByLevel;
  const spells = npc.spellcasting?.spells ?? NO_SPELLS;
  const spellIds = useMemo(() => spells.map(spell => spell.id), [spells]);
  const { registerTarget, removeSpell } = useRemoveSpell({
    campaignCode,
    npcId: npc.id,
    npcName: npc.name,
    spellIds,
    addSpellButtonRef,
  });

  // Levels with slots show even with no spells, unless a filter is on.
  const sortedLevels = useMemo(() => {
    const levels = new Set(Object.keys(shownByLevel).map(Number));
    if (!isFiltering) {
      for (let l = 1; l <= 9; l++) {
        if ((spellSlots[l as keyof SpellSlots]?.max ?? 0) > 0) levels.add(l);
      }
    }
    return Array.from(levels).sort((a, b) => a - b);
  }, [shownByLevel, spellSlots, isFiltering]);

  const handleRemove = (spell: Spell) => {
    // Neighbours are the rows on screen: collapsed levels are not in the list.
    const visibleIds = sortedLevels
      .filter(level => !collapsedLevels.has(level))
      .flatMap(level => (shownByLevel[level] ?? []).map(s => s.id));
    return removeSpell(spell, visibleIds);
  };

  return (
    <>
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
              showPips={showPips}
              collapsed={collapsedLevels.has(level)}
              onCollapsedChange={() => onToggleLevel(level)}
              onSpend={() => changeSlot(level, 1)}
              onRestore={() => changeSlot(level, -1)}
            >
              {(shownByLevel[level] ?? []).map(spell => (
                <NpcSpellRow
                  key={spell.id}
                  spell={spell}
                  usage="play"
                  onCast={() => onCast(spell)}
                  onView={() => onView(spell)}
                  onEdit={readOnly ? undefined : () => onEdit(spell)}
                  onRemove={readOnly ? undefined : () => handleRemove(spell)}
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
    </>
  );
}
