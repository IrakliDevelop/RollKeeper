'use client';

import { useCallback, useRef, useState } from 'react';

import { useToast } from '@/components/ui/feedback/Toast';
import { useNPCStore } from '@/store/npcStore';

import { useCombatantTokens } from './useCombatantTokens';
import { useDmVttActions } from './useDmVttActions';
import { useDmVttDragPlacement } from './useDmVttDragPlacement';
import { useDmVttGrid } from './useDmVttGrid';
import { useDmVttInitiative } from './useDmVttInitiative';
import { useDmVttPlacementAndSelection } from './useDmVttPlacementAndSelection';
import { useDmVttRoster } from './useDmVttRoster';

import type { Viewport } from '@fieldnotes/core';
import type { BattleMapConnectionStatus } from '@/lib/battlemapSync';
import type { CampaignNPC } from '@/types/encounter';

interface UseDmVttScreenOptions {
  campaignCode: string;
  battleMapId: string;
  dmId: string;
}

/**
 * Composes the DM VTT play-mode screen: linked-encounter roster join,
 * followed-encounter initiative, entity actions + NPC-dialog state
 * (`useDmVttActions`, mirrors `EncounterView.tsx:177-249`), grid control,
 * and tap/drag placement + canvas-selection mapping. Split across sibling
 * hook files to stay under the 150-line file cap — `useDmVttDragPlacement`
 * gates drag-start on `status === 'live'` (same toast as tap-to-arm) and
 * clears any tap-armed pending placement on drop. `armPlacement` is NOT
 * gated on drag — the screen must skip it when `wasDrag()` is true (a
 * completed drag-drop fires a trailing synthetic click on the same row).
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

  const { getNPCsForCampaign } = useNPCStore();
  const npcs = getNPCsForCampaign(campaignCode);
  const [viewingNpc, setViewingNpc] = useState<{
    npc: CampaignNPC;
    entityId: string;
  } | null>(null);
  const onViewNPC = useCallback(
    (npcSourceId: string, entityId: string) => {
      const npc = npcs.find(n => n.id === npcSourceId);
      if (npc) setViewingNpc({ npc, entityId });
    },
    [npcs]
  );

  const actions = useDmVttActions({ campaignCode, dmId, encounter, onViewNPC });

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

  const { drag, startDrag, wasDrag } = useDmVttDragPlacement({
    status,
    getViewport,
    getCanvasEl,
    addToast,
    selectEntity,
    clearPendingPlacement: cancelPlacement,
  });

  const { setGridMode } = useDmVttGrid({
    campaignCode,
    battleMapId,
    battleMap,
    getViewport,
  });

  return {
    battleMap,
    linkedEncounterIds,
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
    npcDialog: {
      npc: viewingNpc?.npc ?? null,
      entityId: viewingNpc?.entityId ?? null,
      onClose: () => setViewingNpc(null),
    },
  };
}
