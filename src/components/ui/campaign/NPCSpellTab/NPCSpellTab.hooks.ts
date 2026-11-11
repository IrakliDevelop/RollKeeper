import { useCallback, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import { useToast } from '@/components/ui/feedback/Toast';
import { useFocusAfterRemove } from '../NpcLibrary/NpcLibrary.hooks';
import { useNPCStore } from '@/store/npcStore';
import { useEncounterStore } from '@/store/encounterStore';
import {
  getNPCSpellSlots,
  resetNPCSpellcasting,
} from '@/utils/npcSpellcasting';
import {
  ALL_SPELL_CATEGORIES,
  castMessage,
  getSpellCategory,
} from './NPCSpellTab.utils';
import type { SpellCategory } from './NPCSpellTab.utils';
import type { CampaignNPC } from '@/types/encounter';
import type { Spell, SpellSlots } from '@/types/character';

export type SpellButtonAction = 'cast' | 'edit';

/** Row buttons by spell, so focus can be placed on one after a change. */
export function useSpellButtons() {
  const buttons = useRef(
    new Map<string, Partial<Record<SpellButtonAction, HTMLButtonElement>>>()
  );

  const registerButton = useCallback(
    (
      spellId: string,
      action: SpellButtonAction,
      element: HTMLButtonElement | null
    ) => {
      // Rows pass null before each new element; a gone row fails isConnected.
      if (!element) return;
      buttons.current.set(spellId, {
        ...buttons.current.get(spellId),
        [action]: element,
      });
    },
    []
  );

  const findButton = useCallback(
    (spellId: string, action: SpellButtonAction) => {
      const element = buttons.current.get(spellId)?.[action];
      return element?.isConnected ? element : null;
    },
    []
  );

  return { registerButton, findButton };
}

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

  const toggleCategory = useCallback(
    (category: SpellCategory) => {
      setActiveCategories(prev => {
        const next = new Set(prev);
        if (next.has(category)) {
          // Keep one type on among those that have spells; types with no
          // spells have no toggle and don't count.
          const othersOn = ALL_SPELL_CATEGORIES.some(
            other =>
              other !== category && next.has(other) && categoryCounts[other] > 0
          );
          if (!othersOn) return prev;
          next.delete(category);
        } else {
          next.add(category);
        }
        return next;
      });
    },
    [categoryCounts]
  );

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

interface SpellCastingOptions {
  campaignCode: string;
  npcId: string;
  npcName: string;
  changeSlot: (level: number, delta: 1 | -1) => void;
  encounterId?: string;
  npcEntityId?: string;
}

/** The spell being cast, what a cast spends, and the toast it raises. */
export function useSpellCasting({
  campaignCode,
  npcId,
  npcName,
  changeSlot,
  encounterId,
  npcEntityId,
}: SpellCastingOptions) {
  const { toasts, dismissToast, addToast } = useToast();
  const [castingSpell, setCastingSpell] = useState<Spell | null>(null);

  const handleCastSpell = useCallback(
    (spellLevel: number, useFreecast: boolean, useRitual = false) => {
      if (!castingSpell) return;
      // A ritual spends no slot and no innate cast.
      if (!useRitual) {
        if (useFreecast) {
          useNPCStore
            .getState()
            .useNPCFreeCast(campaignCode, npcId, castingSpell.id);
        } else if (spellLevel > 0) {
          changeSlot(spellLevel, 1);
        }
      }

      if (castingSpell.concentration && encounterId && npcEntityId) {
        useEncounterStore
          .getState()
          .setConcentration(encounterId, npcEntityId, castingSpell.name);
      }

      addToast({
        type: 'success',
        title: `${npcName} cast ${castingSpell.name}`,
        message: castMessage(spellLevel, useFreecast, useRitual),
        duration: 3000,
      });
    },
    [
      campaignCode,
      npcId,
      npcName,
      castingSpell,
      changeSlot,
      encounterId,
      npcEntityId,
      addToast,
    ]
  );

  return {
    castingSpell,
    setCastingSpell,
    handleCastSpell,
    toasts,
    dismissToast,
  };
}

interface RemoveSpellOptions {
  campaignCode: string;
  npcId: string;
  npcName: string;
  spellIds: readonly string[];
  /** Where focus lands when no row is left. */
  addSpellButtonRef?: RefObject<HTMLButtonElement | null>;
}

/** Remove a spell after a confirm, then move focus to a neighbouring row. */
export function useRemoveSpell({
  campaignCode,
  npcId,
  npcName,
  spellIds,
  addSpellButtonRef,
}: RemoveSpellOptions) {
  const { fallbackRef, registerTarget, removeThenFocus } =
    useFocusAfterRemove(spellIds);

  const removeSpell = useCallback(
    async (spell: Spell, visibleIds: readonly string[]) => {
      const confirmed = await confirmDialog({
        title: `Remove ${spell.name}?`,
        message: `${npcName} no longer knows this spell.`,
        confirmLabel: 'Remove spell',
        tone: 'danger',
      });
      if (!confirmed) return;
      fallbackRef.current = addSpellButtonRef?.current ?? null;
      removeThenFocus(spell.id, visibleIds, () =>
        useNPCStore.getState().removeSpellFromNPC(campaignCode, npcId, spell.id)
      );
    },
    [
      campaignCode,
      npcId,
      npcName,
      addSpellButtonRef,
      fallbackRef,
      removeThenFocus,
    ]
  );

  return { registerTarget, removeSpell };
}
