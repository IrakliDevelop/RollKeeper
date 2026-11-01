import { useEffect, useMemo, useState } from 'react';
import type { Viewport } from '@fieldnotes/core';
import type { MovementTrackOptions } from '@fieldnotes/vtt';
import { useEncounterStore, getSortedEntities } from '@/store/encounterStore';
import { useBattleMapStore } from '@/store/battleMapStore';
import { useCharacterStore } from '@/store/characterStore';
import type { CampaignPlayerData } from '@/types/campaign';
import type { SharedInitiativeState } from '@/types/sharedState';
import type {
  TableMovementTurn,
  TableSceneAdapter,
} from '@/lib/table/sceneAdapter';
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
  sceneAdapter?: TableSceneAdapter;
  tablePlayers?: readonly CampaignPlayerData[];
  initiative?: SharedInitiativeState | null;
  dash: boolean;
  onDashChange?: (enabled: boolean) => void;
}

function matchesActiveToken(
  identity: ReturnType<typeof movableTokenIdentity>,
  sceneTurn: TableMovementTurn | null | undefined,
  activeId: string | null | undefined,
  activeCharacterId: string | undefined
): boolean {
  if (!identity) return false;
  if (sceneTurn !== undefined)
    return Boolean(
      sceneTurn &&
        (identity.kind === 'player'
          ? sceneTurn.playerIds.includes(identity.key)
          : sceneTurn.entityIds.includes(identity.key))
    );
  return identity.kind === 'player'
    ? identity.key === activeCharacterId
    : identity.key === activeId;
}

export function useBattleMapMovement({
  viewport,
  campaignCode,
  battleMapId,
  characterId,
  sceneAdapter,
  tablePlayers,
  initiative,
  dash,
  onDashChange,
}: BattleMapMovementProps) {
  const encounters = useEncounterStore(s => s.encounters);
  const maps = useBattleMapStore(s => s.battleMaps);
  const character = useCharacterStore(s => s.character);
  const [, refresh] = useState(0);
  const [sceneRevision, refreshScene] = useState(0);
  useEffect(
    () => sceneAdapter?.subscribe(() => refreshScene(value => value + 1)),
    [sceneAdapter]
  );
  // Keep the turn object stable across the tracker-driven render updates;
  // repository notifications and authorized player snapshots invalidate it.
  const sceneSnapshot = useMemo(
    () => ({
      revision: sceneRevision,
      turn:
        sceneAdapter?.getMovementTurn?.(
          tablePlayers?.map(player => ({
            playerId: player.playerId,
            characterId: player.characterId,
            name: player.characterName,
          }))
        ) ?? null,
    }),
    [sceneAdapter, sceneRevision, tablePlayers]
  );
  const sceneTurn = sceneSnapshot.turn;
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
  const legacyEpoch =
    combat?.isActive && activeId
      ? `${characterId ? initiative?.encounterId : encounter?.id}:${characterId && initiative?.combatGeneration !== undefined ? `${initiative.combatGeneration}:` : ''}${combat.round}:${activeId}`
      : null;
  const epoch = sceneAdapter ? (sceneTurn?.epoch ?? null) : legacyEpoch;

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
          const matches = matchesActiveToken(
            identity,
            sceneAdapter ? sceneTurn : undefined,
            activeId,
            activeCharacterId
          );
          if (
            !matches ||
            (characterId &&
              (identity.kind !== 'player' || identity.key !== characterId))
          )
            continue;
          const matchingPlayers =
            identity.kind === 'player'
              ? tablePlayers?.filter(
                  player =>
                    player.playerId === identity.key ||
                    player.characterId === identity.key
                )
              : undefined;
          const livePlayer =
            matchingPlayers?.length === 1
              ? matchingPlayers[0]?.characterData
              : undefined;
          const speed =
            livePlayer && Number.isFinite(livePlayer.speed)
              ? characterWalkingSpeed(livePlayer)
              : characterId && character?.id === characterId
                ? characterWalkingSpeed(character)
                : ((sceneAdapter
                    ? sceneAdapter.resolveMovement(identity)
                    : resolveDmMovement(identity, linked)
                  )?.walkFeet ?? 30);
          next.set(element.id, {
            epoch,
            bands: movementRangeBands(speed, dash),
            visibility:
              !characterId &&
              (sceneAdapter
                ? sceneAdapter.getBattleMap()?.dmOnlyElements[element.id] ===
                  true
                : resolveElementAudience(
                    'battlemap',
                    campaignCode,
                    battleMapId,
                    element.id
                  ) === 'dm')
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
    sceneAdapter,
    sceneTurn,
    tablePlayers,
  ]);

  const token = viewport.store.getAll().find(element => {
    const identity = movableTokenIdentity(element);
    return (
      identity &&
      epoch &&
      matchesActiveToken(
        identity,
        sceneAdapter ? sceneTurn : undefined,
        activeId,
        activeCharacterId
      ) &&
      (!characterId ||
        (identity.kind === 'player' && identity.key === characterId))
    );
  });
  const movement = token ? tracker.getMovement(token.id) : null;
  return { tracker, token, movement, epoch, placing, setPlacing };
}
