'use client';

import { useCallback, useRef, useState } from 'react';

import { dispositionColor } from './combatantToken';
import { selectedEntityId as resolveSelectedEntity } from './useCombatantTokens';

import type { Viewport } from '@fieldnotes/core';
import type { ToastData } from '@/components/ui/feedback/Toast';
import type { BattleMapConnectionStatus } from '@/lib/battlemapSync';
import type { EncounterEntity } from '@/types/encounter';
import type { DmTokenConfig } from './combatantToken';
import type { PendingTokenPlacement } from './TokenPlacementController';

export type StudioTab = 'initiative' | 'selected';

interface UseDmVttPlacementAndSelectionOptions {
  status: BattleMapConnectionStatus;
  linkedEntities: EncounterEntity[];
  getViewport: () => Viewport | null;
  addToast: (toast: Omit<ToastData, 'id'>) => void;
}

/**
 * Tap-to-arm placement lifecycle (gated on a live connection, spec §7) +
 * canvas-selection -> entity mapping for the DM VTT studio.
 *
 * `onPlaced` clears `pendingPlacement` SYNCHRONOUSLY — `TokenPlacementController`
 * only stays cancel-free on a successful placement because the tool's
 * `onPointerUp` and this callback both run in the same commit; an
 * await/microtask gap here would make every placement spuriously cancel.
 */
export function useDmVttPlacementAndSelection({
  status,
  linkedEntities,
  getViewport,
  addToast,
}: UseDmVttPlacementAndSelectionOptions) {
  const [pendingPlacement, setPendingPlacement] =
    useState<PendingTokenPlacement | null>(null);
  const tokenConfigRef = useRef<DmTokenConfig | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [studioTab, setStudioTab] = useState<StudioTab>('initiative');

  const linkedEntitiesRef = useRef(linkedEntities);
  linkedEntitiesRef.current = linkedEntities;

  const selectEntity = useCallback((entityId: string) => {
    setSelectedEntityId(entityId);
    setStudioTab('selected');
  }, []);

  const armPlacement = useCallback(
    (entity: EncounterEntity) => {
      if (status !== 'live') {
        addToast({
          type: 'info',
          title: 'Not connected',
          message: 'Waiting for a live connection before placing tokens.',
        });
        return;
      }
      const config: DmTokenConfig = {
        entityId: entity.id,
        name: entity.name,
        avatarUrl: entity.avatarUrl,
        color: dispositionColor(entity),
        onPlaced: () => {
          setPendingPlacement(null); // SYNCHRONOUS — see comment above.
          selectEntity(entity.id);
        },
      };
      setPendingPlacement({ entityName: entity.name, config });
    },
    [status, addToast, selectEntity]
  );

  const cancelPlacement = useCallback(() => setPendingPlacement(null), []);

  const handleSelectionChange = useCallback(
    (ids: string[]) => {
      const store = getViewport()?.store;
      if (!store) return;
      const id = resolveSelectedEntity(ids, store);
      if (id === null) return; // no combatant token in this selection
      const known = linkedEntitiesRef.current.some(e => e.id === id);
      if (!known) {
        // Entity deleted or its encounter unlinked since the token was
        // stamped — leave the selection unset rather than showing a dead id.
        addToast({
          type: 'info',
          title: 'Unlinked token',
          message: 'its combatant is no longer in the encounter',
        });
        setSelectedEntityId(null);
        return;
      }
      selectEntity(id);
    },
    [getViewport, addToast, selectEntity]
  );

  return {
    pendingPlacement,
    tokenConfigRef,
    armPlacement,
    cancelPlacement,
    selectedEntityId,
    studioTab,
    setStudioTab,
    selectEntity,
    handleSelectionChange,
  };
}
