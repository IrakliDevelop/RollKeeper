'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SelectTool,
  type Viewport,
  type CanvasElement,
} from '@fieldnotes/core';
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
 * Listens to pointer events; when select tool has a combatant token selected,
 * shows a fixed badge tracking the cursor distance from the drag origin.
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

  const originRef = useRef<Point | null>(null);
  const dragStartedRef = useRef(false);
  const selectedElementRef = useRef<CanvasElement | null>(null);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!viewport || !dragStartedRef.current || !originRef.current) {
        return;
      }

      // Get the current world position of the selected element
      const element = selectedElementRef.current;
      if (!element || !element.position) {
        setBadge(prev => ({ ...prev, isVisible: false }));
        return;
      }

      // Calculate distance in feet
      const distance = dragDistanceFeet(
        originRef.current,
        element.position,
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

    // Check if select tool is active and has a combatant token selected
    const selectTool = viewport.toolManager.getTool<SelectTool>('select');
    if (!selectTool || selectTool.selectedIds.length === 0) {
      return;
    }

    // Get the first selected element
    const firstId = selectTool.selectedIds[0];
    const element = viewport.store.getById(firstId);

    if (!element || !isCombatantToken(element)) {
      return;
    }

    // Capture the drag origin and element
    selectedElementRef.current = element;
    originRef.current = element.position as Point;
    dragStartedRef.current = true;
  }, [viewport, canvasEl]);

  const handlePointerUp = useCallback(() => {
    dragStartedRef.current = false;
    originRef.current = null;
    selectedElementRef.current = null;
    setBadge(prev => ({ ...prev, isVisible: false }));
  }, []);

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
