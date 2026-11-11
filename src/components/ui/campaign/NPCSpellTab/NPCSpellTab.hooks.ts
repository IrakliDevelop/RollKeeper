import { useCallback, useMemo, useState } from 'react';
import { useNPCStore } from '@/store/npcStore';
import {
  getNPCSpellSlots,
  resetNPCSpellcasting,
} from '@/utils/npcSpellcasting';
import { ALL_SPELL_CATEGORIES, getSpellCategory } from './NPCSpellTab.utils';
import type { SpellCategory } from './NPCSpellTab.utils';
import type { CampaignNPC } from '@/types/encounter';
import type { Spell, SpellSlots } from '@/types/character';

const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** The NPC's nine slot levels (max from caster level and overrides) and their totals. */
export function useNpcSpellSlots(npc: CampaignNPC) {
  const sc = npc.spellcasting;
  const casterLevel = sc?.casterLevel;
  const slotOverrides = sc?.slotOverrides;
  const slotsUsed = sc?.slotsUsed;

  return useMemo(() => {
    const raw =
      casterLevel === undefined
        ? {}
        : getNPCSpellSlots(casterLevel, slotOverrides);
    const spellSlots = {} as SpellSlots;
    let max = 0;
    let used = 0;
    for (const level of SLOT_LEVELS) {
      const slot = { max: raw[level] ?? 0, used: slotsUsed?.[level] ?? 0 };
      spellSlots[level] = slot;
      max += slot.max;
      used += slot.used;
    }
    return { spellSlots, totals: { used, max } };
  }, [casterLevel, slotOverrides, slotsUsed]);
}

/** Slot writes that read the store at click time, never a render snapshot. */
export function useSpellSlotActions(campaignCode: string, npcId: string) {
  const changeSlot = useCallback(
    (level: number, delta: 1 | -1) => {
      useNPCStore
        .getState()
        .spendNPCSpellSlot(campaignCode, npcId, level, delta);
    },
    [campaignCode, npcId]
  );

  const resetSlots = useCallback(() => {
    const store = useNPCStore.getState();
    const npc = store.getNPC(campaignCode, npcId);
    if (!npc?.spellcasting) return;
    store.updateNPC(campaignCode, npcId, {
      spellcasting: resetNPCSpellcasting(npc.spellcasting),
    });
  }, [campaignCode, npcId]);

  return { changeSlot, resetSlots };
}

/** Category and tag filters over the NPC's spells, plus the level grouping. */
export function useSpellFilters(spells: Spell[]) {
  const [activeCategories, setActiveCategories] = useState<Set<SpellCategory>>(
    () => new Set(ALL_SPELL_CATEGORIES)
  );
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set());

  const spellsByLevel = useMemo(() => {
    const groups: Record<number, Spell[]> = {};
    for (const spell of spells) {
      if (!groups[spell.level]) groups[spell.level] = [];
      groups[spell.level].push(spell);
    }
    return groups;
  }, [spells]);

  const isCategoryFiltering =
    activeCategories.size > 0 &&
    activeCategories.size < ALL_SPELL_CATEGORIES.length;
  const isTagFiltering = activeTags.size > 0;
  const isFiltering = isCategoryFiltering || isTagFiltering;

  const filteredSpellsByLevel = useMemo(() => {
    if (!isFiltering) return spellsByLevel;
    const filtered: Record<number, Spell[]> = {};
    for (const [level, levelSpells] of Object.entries(spellsByLevel)) {
      const matching = levelSpells.filter(spell => {
        if (
          isCategoryFiltering &&
          !activeCategories.has(getSpellCategory(spell))
        )
          return false;
        if (
          isTagFiltering &&
          (!spell.tags || !spell.tags.some(tag => activeTags.has(tag)))
        )
          return false;
        return true;
      });
      if (matching.length > 0) filtered[Number(level)] = matching;
    }
    return filtered;
  }, [
    spellsByLevel,
    activeCategories,
    activeTags,
    isFiltering,
    isCategoryFiltering,
    isTagFiltering,
  ]);

  const categoryCounts = useMemo(() => {
    const counts: Record<SpellCategory, number> = {
      regular: 0,
      at_will: 0,
      innate: 0,
    };
    for (const spell of spells) counts[getSpellCategory(spell)]++;
    return counts;
  }, [spells]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const spell of spells) {
      for (const tag of spell.tags ?? []) tagSet.add(tag);
    }
    return Array.from(tagSet).sort();
  }, [spells]);

  const toggleCategory = useCallback((category: SpellCategory) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        if (next.size === 1) return prev;
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setActiveTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  const clearTags = useCallback(() => setActiveTags(new Set()), []);

  return {
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
  };
}
