'use client';

import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/forms/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { StatBlockEditor } from '../AddCombatantDialog/StatBlockEditor';
import type { MonsterEditDraft } from '../AddCombatantDialog/monsterEditDraft';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '../types';

export interface UseStatBlockEditDialogResult {
  /** Opens the editor, seeded from the entity's current stat block. */
  open: () => void;
  /** The editor `Dialog`; always mounted, visible once `open()` is called. */
  dialog: ReactNode;
  /** Whether this entity has an editable stat block at all. */
  canEdit: boolean;
}

/**
 * Owns the "Edit stat block" dialog's draft state and save/cancel wiring.
 * Extracted from `DetailActions` so the creature drawer can reuse the same
 * editor without duplicating the draft/save logic.
 */
export function useStatBlockEditDialog(
  entity: EncounterEntity,
  actions: EntityActions
): UseStatBlockEditDialogResult {
  const [editDraft, setEditDraft] = useState<MonsterEditDraft | null>(null);
  const canEdit = entity.type !== 'player' && entity.monsterStatBlock != null;

  const openEditor = () => {
    if (!entity.monsterStatBlock) return;
    setEditDraft({
      statBlock: structuredClone(entity.monsterStatBlock),
      initiativeModifier: entity.initiativeModifier,
      initiativeDirty: true,
      proficiencyBonus: entity.proficiencyBonus ?? 2,
      proficiencyDirty: true,
    });
  };

  const dialog = (
    <Dialog
      open={editDraft !== null}
      onOpenChange={open => !open && setEditDraft(null)}
    >
      <DialogContent className="h-[85vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit {entity.name}</DialogTitle>
        </DialogHeader>
        <DialogBody className="min-h-0 overflow-y-auto">
          {editDraft && (
            <StatBlockEditor
              monsterName={entity.name}
              draft={editDraft}
              onDraftChange={setEditDraft}
              onReset={openEditor}
              onBack={() => setEditDraft(null)}
              resetLabel="Reset changes"
            />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setEditDraft(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!editDraft) return;
              actions.onUpdate(entity.id, {
                monsterStatBlock: editDraft.statBlock,
                initiativeModifier: editDraft.initiativeModifier,
                proficiencyBonus: editDraft.proficiencyBonus,
              });
              setEditDraft(null);
            }}
          >
            Save stat block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { open: openEditor, dialog, canEdit };
}
