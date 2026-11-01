import { useEffect, useMemo, useState } from 'react';
import type { Viewport } from '@fieldnotes/core';
import type { MovementTrackOptions } from '@fieldnotes/vtt';
import { useEncounterStore, getSortedEntities } from '@/store/encounterStore';
import { useBattleMapStore } from '@/store/battleMapStore';
import { useCharacterStore } from '@/store/characterStore';
import type { SharedInitiativeState } from '@/types/sharedState';
import { movableTokenIdentity } from './tokenIdentity';
import { characterWalkingSpeed, movementRangeBands } from './movementSpeed';
import { resolveDmMovement } from './movementLogging';
import { resolveElementAudience } from './elementAudience';
import { configureMovement, getMovementTracker } from './movementTracking';

export interface BattleMapMovementProps {
  viewport: Viewport;
  campaignCode: string;
  battleMapId: string;
  characterId?: string;
  initiative?: SharedInitiativeState | null;
  dash: boolean;
  onDashChange?: (enabled: boolean) => void;
}

export function useBattleMapMovement({
  viewport,
  campaignCode,
  battleMapId,
  characterId,
  initiative,
  dash,
  onDashChange,
}: BattleMapMovementProps) {
  const encounters = useEncounterStore(s => s.encounters);
  const maps = useBattleMapStore(s => s.battleMaps);
  const character = useCharacterStore(s => s.character);
  const [, refresh] = useState(0);
  const [placing, setPlacing] = useState(false);
  const tracker = useMemo(() => getMovementTracker(viewport), [viewport]);
  const map = maps[campaignCode]?.[battleMapId];
  const linked = useMemo(
    () => map?.linkedEncounterIds ?? [],
    [map?.linkedEncounterIds]
  );
  const encounter = encounters.find(e => linked.includes(e.id) && e.isActive);
  const active = encounter
    ? getSortedEntities(encounter.entities)[encounter.currentTurn]
    : null;
  const combat = characterId ? initiative : encounter;
  const activeId = characterId ? initiative?.currentEntityId : active?.id;
  const activeCharacterId = characterId
    ? initiative?.turnOrder.find(e => e.entityId === activeId)
        ?.playerCharacterId
    : active?.playerCharacterId;
  const epoch =
    combat?.isActive && activeId
      ? `${characterId ? initiative?.encounterId : encounter?.id}:${combat.round}:${activeId}`
      : null;

  useEffect(() => {
    tracker.cancelPlacement();
    onDashChange?.(false);
  }, [tracker, epoch, onDashChange]);

  useEffect(() => {
    const sync = () => {
      const next = new Map<string, MovementTrackOptions>();
      if (epoch)
        for (const element of viewport.store.getAll()) {
          const identity = movableTokenIdentity(element);
          if (!identity) continue;
          const matches =
            identity.kind === 'player'
              ? identity.key === activeCharacterId
              : identity.key === activeId;
          if (
            !matches ||
            (characterId &&
              (identity.kind !== 'player' || identity.key !== characterId))
          )
            continue;
          const speed =
            characterId && character?.id === characterId
              ? characterWalkingSpeed(character)
              : (resolveDmMovement(identity, linked)?.walkFeet ?? 30);
          next.set(element.id, {
            epoch,
            bands: movementRangeBands(speed, dash),
            visibility:
              !characterId &&
              resolveElementAudience(
                'battlemap',
                campaignCode,
                battleMapId,
                element.id
              ) === 'dm'
                ? 'dm'
                : 'all',
          });
        }
      configureMovement(viewport, next);
      if (!epoch || (characterId && activeCharacterId !== characterId)) {
        tracker.cancelPlacement();
      }
      refresh(v => v + 1);
    };
    const disposers = [
      viewport.store.on('add', sync),
      viewport.store.on('update', sync),
      viewport.store.on('remove', sync),
      viewport.store.on('batch', sync),
      viewport.store.on('clear', sync),
      tracker.onPlacementEnd(() => setPlacing(false)),
    ];
    sync();
    return () => {
      disposers.forEach(dispose => dispose());
      tracker.cancelPlacement();
      configureMovement(viewport, new Map());
    };
  }, [
    viewport,
    tracker,
    epoch,
    activeId,
    activeCharacterId,
    characterId,
    character,
    campaignCode,
    battleMapId,
    map,
    encounters,
    dash,
    linked,
  ]);

  const token = viewport.store.getAll().find(element => {
    const identity = movableTokenIdentity(element);
    return (
      identity &&
      epoch &&
      (identity.kind === 'player'
        ? identity.key === activeCharacterId
        : identity.key === activeId) &&
      (!characterId ||
        (identity.kind === 'player' && identity.key === characterId))
    );
  });
  const movement = token ? tracker.getMovement(token.id) : null;
  return { tracker, token, movement, epoch, placing, setPlacing };
}
