'use client';

import React from 'react';
import { Coffee, Eye, Moon, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Switch } from '@/components/ui/forms/switch';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';

export interface CreatureHeaderActionsProps {
  entity: EncounterEntity;
  actions: EntityActions;
  editing: boolean;
  onToggleEditing: () => void;
  onClose: () => void;
}

/** Right-hand button rail of `CreatureHeader`: Edit sheet switch, close, rests, remove, and view-NPC. */
export function CreatureHeaderActions({
  entity,
  actions,
  editing,
  onToggleEditing,
  onClose,
}: CreatureHeaderActionsProps) {
  const isLair = entity.type === 'lair';
  const npcSourceId = entity.npcSourceId;
  const onViewNPC = actions.onViewNPC;
  const removeLabel = `Remove ${entity.name} from combat`;
  const viewLabel = `View ${entity.name} in NPC library`;

  const handleRemove = async () => {
    const confirmed = await confirmDialog({
      title: `Remove ${entity.name} from combat?`,
      confirmLabel: 'Remove from combat',
      tone: 'danger',
    });
    if (confirmed) actions.onRemove(entity.id);
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {!isLair && (
          <Switch
            label="Edit sheet"
            size="sm"
            checked={editing}
            onCheckedChange={onToggleEditing}
            wrapperClassName="shrink-0 items-center whitespace-nowrap"
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-9 shrink-0 px-0"
          onClick={onClose}
          aria-label="Close sheet"
        >
          <X size={16} aria-hidden />
        </Button>
      </div>

      <div className="flex items-center gap-1">
        {!isLair && (
          <>
            <Tooltip content="Short rest">
              <Button
                variant="ghost"
                size="sm"
                className="w-9 shrink-0 px-0"
                onClick={() => actions.onShortRest(entity.id)}
                aria-label="Short rest"
              >
                <Coffee size={16} aria-hidden />
              </Button>
            </Tooltip>
            <Tooltip content="Long rest">
              <Button
                variant="ghost"
                size="sm"
                className="w-9 shrink-0 px-0"
                onClick={() => actions.onLongRest(entity.id)}
                aria-label="Long rest"
              >
                <Moon size={16} aria-hidden />
              </Button>
            </Tooltip>
          </>
        )}
        <Tooltip content={removeLabel}>
          <Button
            variant="danger"
            size="sm"
            className="w-9 shrink-0 px-0"
            onClick={handleRemove}
            aria-label={removeLabel}
          >
            <Trash2 size={16} aria-hidden />
          </Button>
        </Tooltip>
        {npcSourceId && onViewNPC && (
          <Tooltip content={viewLabel}>
            <Button
              variant="ghost"
              size="sm"
              className="w-9 shrink-0 px-0"
              onClick={() => onViewNPC(npcSourceId, entity.id)}
              aria-label={viewLabel}
            >
              <Eye size={16} aria-hidden />
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
