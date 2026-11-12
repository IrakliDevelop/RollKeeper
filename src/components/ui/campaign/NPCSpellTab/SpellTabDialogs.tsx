'use client';

import React, { useEffect, useRef, useState } from 'react';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import { ToastContainer } from '@/components/ui/feedback/Toast';
import { NpcSpellDialog } from '../NpcSpellDialog';
import { useSpellCasting } from './NPCSpellTab.hooks';
import type { SpellButtonAction } from './NPCSpellTab.focus';
import { useNPCStore } from '@/store/npcStore';
import { useEncounterStore } from '@/store/encounterStore';
import type { Spell, SpellSlots } from '@/types/character';

interface SpellEdit {
  spell: Spell;
  open: boolean;
}

export interface SpellOpeners {
  cast: (spell: Spell) => void;
  view: (spell: Spell) => void;
  edit: (spell: Spell) => void;
}

interface SpellTabDialogsProps {
  npcId: string;
  npcName: string;
  campaignCode: string;
  existingTags: string[];
  spellSlots: SpellSlots;
  changeSlot: (level: number, delta: 1 | -1) => void;
  encounterId?: string;
  npcEntityId?: string;
  addSpellRef?: React.MutableRefObject<(() => void) | null>;
  findButton: (
    spellId: string,
    action: SpellButtonAction
  ) => HTMLButtonElement | null;
  /** The spell list, handed the functions that open each dialog. */
  children: (open: SpellOpeners) => React.ReactNode;
}

/** Add, edit, view and cast dialogs, and where focus lands after a save. */
export function SpellTabDialogs({
  npcId,
  npcName,
  campaignCode,
  existingTags,
  spellSlots,
  changeSlot,
  encounterId,
  npcEntityId,
  addSpellRef,
  findButton,
  children,
}: SpellTabDialogsProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<SpellEdit | null>(null);
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null);
  const pendingFocus = useRef<{
    spellId: string;
    action: SpellButtonAction;
  } | null>(null);
  const {
    castingSpell,
    setCastingSpell,
    handleCastSpell,
    toasts,
    dismissToast,
  } = useSpellCasting({
    campaignCode,
    npcId,
    npcName,
    changeSlot,
    encounterId,
    npcEntityId,
  });
  // Concentration lives on the encounter entity when there is one.
  const concentrationSpell = useEncounterStore(state => {
    if (!encounterId || !npcEntityId) return undefined;
    const enc = state.encounters.find(e => e.id === encounterId);
    return enc?.entities.find(e => e.id === npcEntityId)?.concentrationSpell;
  });

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
    // Casts spent while the dialog was open stay spent.
    const current = useNPCStore
      .getState()
      .getNPC(campaignCode, npcId)
      ?.spellcasting?.spells.find(s => s.id === spell.id);
    if (spell.freeCastMax !== undefined) {
      updates.freeCastsUsed = Math.min(
        current?.freeCastsUsed ?? 0,
        spell.freeCastMax
      );
    }
    useNPCStore
      .getState()
      .updateSpellOnNPC(campaignCode, npcId, spell.id, updates);
    pendingFocus.current = { spellId: spell.id, action: 'edit' };
    setEdit(e => (e ? { ...e, open: false } : e));
  };

  const editName = edit?.spell.name ?? '';

  return (
    <>
      {children({
        cast: setCastingSpell,
        view: setViewingSpell,
        edit: spell => setEdit({ spell, open: true }),
      })}

      {viewingSpell && (
        <SpellDetailsModal
          spell={viewingSpell}
          isOpen
          onClose={() => setViewingSpell(null)}
        />
      )}
      {castingSpell && (
        <SpellCastModal
          isOpen
          onClose={() => setCastingSpell(null)}
          spell={castingSpell}
          spellSlots={spellSlots}
          concentration={{
            isConcentrating: !!concentrationSpell,
            spellName: concentrationSpell,
          }}
          onCastSpell={handleCastSpell}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

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
        onOpenChange={open => setEdit(e => (e ? { ...e, open } : e))}
        onCloseAutoFocus={placeFocus}
      />
    </>
  );
}
