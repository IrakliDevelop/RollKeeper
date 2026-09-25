'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Encounter, EncounterEntity } from '@/types/encounter';

export interface CreatureDrawerState {
  /** Entity currently shown, resolved from `encounter`; null when closed or the entity vanished. */
  entity: EncounterEntity | null;
  open: (entityId: string) => void;
  close: () => void;
}

interface UseCreatureDrawerStateOptions {
  encounter: Encounter | null;
  onViewPlayer: (playerCharacterId: string) => void;
}

/**
 * Drawer-open state for the DM creature sheet (PR 1 of the DM creature
 * drawer). `entity` is re-derived from `encounter.entities` on every render
 * rather than snapshotted, so HP/conditions/etc. stay live while the drawer
 * is open; the effect below clears the stored id once the entity can no
 * longer be found (removed from the encounter, or the followed encounter
 * changed/cleared), which closes the drawer.
 */
export function useCreatureDrawerState({
  encounter,
  onViewPlayer,
}: UseCreatureDrawerStateOptions): CreatureDrawerState {
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);

  const entity = openEntityId
    ? (encounter?.entities.find(e => e.id === openEntityId) ?? null)
    : null;

  useEffect(() => {
    if (openEntityId !== null && entity === null) setOpenEntityId(null);
  }, [openEntityId, entity]);

  const open = useCallback(
    (entityId: string) => {
      const target = encounter?.entities.find(e => e.id === entityId);
      if (!target) return; // unknown id: no-op
      if (target.type === 'player') {
        // Players never get the creature drawer; show their sheet when linked.
        if (target.playerCharacterId) onViewPlayer(target.playerCharacterId);
        return;
      }
      setOpenEntityId(entityId);
    },
    [encounter, onViewPlayer]
  );

  const close = useCallback(() => setOpenEntityId(null), []);

  return { entity, open, close };
}
