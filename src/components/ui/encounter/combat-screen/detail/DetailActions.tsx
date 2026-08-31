'use client';

import React, { useState } from 'react';
import { FilePen } from 'lucide-react';
import type { DetailSectionProps } from './DetailHeader';
import { LegendarySection } from './LegendarySection';
import { StatBlockTraits } from './StatBlockTraits';
import { DetailResources } from './NpcResourceList';
import type { StatBlockEntry } from '@/types/encounter';
import { StatBlockEditor } from '../AddCombatantDialog/StatBlockEditor';
import type { MonsterEditDraft } from '../AddCombatantDialog/monsterEditDraft';
import { Button } from '@/components/ui/forms/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';

function LairActionsSection({ entity, actions }: DetailSectionProps) {
  const lairActions = entity.lairActions;
  if (!lairActions || lairActions.length === 0) return null;

  return (
    <div className="space-y-1">
      <h4 className="text-heading text-xs font-semibold tracking-wider uppercase">
        Lair Actions (1/round)
      </h4>
      {lairActions.map(la => (
        <div
          key={la.id}
          className="bg-surface-raised flex items-center justify-between rounded px-2 py-1.5 shadow-sm"
        >
          <div className="min-w-0 flex-1">
            <span className="text-body text-sm font-medium">{la.name}</span>
            <p
              className="text-muted line-clamp-2 text-xs"
              dangerouslySetInnerHTML={{ __html: la.description }}
            />
          </div>
          <button
            onClick={() => actions.onUseLairAction(entity.id, la.id)}
            disabled={la.usedThisRound}
            className={`ml-2 shrink-0 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              la.usedThisRound
                ? 'bg-surface-raised text-faint cursor-not-allowed'
                : 'bg-accent-emerald-bg text-accent-emerald-text hover:opacity-80'
            }`}
          >
            {la.usedThisRound ? 'Used' : 'Use'}
          </button>
        </div>
      ))}
    </div>
  );
}

export function DetailActions({ entity, actions }: DetailSectionProps) {
  const [editDraft, setEditDraft] = useState<MonsterEditDraft | null>(null);
  const isLair = entity.type === 'lair';

  if (isLair) {
    return (
      <div className="border-divider space-y-3 border-t p-4">
        <LairActionsSection entity={entity} actions={actions} />
      </div>
    );
  }

  const hasContent =
    entity.legendaryActions != null ||
    (entity.abilities?.length ?? 0) > 0 ||
    (entity.resources?.length ?? 0) > 0 ||
    entity.monsterStatBlock != null ||
    entity.spellcasting != null;

  if (!hasContent) return null;

  const canEditBlock =
    entity.type !== 'player' && entity.monsterStatBlock != null;

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

  return (
    <div className="border-divider space-y-4 border-t p-4">
      <LegendarySection entity={entity} actions={actions} />
      <DetailResources entity={entity} actions={actions} />
      {entity.monsterStatBlock && (
        <div className="space-y-3">
          {canEditBlock && (
            <button
              onClick={openEditor}
              className="text-muted hover:text-heading flex items-center gap-1 text-xs font-semibold transition-colors"
            >
              <FilePen size={12} />
              Edit stat block
            </button>
          )}
          <StatBlockTraits
            statBlock={entity.monsterStatBlock}
            spellcasting={entity.spellcasting}
            resources={entity.resources}
            inventory={entity.inventory}
            abilities={entity.abilities}
            onUseEntry={(entry: StatBlockEntry) => {
              if (entry.inventoryCost && entry.id) {
                actions.onUseInventoryEntry?.(entity.id, entry.id);
              } else if (entry.resourceCost) {
                actions.onSpendResource(
                  entity.id,
                  entry.resourceCost.resourceId,
                  entry.resourceCost.amount
                );
              }
            }}
            onUseAbilityEntry={(entry: StatBlockEntry) => {
              if (entry.id) actions.onUseAbility(entity.id, entry.id);
            }}
            onRestoreAbilityEntry={(entry: StatBlockEntry) => {
              if (entry.id) actions.onRestoreAbility(entity.id, entry.id);
            }}
          />
        </div>
      )}
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
    </div>
  );
}
