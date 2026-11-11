'use client';

import React, { useEffect, useId, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import { Button } from '@/components/ui/forms/button';
import { SubTabs, type SubTabDefinition } from '@/components/ui/layout/SubTabs';
import {
  ItemForm,
  initialInventoryFormData,
} from '@/components/ui/game/inventory/ItemForm';
import type { InventoryFormData } from '@/components/ui/game/inventory/ItemForm';
import { LIBRARY_COPY } from '../NpcLibrary/NpcLibrary.utils';
import { DetailsTab } from './DetailsTab';
import { StatBlockTab } from './StatBlockTab';
import { SpellsTab } from './SpellsTab';
import { InventoryTab } from './InventoryTab';
import { LoreTab } from './LoreTab';
import { useItemsData } from '@/hooks/useItemsData';
import { useMagicItemsData } from '@/hooks/useMagicItemsData';
import { useNpcFormState } from './useNpcFormState';
import { usePortraitUpload } from './usePortraitUpload';
import { npcInventoryItemToFormData } from '@/utils/npcInventoryItemForm';
import type { CampaignCreatureKind, CampaignNPC } from '@/types/encounter';
import type { NpcFormPayload, SubmitBlocker } from './npcFormPayload';

interface NPCFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: NpcFormPayload) => void;
  editingNpc?: CampaignNPC | null;
  existingGroups?: string[];
  kind?: CampaignCreatureKind;
}

type FormTab = 'details' | 'stats' | 'spells' | 'inventory' | 'lore';

const BLOCKER_TEXT: Record<SubmitBlocker, string> = {
  name: 'Add a name to save.',
  resources: 'Fix the class resources on the Stat block tab to save.',
  costs: 'Fix the resource costs on the Stat block tab to save.',
};

function discardTitle(
  editingNpc: CampaignNPC | null | undefined,
  kind: CampaignCreatureKind
): string {
  if (editingNpc) {
    const name = editingNpc.name.trim();
    return name ? `Discard changes to ${name}?` : 'Discard changes?';
  }
  return kind === 'monster'
    ? 'Discard this custom monster?'
    : 'Discard this NPC?';
}

