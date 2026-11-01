'use client';

import React from 'react';
import { FilePen } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import type { DetailSectionProps } from './DetailHeader';
import { LegendarySection } from './LegendarySection';
import { StatBlockTraits } from './StatBlockTraits';
import { DetailResources } from './NpcResourceList';
import { useStatBlockEditDialog } from './StatBlockEditDialog';
import { statBlockEntryHandlers } from './statBlockEntryHandlers';

export function LairActionsSection({ entity, actions }: DetailSectionProps) {
  const lairActions = entity.lairActions;
  if (!lairActions || lairActions.length === 0) return null;

  return (
    <div className="space-y-1">
      <h4 className="type-label-heading text-heading">
        Lair actions (1/round)
      </h4>
      {lairActions.map(la => (
        <div
          key={la.id}
          className="border-divider flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0 pointer-coarse:min-h-11"
        >
          <div className="min-w-0 flex-1">
            <span className="text-body text-sm font-medium">{la.name}</span>
            <p
              className="text-muted line-clamp-2 text-xs"
              dangerouslySetInnerHTML={{ __html: la.description }}
            />
          </div>
          {la.usedThisRound ? (
            <Badge variant="neutral">Used this round</Badge>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => actions.onUseLairAction(entity.id, la.id)}
              aria-label={`Use ${la.name}`}
            >
              Use
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export function DetailActions({ entity, actions }: DetailSectionProps) {
  const {
    open: openEditor,
    dialog,
    canEdit: canEditBlock,
  } = useStatBlockEditDialog(entity, actions);
  const { onUseEntry, onUseAbilityEntry, onRestoreAbilityEntry } =
    statBlockEntryHandlers(entity, actions);
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

  return (
    <div className="border-divider space-y-4 border-t p-4">
      <LegendarySection entity={entity} actions={actions} />
      <DetailResources entity={entity} actions={actions} />
      {entity.monsterStatBlock && (
        <div className="space-y-3">
          {canEditBlock && (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={openEditor}
            >
              <FilePen size={12} aria-hidden="true" />
              Edit stat block
            </Button>
          )}
          <StatBlockTraits
            statBlock={entity.monsterStatBlock}
            spellcasting={entity.spellcasting}
            resources={entity.resources}
            inventory={entity.inventory}
            abilities={entity.abilities}
            onUseEntry={onUseEntry}
            onUseAbilityEntry={onUseAbilityEntry}
            onRestoreAbilityEntry={onRestoreAbilityEntry}
          />
        </div>
      )}
      {dialog}
    </div>
  );
}
