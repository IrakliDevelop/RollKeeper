'use client';

import React from 'react';
import { Shield, Eye, Minus, Plus, Angry } from 'lucide-react';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from './types';

interface RowControlsProps {
  entity: EncounterEntity;
  isRail: boolean;
  counterLabel?: string;
  counterValue: number;
  actions: EntityActions;
}

export function RowControls({
  entity,
  isRail,
  counterLabel,
  counterValue,
  actions,
}: RowControlsProps) {
  const pcId = entity.playerCharacterId;
  const hasCounter =
    !!counterLabel &&
    entity.type === 'player' &&
    pcId !== undefined &&
    !!actions.onAdjustCounter;
  return (
    <div
      className={
        hasCounter
          ? 'flex shrink-0 flex-col items-end gap-1'
          : 'flex shrink-0 items-center gap-1.5'
      }
    >
      <div className="flex items-center gap-1.5">
        {entity.type !== 'lair' && (
          <div
            data-testid="ac-section"
            className="bg-surface-raised flex items-center gap-1 rounded-md px-1.5 py-0.5 shadow-sm"
          >
            <Shield size={13} className="text-muted" />
            <span className="font-display text-heading text-sm font-bold tabular-nums">
              {entity.armorClass}
            </span>
            {isRail && (
              <span className="text-faint text-[8px] font-semibold tracking-widest">
                AC
              </span>
            )}
          </div>
        )}

        {entity.type === 'player' &&
          pcId !== undefined &&
          actions.onViewPlayer && (
            <button
              onClick={e => {
                e.stopPropagation();
                actions.onViewPlayer?.(pcId);
              }}
              className="text-muted hover:text-accent-blue-text rounded p-1 transition-colors"
              title="View character sheet"
            >
              <Eye size={14} />
            </button>
          )}

        {entity.npcSourceId && actions.onViewNPC && (
          <button
            onClick={e => {
              e.stopPropagation();
              actions.onViewNPC?.(entity.npcSourceId ?? '', entity.id);
            }}
            className="text-muted hover:text-accent-amber-text rounded p-1 transition-colors"
            title="View NPC details"
          >
            <Eye size={14} />
          </button>
        )}
      </div>

      {hasCounter && pcId !== undefined && (
        <div
          className="bg-accent-purple-bg flex items-center gap-1 rounded-full px-1.5 py-0.5"
          title={counterLabel}
          onClick={e => e.stopPropagation()}
        >
          <Angry size={10} className="text-accent-purple-text" />
          <button
            onClick={e => {
              e.stopPropagation();
              actions.onAdjustCounter?.(pcId, -1);
            }}
            className="text-accent-purple-text hover:bg-surface-secondary rounded p-0.5 transition-colors"
            disabled={counterValue <= 0}
          >
            <Minus size={10} />
          </button>
          <span className="text-accent-purple-text min-w-[1rem] text-center text-[11px] font-bold tabular-nums">
            {counterValue}
          </span>
          <button
            onClick={e => {
              e.stopPropagation();
              actions.onAdjustCounter?.(pcId, 1);
            }}
            className="text-accent-purple-text hover:bg-surface-secondary rounded p-0.5 transition-colors"
          >
            <Plus size={10} />
          </button>
        </div>
      )}
    </div>
  );
}
