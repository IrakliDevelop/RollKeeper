'use client';

import { useCallback, useRef, useState } from 'react';

import { useToast } from '@/components/ui/feedback/Toast';

import { useCombatantTokens } from './useCombatantTokens';
import { useDmVttActions } from './useDmVttActions';
import { useDmVttGrid } from './useDmVttGrid';
import { useDmVttInitiative } from './useDmVttInitiative';
import { useDmVttPlacementAndSelection } from './useDmVttPlacementAndSelection';
import { useDmVttRoster } from './useDmVttRoster';
import { useRosterDrag } from './useRosterDrag';

import type { Viewport } from '@fieldnotes/core';
import type { BattleMapConnectionStatus } from '@/lib/battlemapSync';

interface UseDmVttScreenOptions {
  campaignCode: string;
  battleMapId: string;
  dmId: string;
}

/**
 * Composes the DM VTT play-mode screen: linked-encounter roster join
 * (`useDmVttRoster`), followed-encounter initiative (Task 6), entity
 * actions (`useDmVttActions`, mirrors `EncounterView.tsx:177-249`), grid
 * control (`useDmVttGrid`), and tap/drag placement + canvas-selection
 * mapping (`useDmVttPlacementAndSelection`). Split across sibling hook
 * files to stay under the 150-line file cap.
 * `armPlacement` returned here is NOT yet gated on drag — the screen must
 * skip it when `wasDrag()` is true (a completed roster drag-drop fires a
 * trailing synthetic click on the same row).
 */
export function useDmVttScreen({
  campaignCode,
  battleMapId,
  dmId,
}: UseDmVttScreenOptions) {
  const { battleMap, linkedEncounterIds, linkedEntities } = useDmVttRoster({
    campaignCode,
    battleMapId,
  });

  const {
    encounter,
    followNote,
    activeEntity,
    handleNextTurn,
    handlePrevTurn,
  } = useDmVttInitiative({ campaignCode, dmId, linkedEncounterIds });

  const actions = useDmVttActions({ campaignCode, dmId, encounter });

  const { toasts, addToast, dismissToast } = useToast();

  const [viewport, setViewport] = useState<Viewport | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  viewportRef.current = viewport;
  const [status, setStatus] = useState<BattleMapConnectionStatus>('connecting');
  const getViewport = useCallback(() => viewportRef.current, []);
  const getCanvasEl = useCallback(
    () => viewportRef.current?.domLayer ?? null,
    []
  );

  const placedIndex = useCombatantTokens(viewport?.store ?? null);

  const {
    pendingPlacement,
    tokenConfigRef,
    armPlacement,
    cancelPlacement,
    selectedEntityId,
    studioTab,
    setStudioTab,
    selectEntity,
    handleSelectionChange,
  } = useDmVttPlacementAndSelection({
    status,
    linkedEntities,
    getViewport,
    addToast,
  });

  const { drag, startDrag, wasDrag } = useRosterDrag({
    getViewport,
    getCanvasEl,
    onDropPlaced: selectEntity,
  });

  const { setGridMode } = useDmVttGrid({
    campaignCode,
    battleMapId,
    battleMap,
    getViewport,
  });

  return {
    battleMap,
    linkedEntities,
    placedIndex,
    encounter,
    followNote,
    activeEntity,
    handleNextTurn,
    handlePrevTurn,
    actions,
    viewport,
    status,
    onViewportReady: setViewport,
    onStatus: setStatus,
    onSelectionChange: handleSelectionChange,
    tokenConfigRef,
    pendingPlacement,
    armPlacement,
    wasDrag,
    cancelPlacement,
    selectedEntityId,
    selectEntity,
    studioTab,
    setStudioTab,
    drag,
    startDrag,
    getCanvasEl,
    setGridMode,
    toasts,
    dismissToast,
  };
}
