import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import { useFocusAfterRemove } from '../NpcLibrary/NpcLibrary.hooks';
import { useNPCStore } from '@/store/npcStore';
import type { Spell } from '@/types/character';

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
