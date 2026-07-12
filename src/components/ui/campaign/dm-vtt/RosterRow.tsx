'use client';

import { dispositionColor } from './combatantToken';

import { tokenAvatarUrl } from '@/components/ui/campaign/location-map/PlayerTokenTool';

import type { PointerEvent } from 'react';
import type { EncounterEntity } from '@/types/encounter';

export interface RosterRowProps {
  entity: EncounterEntity;
  placed: boolean;
  armed: boolean;
  onArmPlacement: (entity: EncounterEntity) => void;
  onSelectEntity: (entityId: string) => void;
  onDragStart: (entity: EncounterEntity, e: PointerEvent) => void;
}

/**
 * Single roster row: avatar disc, first-word name, placed/unplaced state
 * line. Unplaced rows arm placement on click and forward pointerdown to
 * `onDragStart` (Task 4's drag logic decides tap-vs-drag by movement
 * threshold — this row just forwards both). Placed rows select the token.
 */
export function RosterRow({
  entity,
  placed,
  armed,
  onArmPlacement,
  onSelectEntity,
  onDragStart,
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

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        className={`flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 text-left transition-colors ${
          placed ? 'opacity-60' : ''
        } ${
          armed
            ? 'bg-accent-blue-bg border-accent-blue-border'
            : 'hover:bg-surface-secondary'
        }`}
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
          <span className="text-body block truncate text-xs font-medium">
            {firstName}
          </span>
          <span className="text-faint block text-[10px]">
            {placed ? 'On map' : 'Tap → place'}
          </span>
        </span>
      </button>
    </li>
  );
}
