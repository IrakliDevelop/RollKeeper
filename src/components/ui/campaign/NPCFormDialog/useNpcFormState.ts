import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProcessedMonster } from '@/types/bestiary';
import type { CampaignNPC } from '@/types/encounter';
import type { InventoryFormData } from '@/components/ui/game/inventory/ItemForm';
import { formDataToNpcInventoryPatch } from '@/utils/npcInventoryItemForm';
import {
  deriveAutoFields,
  draftFromMonster,
  draftFromNpc,
  draftsEqual,
  emptyDraft,
} from './npcFormDraft';
import type {
  NpcDerivedFields,
  NpcFormDraft,
  NpcFormUpdate,
} from './npcFormDraft';
import { buildNpcPayload, canSubmitDraft } from './npcFormPayload';
import type { NpcFormPayload } from './npcFormPayload';

interface UseNpcFormStateArgs {
  open: boolean;
  editingNpc?: CampaignNPC | null;
  onSave: (payload: NpcFormPayload) => void;
  onOpenChange: (open: boolean) => void;
}

export interface NpcFormState {
  draft: NpcFormDraft;
  update: NpcFormUpdate;
  derived: NpcDerivedFields;
  isDirty: boolean;
  canSubmit: boolean;
  submit: () => void;
  importMonster: (monster: ProcessedMonster) => void;
  clearImport: () => void;
  addTag: (raw: string) => void;
  removeTag: (tag: string) => void;
  removeLastTag: () => void;
  deleteResource: (resourceId: string) => void;
  applyInventoryEdit: (itemId: string, data: InventoryFormData) => void;
}

/** Owns the NPC form's draft, its saved baseline and every draft-only action. */
export function useNpcFormState({
  open,
  editingNpc,
  onSave,
  onOpenChange,
}: UseNpcFormStateArgs): NpcFormState {
  const [draft, setDraft] = useState<NpcFormDraft>(emptyDraft);
  const [baseline, setBaseline] = useState<NpcFormDraft>(emptyDraft);

  useEffect(() => {
    if (!open) return;
    const next = editingNpc ? draftFromNpc(editingNpc) : emptyDraft();
    setDraft(next);
    setBaseline(next);
  }, [editingNpc, open]);

  const update = useCallback<NpcFormUpdate>(patch => {
    setDraft(d => ({
      ...d,
      ...(typeof patch === 'function' ? patch(d) : patch),
    }));
  }, []);

  const derived = useMemo(() => deriveAutoFields(draft), [draft]);
  const isDirty = useMemo(
    () => !draftsEqual(draft, baseline),
    [draft, baseline]
  );
  const canSubmit = canSubmitDraft(draft);

  const submit = () => {
    if (!draft.name.trim()) return;
    onSave(buildNpcPayload(draft, editingNpc));
    onOpenChange(false);
  };

  const importMonster = useCallback((monster: ProcessedMonster) => {
    setDraft(d => draftFromMonster(monster, d));
  }, []);

  const clearImport = useCallback(() => {
    update({ bestiarySourceId: null, bestiarySourceName: '' });
  }, [update]);

  const addTag = useCallback((raw: string) => {
    const trimmed = raw.trim().replace(/,$/, '');
    if (!trimmed) return;
    setDraft(d =>
      d.tags.includes(trimmed) ? d : { ...d, tags: [...d.tags, trimmed] }
    );
  }, []);

  const removeTag = useCallback((tag: string) => {
    setDraft(d => ({ ...d, tags: d.tags.filter(t => t !== tag) }));
  }, []);

  const removeLastTag = useCallback(() => {
    setDraft(d => ({ ...d, tags: d.tags.slice(0, -1) }));
  }, []);

  const deleteResource = useCallback((resourceId: string) => {
    const strip = (entries: NpcFormDraft['traits']) =>
      entries.map(e =>
        e.resourceCost?.resourceId === resourceId
          ? { ...e, resourceCost: undefined }
          : e
      );
    setDraft(d => ({
      ...d,
      resources: d.resources.filter(r => r.id !== resourceId),
      traits: strip(d.traits),
      actions: strip(d.actions),
      bonusActions: strip(d.bonusActions),
      reactions: strip(d.reactions),
      lairActions: strip(d.lairActions),
    }));
  }, []);

  const applyInventoryEdit = useCallback(
    (itemId: string, data: InventoryFormData) => {
      setDraft(d => ({
        ...d,
        inventoryItems: d.inventoryItems.map(item =>
          item.id === itemId ? formDataToNpcInventoryPatch(data, item) : item
        ),
      }));
    },
    []
  );

  return {
    draft,
    update,
    derived,
    isDirty,
    canSubmit,
    submit,
    importMonster,
    clearImport,
    addTag,
    removeTag,
    removeLastTag,
    deleteResource,
    applyInventoryEdit,
  };
}
