'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { dispositionColor, stampCombatantToken } from './combatantToken';

import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Viewport } from '@fieldnotes/core';
import type { EncounterEntity } from '@/types/encounter';
import type { DmTokenConfig } from './combatantToken';

/** Screen-space ghost position, tracked while a roster row is being dragged. */
export interface RosterDragState {
  entity: EncounterEntity;
  x: number;
  y: number;
}

export interface UseRosterDragOptions {
  getViewport: () => Viewport | null;
  /** The canvas container element (drop target bounds). */
  getCanvasEl: () => HTMLElement | null;
  onDropPlaced: (entityId: string) => void;
}

export interface UseRosterDragResult {
  drag: RosterDragState | null;
  startDrag: (entity: EncounterEntity, e: ReactPointerEvent) => void;
  /** True if the pointer moved beyond the 6px tap threshold (tap = arm instead). */
  wasDrag: () => boolean;
}

/** Below this many CSS px of pointer travel, a gesture counts as a tap. */
const TAP_THRESHOLD_PX = 6;

function isInsideRect(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function pastThreshold(
  start: { x: number; y: number },
  x: number,
  y: number
): boolean {
  return Math.hypot(x - start.x, y - start.y) >= TAP_THRESHOLD_PX;
}

/**
 * Stamps a combatant token at a screen point.
 *
 * RECON (Task 4): `Viewport` (`@fieldnotes/core` dist/index.d.ts) publicly
 * exposes `readonly toolContext: ToolContext`, kept live by the Viewport
 * itself — its grid controller/layer manager write gridSize/gridType/
 * hexOrientation/activeLayerId/snapToGrid into that SAME object as the map
 * changes, and it's the identical object every `Tool` receives in
 * onPointerDown/onPointerUp (e.g. `DmTokenTool`). So `vp.toolContext`
 * already IS the minimal ToolContext view — no need to hand-roll one or
 * re-derive grid values from `getElementsByType('grid')`.
 */
export function stampAtScreenPoint(
  vp: Viewport,
  canvasEl: HTMLElement,
  entity: EncounterEntity,
  screen: { x: number; y: number }
): void {
  const rect = canvasEl.getBoundingClientRect();
  const rel = { x: screen.x - rect.left, y: screen.y - rect.top };
  const world = vp.camera.screenToWorld(rel);
  const config: Omit<DmTokenConfig, 'onPlaced'> = {
    entityId: entity.id,
    name: entity.name,
    avatarUrl: entity.avatarUrl,
    color: dispositionColor(entity),
    tokenSize: entity.tokenSize,
  };
  stampCombatantToken(config, world, vp.toolContext);
}

/**
 * Pointer drag-to-place from a roster row onto the canvas. `startDrag`
 * captures window pointermove/pointerup listeners (pointer events unify
 * touch + mouse) and tracks the ghost position; under the 6px tap
 * threshold counts as a tap (caller's click handler arms placement — see
 * `RosterRow`). Drop inside canvas bounds stamps + fires `onDropPlaced`;
 * outside cancels silently.
 */
export function useRosterDrag({
  getViewport,
  getCanvasEl,
  onDropPlaced,
}: UseRosterDragOptions): UseRosterDragResult {
  const [drag, setDrag] = useState<RosterDragState | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const startDrag = useCallback(
    (entity: EncounterEntity, e: ReactPointerEvent) => {
      cleanupRef.current?.(); // a stale gesture's listeners must not overlap
      const { clientX, clientY } = e;
      startPointRef.current = { x: clientX, y: clientY };
      movedRef.current = false;
      // Don't set drag state yet — a bare pointerdown must not flicker the
      // ghost. It only appears once movement crosses the tap threshold.

      const handleMove = (ev: PointerEvent) => {
        const start = startPointRef.current;
        if (start && pastThreshold(start, ev.clientX, ev.clientY)) {
          movedRef.current = true;
        }
        if (movedRef.current) {
          setDrag({ entity, x: ev.clientX, y: ev.clientY });
        }
      };

      const handleUp = (ev: PointerEvent) => {
        // Also judged here, not just in handleMove — a fast gesture can
        // arrive as a single up event with no moves in between.
        const start = startPointRef.current;
        if (start && pastThreshold(start, ev.clientX, ev.clientY)) {
          movedRef.current = true;
        }
        cleanupRef.current?.();
        cleanupRef.current = null;
        startPointRef.current = null;
        setDrag(null);

        if (!movedRef.current) return;
        const vp = getViewport();
        const canvasEl = getCanvasEl();
        if (!vp || !canvasEl) return;
        const rect = canvasEl.getBoundingClientRect();
        if (!isInsideRect(rect, ev.clientX, ev.clientY)) return;
        stampAtScreenPoint(vp, canvasEl, entity, {
          x: ev.clientX,
          y: ev.clientY,
        });
        onDropPlaced(entity.id);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      cleanupRef.current = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };
    },
    [getViewport, getCanvasEl, onDropPlaced]
  );

  const wasDrag = useCallback(() => movedRef.current, []);

  // Clean up listeners if unmounted mid-drag.
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      startPointRef.current = null;
      movedRef.current = false;
      setDrag(null);
    };
  }, []);

  return { drag, startDrag, wasDrag };
}
