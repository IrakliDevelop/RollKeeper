import { getSortedEntities } from '@/utils/combatMechanics';
import { mergePlayerSyncData } from '@/utils/encounterSync';
import type { CampaignPlayerData } from '@/types/campaign';
import type {
  Encounter,
  EncounterCondition,
  EncounterEntity,
} from '@/types/encounter';

import { isImportedActive } from './combat';
import {
  deriveSceneRoster,
  isEditableActor,
  verifyPlayerIdentity,
  type TableCampaignPlayer,
  type TableRosterEntry,
} from './roster';
import type {
  TableEncounterRecordV1,
  TableWorkspaceSnapshotV1,
} from './schema';

/** Server initiative id grammar (`tableServer/validation.ts`). */
export const PUBLIC_ID = /^[a-zA-Z0-9_-]{1,128}$/u;

export interface TableCombatParticipantView {
  actorId: string;
  /** Public identity: the run scene member's `sceneMemberId` (R2-1). */
  entityId: string;
  kind: 'editable' | 'player-reference' | 'adopted-pc';
  /** Verified player identity (actor identity, not token control — C3-4). */
  verifiedLegacyPlayerId: string | null;
  playerControlled: boolean;
  identityUnresolved: boolean;
  removedFromScene: boolean;
  hidden: boolean;
  /** Player's current condition names (overlay commands prune against them). */
  playerConditionNames: string[] | undefined;
  /** Suppressed names the player no longer has (C3-5 prune candidates). */
  staleSuppressions: string[];
  validIdentity: boolean;
  entity: EncounterEntity;
}

export interface TableCombatReadModel {
  run: TableEncounterRecordV1;
  /** Encounter-shaped view: entities already sorted, `currentTurn` indexes it. */
  encounter: Encounter;
  participants: TableCombatParticipantView[];
  /** Running here: active and holding the campaign pointer. */
  running: boolean;
  importedActive: boolean;
  actorIdByEntityId: ReadonlyMap<string, string>;
}

function toTablePlayers(
  players: readonly CampaignPlayerData[] | undefined
): TableCampaignPlayer[] | undefined {
  return players?.map(player => ({
    playerId: player.playerId,
    characterId: player.characterId,
    name: player.characterName || player.playerName || player.playerId,
  }));
}

function activeConditionNames(player: CampaignPlayerData | undefined) {
  if (!player?.characterData) return undefined;
  return (
    player.characterData.conditionsAndDiseases?.activeConditions ?? []
  ).map(condition => condition.name);
}

function entityType(entry: TableRosterEntry | undefined) {
  if (!entry) return 'npc' as const;
  return entry.category === 'pc' ? ('player' as const) : entry.category;
}

/**
 * Builds the Encounter-shaped read model the existing combat components
 * consume, from repository records plus the server-authorized players
 * snapshot. Player data is merged read-only with the existing
 * `mergePlayerSyncData` precedence; nothing here writes anywhere.
 */
