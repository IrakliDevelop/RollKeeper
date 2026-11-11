'use client';

import React, { useEffect, useRef, useState } from 'react';
import { NpcSpellDialog } from '../NpcSpellDialog';
import { useNPCStore } from '@/store/npcStore';
import type { Spell } from '@/types/character';
import type { SpellButtonAction } from './NPCSpellTab.hooks';

export interface SpellEdit {
  spell: Spell;
  open: boolean;
}

interface SpellTabDialogsProps {
  npcId: string;
  npcName: string;
  campaignCode: string;
  existingTags: string[];
  addSpellRef?: React.MutableRefObject<(() => void) | null>;
  edit: SpellEdit | null;
  onEditOpenChange: (open: boolean) => void;
  findButton: (
    spellId: string,
    action: SpellButtonAction
  ) => HTMLButtonElement | null;
}

/** The add and edit spell dialogs, and where focus lands when each closes. */
export function SpellTabDialogs({
  npcId,
  npcName,
  campaignCode,
  existingTags,
  addSpellRef,
  edit,
  onEditOpenChange,
  findButton,
}: SpellTabDialogsProps) {
  const [addOpen, setAddOpen] = useState(false);
  const pendingFocus = useRef<{
    spellId: string;
    action: SpellButtonAction;
  } | null>(null);

  useEffect(() => {
    if (addSpellRef) addSpellRef.current = () => setAddOpen(true);
    return () => {
      if (addSpellRef) addSpellRef.current = null;
    };
  }, [addSpellRef]);

  // Radix would return focus to whatever opened the dialog. After a save,
  // the row it just added or changed is the better place.
  const placeFocus = (event: Event) => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    const element = target && findButton(target.spellId, target.action);
    if (!element) return;
    event.preventDefault();
    element.focus();
  };

  const handleAdd = (spell: Spell) => {
    useNPCStore.getState().addSpellToNPC(campaignCode, npcId, spell);
    pendingFocus.current = { spellId: spell.id, action: 'cast' };
    setAddOpen(false);
  };

  const handleEdit = (spell: Spell) => {
    // createdAt stays as stored; the dialog hands back the whole spell.
    const updates: Partial<Spell> = { ...spell };
    delete updates.createdAt;
    useNPCStore
      .getState()
      .updateSpellOnNPC(campaignCode, npcId, spell.id, updates);
    pendingFocus.current = { spellId: spell.id, action: 'edit' };
    onEditOpenChange(false);
  };

  const editName = edit?.spell.name ?? '';

  return (
    <>
      <NpcSpellDialog
        open={addOpen}
        mode="add"
        title={`Add a spell to ${npcName}`}
        existingTags={existingTags}
        onSubmit={handleAdd}
        onOpenChange={setAddOpen}
        onCloseAutoFocus={placeFocus}
      />
      <NpcSpellDialog
        open={edit?.open ?? false}
        mode="edit"
        title={editName.trim() ? `Edit ${editName}` : 'Edit spell'}
        spell={edit?.spell}
        existingTags={existingTags}
        onSubmit={handleEdit}
        onOpenChange={onEditOpenChange}
        onCloseAutoFocus={placeFocus}
      />
    </>
  );
}
