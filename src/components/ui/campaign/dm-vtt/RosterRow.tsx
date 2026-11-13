'use client';

import { Eye } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Tooltip } from '@/components/ui/primitives/Tooltip';

import { dispositionColor } from './combatantToken';

import { tokenAvatarUrl } from '@/components/ui/campaign/location-map/PlayerTokenTool';
import { cn } from '@/utils/cn';

import type { PointerEvent } from 'react';
import type { EncounterEntity } from '@/types/encounter';

export interface RosterRowProps {
  entity: EncounterEntity;
  placed: boolean;
  armed: boolean;
  onArmPlacement: (entity: EncounterEntity) => void;
  onSelectEntity: (entityId: string) => void;
  onDragStart: (entity: EncounterEntity, e: PointerEvent) => void;
  onViewPlayer?: (playerCharacterId: string) => void;
}

/**
 * Single roster row: avatar disc, first-word name, placed/unplaced state
 * line. Unplaced rows arm placement on click and forward pointerdown to
 * `onDragStart` (Task 4's drag logic decides tap-vs-drag by movement
 * threshold — this row just forwards both). Placed rows select the token.
 * Player rows linked to a character get a sibling eye button (never nest
 * buttons) that opens `PlayerDetailDialog` without disturbing placement.
 * Unplaced rows are toggles (`aria-pressed` = armed); placed rows are plain
 * select actions.
 */
export function RosterRow({
  entity,
  placed,
  armed,
  onArmPlacement,
  onSelectEntity,
  onDragStart,
  onViewPlayer,
}: RosterRowProps) {
  const color = dispositionColor(entity);
  const firstName = entity.name.split(' ')[0];
  const isImage = tokenAvatarUrl(entity.avatarUrl) !== null;

  const handleClick = () => {
    if (placed) onSelectEntity(entity.id);
    else onArmPlacement(entity);
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (!placed) onDragStart(entity, e);
  };

  const viewLabel = `View ${firstName} details`;
  const viewablePcId =
    entity.type === 'player' && entity.playerCharacterId && onViewPlayer
      ? entity.playerCharacterId
      : null;

  return (
    <li className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        aria-pressed={placed ? undefined : armed}
        className={cn(
          'focus-visible:outline-ring flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-sm border px-1.5 py-1 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11',
          armed
            ? 'bg-brass-bg border-brass-border'
            : 'hover:bg-surface-hover border-transparent'
        )}
      >
        <span
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
          style={isImage ? undefined : { backgroundColor: color }}
        >
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entity.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            firstName.charAt(0).toUpperCase()
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-ui text-heading block truncate">
            {firstName}
          </span>
          <span className="type-small text-muted block">
            {placed ? 'On map' : 'Place on map'}
          </span>
        </span>
      </button>
      {viewablePcId && (
        <Tooltip content={viewLabel}>
          <Button
            variant="ghost"
            size="sm"
            aria-label={viewLabel}
            onClick={() => onViewPlayer?.(viewablePcId)}
            className="w-9 shrink-0 px-0"
          >
            <Eye size={16} aria-hidden />
          </Button>
        </Tooltip>
      )}
    </li>
  );
}
