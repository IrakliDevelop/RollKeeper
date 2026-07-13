'use client';

import { dispositionColor } from './combatantToken';

import { tokenAvatarUrl } from '@/components/ui/campaign/location-map/PlayerTokenTool';

import type { RosterDragState } from './useRosterDrag';

export interface RosterDragGhostProps {
  drag: RosterDragState | null;
}

/**
 * Fixed-position chip that follows the pointer while a roster row is being
 * dragged toward the canvas — disc (avatar image or disposition color) plus
 * first-word name, centered on `drag.x/y`. `pointer-events-none` so it never
 * intercepts the drop itself (drop math reads the underlying pointer event,
 * not this element). For sized creatures on a square grid, a dashed outline
 * matching the actual footprint (`drag.footprintPx`) is drawn behind the
 * chip; hex/off-grid maps fall back to the `N×N` text hint.
 */
export function RosterDragGhost({ drag }: RosterDragGhostProps) {
  if (!drag) return null;

  const { entity, x, y, footprintPx } = drag;
  const color = dispositionColor(entity);
  const firstName = entity.name.split(' ')[0];
  const isImage = tokenAvatarUrl(entity.avatarUrl) !== null;
  const cells = entity.tokenSize ?? 1;
  const showOutline = footprintPx !== null && cells > 1;

  return (
    <>
      {showOutline && (
        <div
          aria-hidden
          className="border-accent-blue-border pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-dashed opacity-70"
          style={{ left: x, top: y, width: footprintPx, height: footprintPx }}
        />
      )}
      <div
        className="bg-surface-raised border-divider pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border px-2 py-1 shadow-xl"
        style={{ left: x, top: y }}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white"
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
        <span className="text-heading text-xs font-medium whitespace-nowrap">
          {firstName}
          {cells > 1 && !showOutline && (
            <span className="text-muted ml-1">
              {cells}×{cells}
            </span>
          )}
        </span>
      </div>
    </>
  );
}
