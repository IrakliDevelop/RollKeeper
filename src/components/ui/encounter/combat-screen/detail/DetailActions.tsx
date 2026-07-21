'use client';

import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { DetailSectionProps } from './DetailHeader';
import { LegendarySection } from './LegendarySection';
import { TrackableAbilitiesSection } from './TrackableAbilitiesSection';
import { StatBlockTraits } from './StatBlockTraits';
import { StatBlockEntriesEditor } from '../StatBlockEntriesEditor';
import type { MonsterStatBlock } from '@/types/encounter';

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
  const [editingBlock, setEditingBlock] = useState(false);
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
    entity.monsterStatBlock != null ||
    entity.spellcasting != null;

  if (!hasContent) return null;

  const canEditBlock =
    entity.type !== 'player' && entity.monsterStatBlock != null;

  const patchBlock = (patch: Partial<MonsterStatBlock>) => {
    if (!entity.monsterStatBlock) return;
    actions.onUpdate(entity.id, {
      monsterStatBlock: { ...entity.monsterStatBlock, ...patch },
    });
  };

  return (
    <div className="border-divider space-y-4 border-t p-4">
      <LegendarySection entity={entity} actions={actions} />
      <TrackableAbilitiesSection entity={entity} actions={actions} />
      {entity.monsterStatBlock && (
        <div className="space-y-3">
          {canEditBlock && (
            <button
              onClick={() => setEditingBlock(e => !e)}
              className="text-muted hover:text-heading flex items-center gap-1 text-xs font-semibold transition-colors"
            >
              <Pencil size={11} />
              {editingBlock ? 'Done editing' : 'Edit actions & traits'}
            </button>
          )}
          {editingBlock && canEditBlock ? (
            <div className="space-y-4">
              <StatBlockEntriesEditor
                title="Traits"
                entries={entity.monsterStatBlock.traits}
                onChange={traits => patchBlock({ traits })}
              />
              <StatBlockEntriesEditor
                title="Actions"
                entries={entity.monsterStatBlock.actions}
                onChange={actionEntries =>
                  patchBlock({ actions: actionEntries })
                }
              />
              <StatBlockEntriesEditor
                title="Bonus Actions"
                entries={entity.monsterStatBlock.bonusActions}
                onChange={bonusActions => patchBlock({ bonusActions })}
              />
              <StatBlockEntriesEditor
                title="Reactions"
                entries={entity.monsterStatBlock.reactions}
                onChange={reactions => patchBlock({ reactions })}
              />
            </div>
          ) : (
            <StatBlockTraits
              statBlock={entity.monsterStatBlock}
              spellcasting={entity.spellcasting}
            />
          )}
        </div>
      )}
    </div>
  );
}
