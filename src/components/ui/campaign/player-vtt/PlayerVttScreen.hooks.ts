'use client';

import { useCallback, useRef, useState } from 'react';

import { useAutoSave } from '@/hooks/useAutoSave';
import { useCharacterRosterSync } from '@/hooks/useCharacterRosterSync';
import { useHydration } from '@/hooks/useHydration';
import { usePlayerSync } from '@/hooks/usePlayerSync';
import { useSharedCampaignState } from '@/hooks/useSharedCampaignState';
import type { BattleMapConnectionStatus } from '@/lib/battlemapSync';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { ToastData, useToast } from '@/components/ui/feedback/Toast';
import type { SpellAoe } from '@/types/spellAoe';

import type { PendingPlacement } from './SpellPlacementController';
import type { SpellTemplateConfig } from './SpellTemplateTool';

/**
 * Pending-AoE-placement lifecycle. `config.onPlaced` MUST clear `pending`
 * synchronously (no await/microtask gap) — see SpellPlacementController's
 * ordering invariant — or a placement spuriously cancels. Recasting while
 * one is pending replaces it (spec §6).
 */
export function usePlacementFlow(
  addToast: (toast: Omit<ToastData, 'id'>) => void
) {
  const [pendingPlacement, setPendingPlacement] =
    useState<PendingPlacement | null>(null);

  const requestPlacement = useCallback(
    (spellName: string, aoe: SpellAoe) => {
      const config: SpellTemplateConfig = {
        shape: aoe.shape,
        sizeFeet: aoe.sizeFeet,
        widthFeet: aoe.widthFeet,
        onPlaced: () => {
          addToast({
            type: 'success',
            title: `${spellName} cast`,
            message: 'Template placed',
          });
          setPendingPlacement(null);
        },
      };
      setPendingPlacement({ spellName, aoe, config });
    },
    [addToast]
  );

  const cancelPlacement = useCallback(() => {
    setPendingPlacement(null);
    addToast({
      type: 'info',
      title: 'Placement cancelled',
      message: 'Slot stays spent',
    });
  }, [addToast]);

  return { pendingPlacement, requestPlacement, cancelPlacement };
}

/** Composes character load/sync/shared-state/placement for the player VTT screen. */
export function usePlayerVttState(campaignCode: string, characterId: string) {
  const hasHydrated = useHydration();
  const playerCharacter = usePlayerStore(s =>
    s.characters.find(c => c.id === characterId)
  );
  const character = useCharacterStore(s => s.character);
  const loadCharacterState = useCharacterStore(s => s.loadCharacterState);
  const updateCharacterData = usePlayerStore(s => s.updateCharacterData);
  // Loads character + writes live edits back to the roster (page.tsx:387-442).
  useCharacterRosterSync({
    playerCharacter,
    hasHydrated,
    characterId,
    character,
    loadCharacterState,
    updateCharacterData,
  });
  const playerSync = usePlayerSync({ characterId });

  const handleAfterSave = useCallback(() => {
    if (playerSync.syncEnabled && playerSync.autoSync && character) {
      playerSync.syncNow(character);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playerSync.syncEnabled,
    playerSync.autoSync,
    playerSync.syncNow,
    character,
  ]);
  useAutoSave({ onAfterSave: handleAfterSave });
  const { sharedState, refetchNow } = useSharedCampaignState(
    campaignCode,
    characterId
  );
  const handleEndTurn = useCallback(
    async (entityId: string) => {
      const init = sharedState?.initiative;
      if (!campaignCode || !init) return;
      try {
        const res = await fetch(`/api/campaign/${campaignCode}/turn-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            encounterId: init.encounterId,
            round: init.round,
            entityId,
            playerId: characterId,
            requestedAt: new Date().toISOString(),
          }),
        });
        if (!res.ok) {
          console.warn(
            'End-turn request was rejected by the server:',
            res.status
          );
        }
      } catch (err) {
        console.error('Failed to send end-turn request:', err);
      }
    },
    [campaignCode, sharedState?.initiative, characterId]
  );

  const { toasts, addToast, dismissToast } = useToast();
  const { pendingPlacement, requestPlacement, cancelPlacement } =
    usePlacementFlow(addToast);
  const spellTemplateConfigRef = useRef<SpellTemplateConfig | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<BattleMapConnectionStatus>('connecting');

  return {
    character,
    sharedState,
    refetchNow,
    handleEndTurn,
    pendingPlacement,
    requestPlacement,
    cancelPlacement,
    spellTemplateConfigRef,
    connectionStatus,
    setConnectionStatus,
    toasts,
    addToast,
    dismissToast,
  };
}
