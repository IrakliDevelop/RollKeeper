'use client';

import React from 'react';
import { Coffee, Eye, Moon, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Switch } from '@/components/ui/forms/switch';
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
          onClick={onClose}
          aria-label="Close sheet"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1">
        {!isLair && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.onShortRest(entity.id)}
              aria-label="Short rest"
              title="Short rest"
            >
              <Coffee className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.onLongRest(entity.id)}
              aria-label="Long rest"
              title="Long rest"
            >
              <Moon className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRemove}
          aria-label="Remove from combat"
          title="Remove from combat"
        >
          <Trash2 className="text-accent-red-text h-3.5 w-3.5" />
        </Button>
        {npcSourceId && onViewNPC && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewNPC(npcSourceId, entity.id)}
            aria-label="View NPC details"
            title="View NPC details"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
