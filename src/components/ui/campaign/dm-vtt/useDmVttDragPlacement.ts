'use client';

import { useCallback } from 'react';

import { useRosterDrag } from './useRosterDrag';

import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Viewport } from '@fieldnotes/core';
import type { ToastData } from '@/components/ui/feedback/Toast';
import type { BattleMapConnectionStatus } from '@/lib/battlemapSync';
import type { EncounterEntity } from '@/types/encounter';
import type { RosterDragState } from './useRosterDrag';

export interface UseDmVttDragPlacementOptions {
  status: BattleMapConnectionStatus;
  /** Same rule as tap-to-arm: only a surface with a live room waits. */
  liveRequired: boolean;
  getViewport: () => Viewport | null;
  getCanvasEl: () => HTMLElement | null;
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  selectEntity: (entityId: string) => void;
  /** Clears any tap-armed pending placement (`cancelPlacement`). */
  clearPendingPlacement: () => void;
}

export interface UseDmVttDragPlacementResult {
  drag: RosterDragState | null;
  startDrag: (entity: EncounterEntity, e: ReactPointerEvent) => void;
  wasDrag: () => boolean;
}

/**
 * Wraps `useRosterDrag` for the DM VTT studio, sibling-extracted from
 * `DmVttScreen.hooks.ts` to stay under the 150-line file cap:
 *
 * - Gates drag-to-place on a live connection (when the surface has one)
 *   with the SAME toast as the tap-to-arm path
 *   (`useDmVttPlacementAndSelection.armPlacement`).
 * - A completed drop clears any tap-armed `pendingPlacement` for a
 *   DIFFERENT entity before selecting the dropped one, so the two
 *   placement gestures can't leave stale armed state behind.
 */
export function useDmVttDragPlacement({
  status,
  liveRequired,
  getViewport,
  getCanvasEl,
  addToast,
  selectEntity,
  clearPendingPlacement,
}: UseDmVttDragPlacementOptions): UseDmVttDragPlacementResult {
  const onDropPlaced = useCallback(
    (entityId: string) => {
      clearPendingPlacement();
      selectEntity(entityId);
    },
    [clearPendingPlacement, selectEntity]
  );

  const {
    drag,
    startDrag: rawStartDrag,
    wasDrag,
  } = useRosterDrag({ getViewport, getCanvasEl, onDropPlaced });

  const startDrag = useCallback(
    (entity: EncounterEntity, e: ReactPointerEvent) => {
      if (liveRequired && status !== 'live') {
        addToast({
          type: 'info',
          title: 'Not connected',
          message: 'Waiting for a live connection before placing tokens.',
        });
        return;
      }
      rawStartDrag(entity, e);
    },
    [liveRequired, status, addToast, rawStartDrag]
  );

  return { drag, startDrag, wasDrag };
}
