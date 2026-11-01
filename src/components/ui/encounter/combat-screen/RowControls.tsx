'use client';

import { Shield, Eye, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { effectiveAc } from '@/utils/calculations';
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
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {entity.type !== 'lair' && (
          <div
            data-testid="ac-section"
            className="text-body flex items-center gap-1 text-sm"
          >
            <Shield size={14} className="text-muted" aria-hidden="true" />
            <span className="tabular-nums">
              {effectiveAc(entity.armorClass, entity.tempAc)}
            </span>
            <span className="text-muted">AC</span>
          </div>
        )}
        {entity.type === 'player' &&
          pcId !== undefined &&
          actions.onViewPlayer && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => actions.onViewPlayer?.(pcId)}
              aria-label={`View ${entity.name} sheet`}
            >
              <Eye size={16} aria-hidden="true" />
            </Button>
          )}
        {entity.npcSourceId && actions.onViewNPC && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              actions.onViewNPC?.(entity.npcSourceId ?? '', entity.id)
            }
            aria-label={`View ${entity.name} in NPC library`}
          >
            <Eye size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
      {hasCounter && pcId !== undefined && (
        <div
          role="group"
          aria-label={`${counterLabel} for ${entity.name}`}
          className="flex items-center gap-1"
        >
          <Button
            variant="ghost"
            size="xs"
            onClick={() => actions.onAdjustCounter?.(pcId, -1)}
            disabled={counterValue <= 0}
            aria-label={`Decrease ${counterLabel} for ${entity.name}`}
          >
            <Minus size={14} aria-hidden="true" />
          </Button>
          <span className="text-body min-w-10 text-center text-xs tabular-nums">
            {counterValue} {counterLabel}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => actions.onAdjustCounter?.(pcId, 1)}
            aria-label={`Increase ${counterLabel} for ${entity.name}`}
          >
            <Plus size={14} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
