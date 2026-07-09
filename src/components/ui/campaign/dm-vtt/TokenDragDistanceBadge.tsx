'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SelectTool, type Viewport } from '@fieldnotes/core';
import {
  dragDistanceFeet,
  type Point,
} from '@/components/ui/campaign/dm-vtt/dragDistance';
import { isCombatantToken } from '@/components/ui/campaign/dm-vtt/combatantToken';

interface TokenDragDistanceBadgeProps {
  viewport: Viewport | null;
  canvasEl: HTMLElement | null;
}

interface BadgeState {
  isVisible: boolean;
  distance: number;
  x: number;
  y: number;
}

/**
 * Headless canvas child component that displays distance during combatant token drags.
 * Listens to pointer events; when the select tool is active with a combatant
 * token selected, shows a fixed badge tracking the cursor distance from the
 * drag origin.
 */
export function TokenDragDistanceBadge({
  viewport,
  canvasEl,
}: TokenDragDistanceBadgeProps) {
  const [badge, setBadge] = useState<BadgeState>({
    isVisible: false,
    distance: 0,
    x: 0,
    y: 0,
  });

  // pointerdown only records "a press started" — the SDK hasn't necessarily
  // processed the click's selection yet at that point. Combatant detection
  // and the one-time origin capture happen on the first pointermove instead,
  // gated by captureAttemptedRef so it only ever runs once per gesture.
  const pointerDownRef = useRef(false);
  const captureAttemptedRef = useRef(false);
  const originRef = useRef<Point | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const resetGesture = useCallback(() => {
    pointerDownRef.current = false;
    captureAttemptedRef.current = false;
    originRef.current = null;
    selectedIdRef.current = null;
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!viewport || !pointerDownRef.current) {
        return;
      }

      if (!captureAttemptedRef.current) {
        captureAttemptedRef.current = true;

        const isSelectToolActive =
          viewport.toolManager.activeTool?.name === 'select';
        const selectTool = viewport.toolManager.getTool<SelectTool>('select');
        const firstId = selectTool?.selectedIds[0];
        const element = firstId ? viewport.store.getById(firstId) : undefined;

        if (
          isSelectToolActive &&
          firstId &&
          element &&
          isCombatantToken(element)
        ) {
          selectedIdRef.current = firstId;
          originRef.current = { x: element.position.x, y: element.position.y };
        }
      }

      const origin = originRef.current;
      const selectedId = selectedIdRef.current;
      if (!origin || !selectedId) {
        return;
      }

      // Re-fetch by id on every move: the store replaces the element object
      // on each position update, so a captured reference goes stale.
      const current = viewport.store.getById(selectedId);
      if (!current || !current.position) {
        setBadge(prev => ({ ...prev, isVisible: false }));
        return;
      }

      // Calculate distance in feet
      const distance = dragDistanceFeet(
        origin,
        current.position,
        viewport.toolContext,
        5
      );

      // Update badge position: +12px right, -24px up from cursor
      setBadge({
        isVisible: true,
        distance,
        x: e.clientX + 12,
        y: e.clientY - 24,
      });
    },
    [viewport]
  );

  const handlePointerDown = useCallback(() => {
    if (!viewport || !canvasEl) {
      return;
    }

    // Only mark that a press started; combatant detection + origin capture
    // happen on the first subsequent pointermove (see handlePointerMove).
    pointerDownRef.current = true;
    captureAttemptedRef.current = false;
    originRef.current = null;
    selectedIdRef.current = null;
  }, [viewport, canvasEl]);

  const handlePointerUp = useCallback(() => {
    resetGesture();
    setBadge(prev => ({ ...prev, isVisible: false }));
  }, [resetGesture]);

  useEffect(() => {
    if (!canvasEl) {
      return;
    }

    canvasEl.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      canvasEl.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [canvasEl, handlePointerDown, handlePointerMove, handlePointerUp]);

  if (!badge.isVisible) {
    return null;
  }

  return (
    <div
      className="bg-surface-raised border-divider pointer-events-none fixed z-30 rounded border px-1.5 py-0.5 text-xs font-bold shadow"
      style={{
        left: `${badge.x}px`,
        top: `${badge.y}px`,
        transform: 'translate(-50%, 0)',
      }}
    >
      {badge.distance} ft
    </div>
  );
}