export function buildCombatReadModel(options: {
  snapshot: TableWorkspaceSnapshotV1;
  runId: string;
  players?: readonly CampaignPlayerData[];
}): TableCombatReadModel | null {
  const { snapshot, runId, players } = options;
  const run = snapshot.encounters.find(value => value.runId === runId);
  if (!run) return null;
  const tablePlayers = toTablePlayers(players);
  const roster = deriveSceneRoster({
    snapshot,
    sceneId: run.sceneId,
    players: tablePlayers,
  });
  const entries = new Map(roster.entries.map(entry => [entry.actorId, entry]));
  const actors = new Map(snapshot.actors.map(actor => [actor.actorId, actor]));

  const views = run.participants.map(
    (participant, index): TableCombatParticipantView => {
      const actor = actors.get(participant.actorId);
      const entry = entries.get(participant.actorId);
      const entityId = entry?.sceneMemberId ?? `participant-${index}`;
      const kind: TableCombatParticipantView['kind'] =
        actor?.actorKind === 'player-reference'
          ? 'player-reference'
          : actor && isEditableActor(snapshot, actor)
            ? 'editable'
            : 'adopted-pc';
      const verified =
        kind === 'editable' ? null : (entry?.verifiedLegacyPlayerId ?? null);
      const verification =
        verified && tablePlayers
          ? verifyPlayerIdentity(tablePlayers, verified)
          : null;
      const playerCharacterId =
        verification?.status === 'verified'
          ? (verification.characterId ?? verified)
          : undefined;
      const playerData = verified
        ? players?.find(player => player.playerId === verified)
        : undefined;
      const stats = actor?.liveStats;
      const overlay = actor?.playerConditionOverlay;
      const currentNames = activeConditionNames(playerData);
      const suppressed = overlay?.suppressedSourceConditionIds ?? [];
      const effectiveSuppressed = currentNames
        ? suppressed.filter(name => currentNames.includes(name))
        : suppressed;
      const staleSuppressions = currentNames
        ? suppressed.filter(name => !currentNames.includes(name))
        : [];

      let entity: EncounterEntity = {
        id: entityId,
        type: entityType(entry),
        name: entry?.name ?? stats?.name ?? participant.actorId,
        initiative: participant.initiative,
        initiativeModifier: 0,
        currentHp: stats?.currentHp ?? 0,
        maxHp: stats?.maxHp ?? 0,
        tempHp: stats?.tempHp ?? 0,
        armorClass: stats?.armorClass ?? 0,
        conditions: structuredClone(
          (kind === 'player-reference'
            ? (overlay?.dmConditions ?? [])
            : (stats?.conditions ?? [])) as unknown as EncounterCondition[]
        ),
        hasUsedReaction: !participant.turnResources.reactionAvailable,
        ...(participant.hidden ? { isHidden: true } : {}),
        ...(entry?.avatarUrl ? { avatarUrl: entry.avatarUrl } : {}),
        ...(playerCharacterId ? { playerCharacterId } : {}),
      };
      if (playerData) {
        const merged = mergePlayerSyncData(
          { ...entity, suppressedConditions: effectiveSuppressed },
          playerData
        );
        if (merged) {
          const { suppressedConditions: _ignored, ...rest } = merged;
          void _ignored;
          entity = { ...entity, ...rest };
        }
      }
      return {
        actorId: participant.actorId,
        entityId,
        kind,
        verifiedLegacyPlayerId: verified,
        playerControlled: kind !== 'editable' && verified !== null,
        identityUnresolved: kind !== 'editable' && verified === null,
        removedFromScene: entry?.removed ?? true,
        hidden: participant.hidden === true,
        playerConditionNames: currentNames,
        staleSuppressions,
        validIdentity:
          entry?.sceneMemberId !== null &&
          entry?.sceneMemberId !== undefined &&
          PUBLIC_ID.test(entityId) &&
          (playerCharacterId === undefined ||
            PUBLIC_ID.test(playerCharacterId)),
        entity,
      };
    }
  );

  const sorted = getSortedEntities(views.map(view => view.entity));
  const order = new Map(sorted.map((entity, index) => [entity.id, index]));
  const participants = [...views].sort(
    (left, right) => order.get(left.entityId)! - order.get(right.entityId)!
  );
  const currentEntity = views.find(view => view.actorId === run.currentActorId);
  const importedActive = isImportedActive(run, snapshot.campaign);
  const running = run.isActive && snapshot.campaign?.activeRunId === run.runId;
  return {
    run,
    encounter: {
      id: run.runId,
      name: run.label ?? 'Scene run',
      entities: sorted,
      currentTurn: currentEntity ? order.get(currentEntity.entityId)! : -1,
      round: run.round,
      isActive: running,
      sortOrder: 'initiative',
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    },
    participants,
    running,
    importedActive,
    actorIdByEntityId: new Map(
      views.map(view => [view.entityId, view.actorId])
    ),
  };
}
