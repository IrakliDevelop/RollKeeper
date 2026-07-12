'use client';

import { useCallback } from 'react';

import { useEncounterStore } from '@/store/encounterStore';

import { restampCombatantTokens } from './combatantToken';

import type { Viewport } from '@fieldnotes/core';
import type { EncounterEntity } from '@/types/encounter';

interface UseTokenIdentityUpdateOptions {
  encounterId: string | undefined;
  getViewport: () => Viewport | null;
}

/** Persists portrait/size edits to the encounter store and restamps placed tokens. */
export function useTokenIdentityUpdate({
  encounterId,
  getViewport,
}: UseTokenIdentityUpdateOptions) {
  const { updateEntity } = useEncounterStore();
  return useCallback(
    (
      entity: EncounterEntity,
      updates: Pick<EncounterEntity, 'avatarUrl' | 'tokenSize'>
    ) => {
      if (!encounterId) return;
      updateEntity(encounterId, entity.id, updates);
      const vp = getViewport();
      if (vp) {
        restampCombatantTokens(
          vp.store,
          { ...entity, ...updates },
          vp.toolContext
        );
      }
    },
    [encounterId, getViewport, updateEntity]
  );
}