export function NPCFormDialog({
  open,
  onOpenChange,
  onSave,
  editingNpc,
  existingGroups = [],
  kind = 'npc',
}: NPCFormDialogProps) {
  const copy = LIBRARY_COPY[kind];
  const form = useNpcFormState({ open, editingNpc, onSave, onOpenChange });
  const { draft, derived, update } = form;
  const portrait = usePortraitUpload({
    npcId: editingNpc?.id,
    onChange: url => update({ avatarUrl: url }),
  });
  const tabsId = useId();
  const reasonId = useId();

  // Item database for the ItemForm editor
  const { items: dbItems, loading: dbItemsLoading } = useItemsData();
  const { items: dbMagicItems } = useMagicItemsData();

  const [activeTab, setActiveTab] = useState<FormTab>('details');
  const [inventoryEditFormOpen, setInventoryEditFormOpen] = useState(false);
  const [editingInventoryItemId, setEditingInventoryItemId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!open) return;
    setActiveTab('details');
  }, [editingNpc, open]);

  // The tab list scrolls sideways; a tab reached by keyboard must be in view.
  const revealFocusedTab = (event: React.FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.matches('[role="tab"]')) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  const handleSave = () => {
    if (!form.canSubmit) return;
    portrait.commit(draft.avatarUrl);
    form.submit();
  };

  const handleOpenChange = async (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (form.isDirty) {
      const discard = await confirmDialog({
        title: discardTitle(editingNpc, kind),
        message: "What you changed here won't be saved.",
        confirmLabel: 'Discard changes',
        cancelLabel: 'Keep editing',
        tone: 'danger',
      });
      if (!discard) return;
    }
    portrait.discardAll();
    onOpenChange(false);
  };

  const handleEditItem = (itemId: string) => {
    setEditingInventoryItemId(itemId);
    setInventoryEditFormOpen(true);
  };

  const editingInventoryItem = editingInventoryItemId
    ? draft.inventoryItems.find(i => i.id === editingInventoryItemId)
    : undefined;

  const handleInventoryEditSubmit = (data: InventoryFormData) => {
    if (!editingInventoryItemId) return;
    form.applyInventoryEdit(editingInventoryItemId, data);
    setInventoryEditFormOpen(false);
    setEditingInventoryItemId(null);
  };

  const savedName = editingNpc?.name.trim();
  const title = editingNpc
    ? savedName
      ? `Edit ${savedName}`
      : copy.editLabel
    : copy.createLabel;

  const tabs: SubTabDefinition[] = [
    {
      value: 'details',
      id: `${tabsId}-details`,
      label: 'Details',
      content: (
        <DetailsTab
          kind={kind}
          isEdit={!!editingNpc}
          draft={draft}
          update={update}
          derived={derived}
          existingGroups={existingGroups}
          portrait={portrait}
          onImport={form.importMonster}
          onClearImport={form.clearImport}
          onAddTag={form.addTag}
          onRemoveTag={form.removeTag}
          onRemoveLastTag={form.removeLastTag}
        />
      ),
    },
    {
      value: 'stats',
      id: `${tabsId}-stats`,
      label: 'Stat block',
      content: (
        <div className="space-y-5">
          <StatBlockTab
            draft={draft}
            update={update}
            derived={derived}
            onDeleteResource={form.deleteResource}
          />
        </div>
      ),
    },
    {
      value: 'spells',
      id: `${tabsId}-spells`,
      label: 'Spells',
      content: (
        <div className="space-y-5">
          <SpellsTab
            draft={draft}
            update={update}
            proficiencyBonus={derived.proficiencyBonus}
          />
        </div>
      ),
    },
    {
      value: 'inventory',
      id: `${tabsId}-inventory`,
      label: 'Inventory',
      content: (
        <InventoryTab
          draft={draft}
          update={update}
          onEditItem={handleEditItem}
        />
      ),
    },
    {
      value: 'lore',
      id: `${tabsId}-lore`,
      label: 'Lore',
      content: (
        <LoreTab
          loreHtml={draft.loreHtml}
          onChange={loreHtml => update({ loreHtml })}
        />
      ),
    },
  ];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={next => {
          void handleOpenChange(next);
        }}
      >
        <DialogContent
          size="lg"
          className="h-[85vh]"
          aria-describedby={undefined}
        >
          <DialogHeader className="pr-10">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div
            className="flex min-h-0 flex-1 flex-col"
            onFocusCapture={revealFocusedTab}
          >
            <SubTabs
              label={copy.formLabel}
              value={activeTab}
              onValueChange={value => setActiveTab(value as FormTab)}
              // The list scrolls sideways, so it can shrink; keep it whole.
              className="flex min-h-0 flex-1 flex-col [&>[role=tablist]]:shrink-0"
              contentClassName="min-h-0 flex-1 overflow-y-auto"
              tabs={tabs}
            />
          </div>

          <DialogFooter className="flex-row flex-wrap items-center justify-between gap-2">
            {form.submitBlocker ? (
              <p id={reasonId} className="type-small text-muted">
                {BLOCKER_TEXT[form.submitBlocker]}
              </p>
            ) : null}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!form.canSubmit}
                aria-describedby={form.submitBlocker ? reasonId : undefined}
              >
                {editingNpc ? 'Save changes' : copy.createLabel}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ItemForm
        isOpen={inventoryEditFormOpen}
        onClose={() => {
          setInventoryEditFormOpen(false);
          setEditingInventoryItemId(null);
        }}
        onSubmit={handleInventoryEditSubmit}
        initialData={
          editingInventoryItem
            ? npcInventoryItemToFormData(editingInventoryItem)
            : initialInventoryFormData
        }
        availableLocations={[]}
        isEditing
        databaseItems={dbItems}
        databaseMagicItems={dbMagicItems}
        itemsLoading={dbItemsLoading}
      />
    </>
  );
}
