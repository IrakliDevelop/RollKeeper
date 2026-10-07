import {
  absorbDamage,
  clampHp,
  decrementConditionRounds,
  getSortedEntities,
  healHp,
  stackTempHp,
} from '@/utils/combatMechanics';
import type { EncounterEntity } from '@/types/encounter';

import type { TableRepository, TableWorkspaceMutation } from './repository';
import { isEditableActor } from './roster';
import {
  TABLE_LIMITS,
  canonicalJson,
  isRunLabel,
  serializedByteCount,
  type JsonObject,
  type TableActorRecordV1,
  type TableCampaignRecordV1,
  type TableCommitResult,
  type TableEncounterParticipantV1,
  type TableEncounterRecordV1,
  type TableLogRecordV1,
  type TableSceneMemberV1,
  type TableSceneRecordV1,
  type TableWorkspaceSnapshotV1,
} from './schema';

/**
 * Scene combat commands (PR03, S2). Each command is planned against the
 * snapshot whose revision equals its expected revision and committed through
 * ONE `mutateWorkspace` transaction digesting the command intent, so a retry
 * with the same operation id replays the recorded result and a stale command
 * conflicts instead of being re-planned on newer state.
 */

export const MAX_RUN_PARTICIPANTS = 256;

export type TableCombatStatChange =
  | {
      kind:
        | 'damage'
        | 'heal'
        | 'addTempHp'
        | 'setTempHp'
        | 'setHp'
        | 'setMaxHp'
        | 'setArmorClass';
      value: number;
    }
  | { kind: 'addCondition'; condition: JsonObject }
  | {
      kind: 'removeCondition';
      conditionId: string;
      /** Player-sync condition name; suppressing it hides the player's copy. */
      conditionName?: string;
      /** The player's current condition names; stale suppressions are pruned. */
      playerConditionNames?: string[];
    }
  | { kind: 'setConditionRounds'; conditionId: string; rounds: number | null }
  | { kind: 'setReaction'; available: boolean };

export type TableCombatCommandV1 =
  | {
      type: 'combat.createRun';
      sceneId: string;
      runId: string;
      label: string;
      at: string;
    }
  | { type: 'combat.selectRun'; runId: string | null; at: string }
  | {
      type: 'combat.setParticipants';
      runId: string;
      actorIds: string[];
      /** UI default for newly added participants (bound tokens all DM-only). */
      hiddenActorIds?: string[];
      at: string;
    }
  | {
      type: 'combat.setInitiative';
      runId: string;
      actorId: string;
      value: number | null;
      at: string;
    }
  | {
      type: 'combat.setHidden';
      runId: string;
      actorId: string;
      hidden: boolean;
      at: string;
    }
  | {
      type:
        | 'combat.start'
        | 'combat.end'
        | 'combat.nextTurn'
        | 'combat.prevTurn';
      runId: string;
      at: string;
    }
  | {
      type: 'combat.applyStat';
      runId: string;
      actorId: string;
      change: TableCombatStatChange;
      at: string;
    }
  | {
      type: 'combat.pruneSuppressions';
      actorId: string;
      playerConditionNames: string[];
      at: string;
    }
  | {
      type: 'combat.acknowledgePublication';
      targets: Array<{
        runId: string;
        combatGeneration: number;
        intent: 'publish' | 'end';
      }>;
      at: string;
    }
  | { type: 'combat.deleteArchive'; archiveId: string; at: string };

export type TableCombatRejectionReason =
  | 'invalid-command'
  | 'invalid-reference'
  | 'active-run'
  | 'run-active'
  | 'not-active'
  | 'imported-active'
  | 'missing-initiative'
  | 'initiative-required'
  | 'no-participants'
  | 'participant-limit'
  | 'member-removed'
  | 'read-only'
  | 'archive-capacity'
  | 'archive-active';

export interface TableCombatRejection {
  status: 'rejected';
  reason: TableCombatRejectionReason;
  detail?: string;
  /** missing-initiative: participants still lacking a value. */
  actorIds?: string[];
  /** active-run: the run currently holding the campaign pointer. */
  runId?: string;
}

export type TableCombatResult =
  | TableCommitResult
  | TableCombatRejection
  | { status: 'unchanged'; revision: number };

export type TableCombatPlan =
  | { status: 'planned'; mutation: TableWorkspaceMutation }
  | { status: 'unchanged' }
  | TableCombatRejection;

export function combatArchiveId(runId: string, combatGeneration: number) {
  return `${runId}:${combatGeneration}`;
}

/** An adopted run still carrying a legacy `isActive` it does not own here. */
export function isImportedActive(
  run: TableEncounterRecordV1,
  campaign: Pick<TableCampaignRecordV1, 'activeRunId'> | null
): boolean {
  return run.isActive && (campaign?.activeRunId ?? null) !== run.runId;
}

/** Participant actor ids in initiative order (existing deterministic sort). */
export function sortedParticipantIds(run: TableEncounterRecordV1): string[] {
  const entities = run.participants.map(
    participant =>
      ({
        id: participant.actorId,
        type: 'npc',
        initiative: participant.initiative,
      }) as EncounterEntity
  );
  return getSortedEntities(entities).map(entity => entity.id);
}

const COMBAT_TYPES = new Set([
  'combat.createRun',
  'combat.selectRun',
  'combat.setParticipants',
  'combat.setInitiative',
  'combat.setHidden',
  'combat.start',
  'combat.end',
  'combat.nextTurn',
  'combat.prevTurn',
  'combat.applyStat',
  'combat.pruneSuppressions',
  'combat.acknowledgePublication',
  'combat.deleteArchive',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateCombatCommand(command: unknown): boolean {
  if (!isRecord(command) || !COMBAT_TYPES.has(String(command.type)))
    return false;
  if (typeof command.at !== 'string' || Number.isNaN(Date.parse(command.at)))
    return false;
  try {
    canonicalJson(command);
  } catch {
    return false;
  }
  const ids = Object.entries(command).filter(([key]) => key.endsWith('Id'));
  return ids.every(
    ([key, id]) =>
      (key === 'runId' && command.type === 'combat.selectRun' && id === null) ||
      (typeof id === 'string' && id.length > 0)
  );
}

function rejected(
  reason: TableCombatRejectionReason,
  extra: Omit<TableCombatRejection, 'status' | 'reason'> = {}
): TableCombatRejection {
  return { status: 'rejected', reason, ...extra };
}

const RESET_TURN_RESOURCES = {
  reactionAvailable: true,
  legendaryActionsUsed: 0,
} as const;

interface Context {
  snapshot: TableWorkspaceSnapshotV1;
  campaign: Pick<TableCampaignRecordV1, 'activeRunId' | 'selectedRunId'>;
  runs: Map<string, TableEncounterRecordV1>;
  actors: Map<string, TableActorRecordV1>;
  logs: Map<string, TableLogRecordV1>;
  operationId: string;
}

function liveRun(context: Context, runId: string) {
  return context.snapshot.tombstones.some(
    tombstone => tombstone.kind === 'encounter' && tombstone.id === runId
  )
    ? undefined
    : context.runs.get(runId);
}

function sceneOf(
  context: Context,
  sceneId: string
): TableSceneRecordV1 | undefined {
  if (
    context.snapshot.tombstones.some(
      tombstone => tombstone.kind === 'scene' && tombstone.id === sceneId
    )
  )
    return undefined;
  return context.snapshot.scenes.find(scene => scene.sceneId === sceneId);
}

function memberOf(
  context: Context,
  run: TableEncounterRecordV1,
  actorId: string
): TableSceneMemberV1 | undefined {
  return sceneOf(context, run.sceneId)?.members.find(
    member => member.actorId === actorId
  );
}

function actorName(actor: TableActorRecordV1 | undefined, actorId: string) {
  if (actor?.liveStats) return actor.liveStats.name;
  const cached = actor?.cachedPlayerData?.name;
  return typeof cached === 'string' && cached.length > 0 ? cached : actorId;
}

/** Public, non-actor identity for log events (the scene member id). */
function eventEntityId(
  context: Context,
  run: TableEncounterRecordV1,
  actorId: string
): string {
  return memberOf(context, run, actorId)?.sceneMemberId ?? actorId;
}

class EventWriter {
  private readonly events: JsonObject[] = [];
  constructor(
    private readonly context: Context,
    private readonly run: TableEncounterRecordV1,
    private readonly at: string,
    private readonly round: number,
    private readonly turn: number
  ) {}

  add(type: string, fields: JsonObject): void {
    this.events.push({
      id: `${this.context.operationId}:${this.events.length}`,
      timestamp: this.at,
      round: this.round,
      turn: this.turn,
      encounterId: this.run.runId,
      type,
      ...fields,
    });
  }

  /**
   * Appends to the run's current archive. An append that would exceed the
   * per-archive cap is skipped and the archive is marked paused; combat
   * continues (D7). Missing archives (deleted history) are tolerated.
   */
  apply(mutation: TableWorkspaceMutation): void {
    if (this.events.length === 0) return;
    const archiveId = combatArchiveId(
      this.run.runId,
      this.run.combatGeneration ?? 0
    );
    const log = this.context.logs.get(archiveId);
    if (!log || log.loggingPaused) return;
    const appended: TableLogRecordV1 = {
      ...structuredClone(log),
      events: [...structuredClone(log.events), ...this.events],
    };
    const next: TableLogRecordV1 =
      serializedByteCount(appended) > TABLE_LIMITS.maxCombatArchiveBytes
        ? { ...structuredClone(log), loggingPaused: true }
        : appended;
    mutation.logs = { put: [...(mutation.logs?.put ?? []), next] };
  }

  closeArchive(mutation: TableWorkspaceMutation): void {
    const archiveId = combatArchiveId(
      this.run.runId,
      this.run.combatGeneration ?? 0
    );
    const log = this.context.logs.get(archiveId);
    if (!log) return;
    this.apply(mutation);
    const put = mutation.logs?.put.find(value => value.archiveId === archiveId);
    const base = put ?? structuredClone(log);
    mutation.logs = {
      put: [
        ...(mutation.logs?.put.filter(value => value.archiveId !== archiveId) ??
          []),
        { ...base, endedAt: this.at },
      ],
    };
  }
}

function withRun(
  mutation: TableWorkspaceMutation,
  run: TableEncounterRecordV1
): TableWorkspaceMutation {
  mutation.encounters = { put: [run] };
  return mutation;
}

function updatedParticipant(
  run: TableEncounterRecordV1,
  actorId: string,
  update: (participant: TableEncounterParticipantV1) => void
): TableEncounterRecordV1 {
  const next = structuredClone(run);
  const participant = next.participants.find(
    value => value.actorId === actorId
  );
  if (participant) update(participant);
  return next;
}

type ActorClass = 'editable' | 'player-reference' | 'adopted-pc';

function classify(context: Context, actor: TableActorRecordV1): ActorClass {
  if (actor.actorKind === 'player-reference') return 'player-reference';
  return isEditableActor(context.snapshot, actor) ? 'editable' : 'adopted-pc';
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Keeps suppressed names the player still has (C3-5) plus `extra`. */
function prunedSuppressions(
  current: string[],
  playerConditionNames: string[] | undefined,
  extra: string | null = null
): string[] {
  const keep =
    playerConditionNames === undefined
      ? current
      : current.filter(name => playerConditionNames.includes(name));
  return extra === null || keep.includes(extra) ? keep : [...keep, extra];
}

function planStart(
  context: Context,
  run: TableEncounterRecordV1,
  at: string
): TableCombatPlan {
  if (isImportedActive(run, context.campaign))
    return rejected('imported-active');
  if (run.isActive) return rejected('run-active');
  if (context.campaign.activeRunId !== null)
    return rejected('active-run', { runId: context.campaign.activeRunId });
  if (run.participants.length === 0) return rejected('no-participants');
  const missing = run.participants
    .filter(participant => participant.initiative === null)
    .map(participant => participant.actorId);
  if (missing.length > 0)
    return rejected('missing-initiative', { actorIds: missing });
  for (const participant of run.participants) {
    if (!context.actors.has(participant.actorId))
      return rejected('invalid-reference', { detail: 'actor-missing' });
    const member = memberOf(context, run, participant.actorId);
    if (!member?.sceneMemberId)
      return rejected('invalid-reference', { detail: 'member-missing' });
    if (member.removedAt !== undefined)
      return rejected('member-removed', { actorIds: [participant.actorId] });
  }
  const logTombstones = context.snapshot.tombstones.filter(
    tombstone => tombstone.kind === 'log'
  ).length;
  if (
    context.snapshot.logs.length + logTombstones + 1 >
    TABLE_LIMITS.maxCombatArchives
  )
    return rejected('archive-capacity', { detail: 'archive-count' });
  const combatGeneration = (run.combatGeneration ?? 0) + 1;
  const archiveId = combatArchiveId(run.runId, combatGeneration);
  if (context.logs.has(archiveId))
    return rejected('invalid-reference', { detail: 'archive-exists' });

  const order = sortedParticipantIds(run);
  const next: TableEncounterRecordV1 = {
    ...structuredClone(run),
    participants: run.participants.map(participant => ({
      ...structuredClone(participant),
      turnResources: {
        ...structuredClone(participant.turnResources),
        ...RESET_TURN_RESOURCES,
      },
    })),
    combatGeneration,
    isActive: true,
    round: 1,
    currentActorId: order[0] ?? null,
    publication: { intent: 'publish', combatGeneration, acknowledged: false },
    updatedAt: at,
  };
  const log: TableLogRecordV1 = {
    schemaVersion: 1,
    workspaceKey: run.workspaceKey,
    archiveId,
    runId: run.runId,
    sceneId: run.sceneId,
    combatGeneration,
    events: [
      {
        id: `${context.operationId}:0`,
        timestamp: at,
        round: 1,
        turn: 0,
        encounterId: run.runId,
        type: 'combat_start',
        participantNames: order.map(actorId =>
          actorName(context.actors.get(actorId), actorId)
        ),
      },
    ],
    startedAt: at,
    endedAt: null,
  };
  return {
    status: 'planned',
    mutation: {
      encounters: { put: [next] },
      logs: { put: [log] },
      campaign: { activeRunId: run.runId, selectedRunId: run.runId },
    },
  };
}

function planEnd(
  context: Context,
  run: TableEncounterRecordV1,
  at: string
): TableCombatPlan {
  const generation = run.combatGeneration ?? 0;
  if (isImportedActive(run, context.campaign)) {
    // Explicit "Reset imported state": only the legacy flag is cleared.
    if (context.logs.has(combatArchiveId(run.runId, generation)))
      return rejected('invalid-reference', { detail: 'imported-archive' });
    return {
      status: 'planned',
      mutation: withRun(
        {},
        { ...structuredClone(run), isActive: false, updatedAt: at }
      ),
    };
  }
  if (!run.isActive || context.campaign.activeRunId !== run.runId)
    return rejected('not-active');
  const order = sortedParticipantIds(run);
  const turn = Math.max(0, order.indexOf(run.currentActorId ?? ''));
  const mutation: TableWorkspaceMutation = {
    campaign: { activeRunId: null },
  };
  withRun(mutation, {
    ...structuredClone(run),
    isActive: false,
    publication: {
      intent: 'end',
      combatGeneration: generation,
      acknowledged: false,
    },
    updatedAt: at,
  });
  const writer = new EventWriter(context, run, at, run.round, turn);
  writer.add('combat_end', {
    participantNames: order.map(actorId =>
      actorName(context.actors.get(actorId), actorId)
    ),
    endReason: 'dm_ended',
  });
  writer.closeArchive(mutation);
  return { status: 'planned', mutation };
}

function requireActive(
  context: Context,
  run: TableEncounterRecordV1
): TableCombatRejection | null {
  if (isImportedActive(run, context.campaign))
    return rejected('imported-active');
  if (!run.isActive || context.campaign.activeRunId !== run.runId)
    return rejected('not-active');
  return null;
}

function turnStartActor(
  context: Context,
  actorId: string,
  at: string
): TableActorRecordV1 | null {
  const actor = context.actors.get(actorId);
  if (!actor) return null;
  const kind = classify(context, actor);
  const timed = (conditions: JsonObject[]) =>
    conditions.some(condition => typeof condition.rounds === 'number');
  if (
    kind === 'editable' &&
    actor.liveStats &&
    timed(actor.liveStats.conditions)
  ) {
    return {
      ...structuredClone(actor),
      liveStats: {
        ...structuredClone(actor.liveStats),
        conditions: decrementConditionRounds(
          structuredClone(actor.liveStats.conditions)
        ),
      },
      updatedAt: at,
    };
  }
  const overlay = actor.playerConditionOverlay;
  if (kind === 'player-reference' && overlay && timed(overlay.dmConditions)) {
    return {
      ...structuredClone(actor),
      playerConditionOverlay: {
        ...structuredClone(overlay),
        dmConditions: decrementConditionRounds(
          structuredClone(overlay.dmConditions)
        ),
      },
      updatedAt: at,
    };
  }
  // Adopted PCs are read-only: turn-start expiry never writes them (R2-2).
  return null;
}

function planTurn(
  context: Context,
  run: TableEncounterRecordV1,
  direction: 'next' | 'prev',
  at: string
): TableCombatPlan {
  const blocked = requireActive(context, run);
  if (blocked) return blocked;
  const order = sortedParticipantIds(run);
  if (order.length === 0) return rejected('no-participants');
  const index = order.indexOf(run.currentActorId ?? '');
  let incoming: number;
  let round = run.round;
  let newRound = false;
  if (direction === 'next') {
    if (index !== -1 && index + 1 >= order.length) {
      incoming = 0;
      round += 1;
      newRound = true;
    } else {
      incoming = index + 1;
    }
  } else if (index <= 0) {
    incoming = order.length - 1;
    if (index === 0) round = Math.max(1, round - 1);
  } else {
    incoming = index - 1;
  }
  const incomingId = order[incoming]!;
  const next = updatedParticipant(run, incomingId, participant => {
    participant.turnResources = {
      ...participant.turnResources,
      reactionAvailable: true,
      // prevTurn mirrors legacy: only the reaction resets when backing up.
      ...(direction === 'next' ? { legendaryActionsUsed: 0 } : {}),
    };
  });
  next.currentActorId = incomingId;
  next.round = round;
  next.updatedAt = at;
  const mutation = withRun({}, next);
  if (direction === 'next') {
    const actor = turnStartActor(context, incomingId, at);
    if (actor) mutation.actors = { put: [actor] };
  }
  const writer = new EventWriter(context, next, at, round, incoming);
  if (newRound) writer.add('round_start', { roundNumber: round });
  writer.add('turn_start', {
    entityId: eventEntityId(context, run, incomingId),
    entityName: actorName(context.actors.get(incomingId), incomingId),
  });
  writer.apply(mutation);
  return { status: 'planned', mutation };
}

function planStat(
  context: Context,
  run: TableEncounterRecordV1,
  actorId: string,
  change: TableCombatStatChange,
  at: string
): TableCombatPlan {
  const blocked = requireActive(context, run);
  if (blocked) return blocked;
  if (!run.participants.some(participant => participant.actorId === actorId))
    return rejected('invalid-reference', { detail: 'participant-missing' });
  const actor = context.actors.get(actorId);
  if (!actor) return rejected('invalid-reference', { detail: 'actor-missing' });
  const kind = classify(context, actor);
  const order = sortedParticipantIds(run);
  const turn = Math.max(0, order.indexOf(run.currentActorId ?? ''));
  const writer = new EventWriter(context, run, at, run.round, turn);
  const targetId = eventEntityId(context, run, actorId);
  const targetName = actorName(actor, actorId);
  const mutation: TableWorkspaceMutation = {};

  if (change.kind === 'setReaction') {
    // Participant turn data, editable for every participant (R8); the UI
    // shows the player's own sheet value for player-controlled rows.
    if (typeof change.available !== 'boolean')
      return rejected('invalid-command');
    const current = run.participants.find(p => p.actorId === actorId)!;
    if (current.turnResources.reactionAvailable === change.available)
      return { status: 'unchanged' };
    const next = updatedParticipant(run, actorId, participant => {
      participant.turnResources = {
        ...participant.turnResources,
        reactionAvailable: change.available,
      };
    });
    next.updatedAt = at;
    return { status: 'planned', mutation: withRun(mutation, next) };
  }

  if (kind === 'adopted-pc') return rejected('read-only');

  if (change.kind === 'addCondition') {
    if (
      !isRecord(change.condition) ||
      typeof change.condition.name !== 'string'
    )
      return rejected('invalid-command');
    const condition = {
      ...structuredClone(change.condition),
      id: `cond-${context.operationId}`,
    };
    const next = structuredClone(actor);
    if (kind === 'editable') {
      next.liveStats!.conditions.push(condition);
    } else {
      next.playerConditionOverlay!.dmConditions.push({
        ...condition,
        source: 'dm',
      });
    }
    next.updatedAt = at;
    mutation.actors = { put: [next] };
    writer.add('condition_applied', {
      targetId,
      targetName,
      conditionName: change.condition.name,
      sourceId: 'dm',
      sourceName: 'DM',
    });
    writer.apply(mutation);
    return { status: 'planned', mutation };
  }

  if (change.kind === 'removeCondition') {
    const next = structuredClone(actor);
    let removedName: string | null = null;
    if (kind === 'editable') {
      const found = next.liveStats!.conditions.find(
        condition => condition.id === change.conditionId
      );
      if (!found)
        return rejected('invalid-reference', { detail: 'condition-missing' });
      removedName = typeof found.name === 'string' ? found.name : null;
      next.liveStats!.conditions = next.liveStats!.conditions.filter(
        condition => condition.id !== change.conditionId
      );
    } else {
      const overlay = next.playerConditionOverlay!;
      const dm = overlay.dmConditions.find(
        condition => condition.id === change.conditionId
      );
      if (dm) {
        removedName = typeof dm.name === 'string' ? dm.name : null;
        overlay.dmConditions = overlay.dmConditions.filter(
          condition => condition.id !== change.conditionId
        );
        overlay.suppressedSourceConditionIds = prunedSuppressions(
          overlay.suppressedSourceConditionIds,
          change.playerConditionNames
        );
      } else if (change.conditionName) {
        // One intent, one command: suppressing the player's own condition
        // (legacy `updateEntity({suppressedConditions})` + remove).
        removedName = change.conditionName;
        overlay.suppressedSourceConditionIds = prunedSuppressions(
          overlay.suppressedSourceConditionIds,
          change.playerConditionNames,
          change.conditionName
        );
      } else {
        return rejected('invalid-reference', { detail: 'condition-missing' });
      }
    }
    next.updatedAt = at;
    mutation.actors = { put: [next] };
    if (removedName)
      writer.add('condition_removed', {
        targetId,
        targetName,
        conditionName: removedName,
      });
    writer.apply(mutation);
    return { status: 'planned', mutation };
  }

  if (change.kind === 'setConditionRounds') {
    if (
      change.rounds !== null &&
      (!Number.isSafeInteger(change.rounds) || change.rounds < 0)
    )
      return rejected('invalid-command');
    const next = structuredClone(actor);
    const list =
      kind === 'editable'
        ? next.liveStats!.conditions
        : next.playerConditionOverlay!.dmConditions;
    if (!list.some(condition => condition.id === change.conditionId))
      return rejected(kind === 'editable' ? 'invalid-reference' : 'read-only', {
        detail: 'condition-missing',
      });
    const updated =
      change.rounds === 0
        ? list.filter(condition => condition.id !== change.conditionId)
        : list.map(condition =>
            condition.id === change.conditionId
              ? { ...condition, rounds: change.rounds }
              : condition
          );
    if (kind === 'editable') next.liveStats!.conditions = updated;
    else next.playerConditionOverlay!.dmConditions = updated;
    next.updatedAt = at;
    mutation.actors = { put: [next] };
    return { status: 'planned', mutation };
  }

  // HP / AC / temp HP: editable actors only (one writer per actor).
  if (kind !== 'editable') return rejected('read-only');
  const value = change.value;
  if (!finite(value)) return rejected('invalid-command');
  const stats = structuredClone(actor.liveStats!);
  switch (change.kind) {
    case 'damage': {
      if (value <= 0) return rejected('invalid-command');
      const result = absorbDamage(stats.currentHp, stats.tempHp, value);
      stats.currentHp = result.currentHp;
      stats.tempHp = result.tempHp;
      writer.add('damage', {
        sourceId: 'dm',
        sourceName: 'DM',
        targetId,
        targetName,
        amount: value,
        damageType: 'untyped',
      });
      break;
    }
    case 'heal': {
      if (value <= 0) return rejected('invalid-command');
      const healed = healHp(stats.currentHp, stats.maxHp, value);
      writer.add('healing', {
        sourceId: 'dm',
        sourceName: 'DM',
        targetId,
        targetName,
        amount: value,
        actualHealing: healed - stats.currentHp,
      });
      stats.currentHp = healed;
      break;
    }
    case 'addTempHp':
      if (value < 0) return rejected('invalid-command');
      stats.tempHp = stackTempHp(stats.tempHp, value);
      break;
    case 'setTempHp':
      if (value < 0) return rejected('invalid-command');
      stats.tempHp = value;
      break;
    case 'setHp':
      stats.currentHp = clampHp(value, stats.maxHp);
      break;
    case 'setMaxHp':
      if (value <= 0) return rejected('invalid-command');
      stats.currentHp = clampHp(Math.min(stats.currentHp, value), value);
      stats.maxHp = value;
      break;
    case 'setArmorClass':
      if (value < 0) return rejected('invalid-command');
      stats.armorClass = value;
      break;
  }
  if (canonicalJson(stats) === canonicalJson(actor.liveStats))
    return { status: 'unchanged' };
  mutation.actors = {
    put: [{ ...structuredClone(actor), liveStats: stats, updatedAt: at }],
  };
  writer.apply(mutation);
  return { status: 'planned', mutation };
}

/** Plans one combat command against the snapshot at its expected revision. */
export function planCombatCommand(
  snapshot: TableWorkspaceSnapshotV1,
  command: TableCombatCommandV1,
  operationId: string
): TableCombatPlan {
  const context: Context = {
    snapshot,
    campaign: {
      activeRunId: snapshot.campaign?.activeRunId ?? null,
      selectedRunId: snapshot.campaign?.selectedRunId ?? null,
    },
    runs: new Map(snapshot.encounters.map(run => [run.runId, run])),
    actors: new Map(snapshot.actors.map(actor => [actor.actorId, actor])),
    logs: new Map(snapshot.logs.map(log => [log.archiveId, log])),
    operationId,
  };
  const at = command.at;

  switch (command.type) {
    case 'combat.createRun': {
      const scene = sceneOf(context, command.sceneId);
      if (!scene)
        return rejected('invalid-reference', { detail: 'scene-missing' });
      if (
        context.runs.has(command.runId) ||
        snapshot.tombstones.some(
          tombstone =>
            tombstone.kind === 'encounter' && tombstone.id === command.runId
        )
      )
        return rejected('invalid-command', { detail: 'run-exists' });
      if (!isRunLabel(command.label))
        return rejected('invalid-command', { detail: 'label' });
      const run: TableEncounterRecordV1 = {
        schemaVersion: 1,
        workspaceKey: scene.workspaceKey,
        runId: command.runId,
        sceneId: scene.sceneId,
        sourceEncounterId: null,
        runGeneration: command.runId,
        participants: [],
        round: 0,
        currentActorId: null,
        isActive: false,
        createdAt: at,
        updatedAt: at,
        label: command.label,
      };
      return {
        status: 'planned',
        mutation: {
          encounters: { put: [run] },
          campaign: { selectedRunId: run.runId },
        },
      };
    }
    case 'combat.selectRun': {
      // Exempt from imported-active: the selector must reach the reset (C3-9).
      if (command.runId !== null && !liveRun(context, command.runId))
        return rejected('invalid-reference', { detail: 'run-missing' });
      if (context.campaign.selectedRunId === command.runId)
        return { status: 'unchanged' };
      return {
        status: 'planned',
        mutation: { campaign: { selectedRunId: command.runId } },
      };
    }
    case 'combat.acknowledgePublication': {
      if (!Array.isArray(command.targets) || command.targets.length === 0)
        return rejected('invalid-command');
      const updated: TableEncounterRecordV1[] = [];
      for (const target of command.targets) {
        const run = liveRun(context, target.runId);
        const publication = run?.publication;
        if (
          !run ||
          !publication ||
          publication.acknowledged ||
          publication.intent !== target.intent ||
          publication.combatGeneration !== target.combatGeneration ||
          updated.some(value => value.runId === run.runId)
        )
          continue;
        updated.push({
          ...structuredClone(run),
          publication: { ...publication, acknowledged: true },
        });
      }
      if (updated.length === 0) return { status: 'unchanged' };
      return { status: 'planned', mutation: { encounters: { put: updated } } };
    }
    case 'combat.deleteArchive': {
      const log = context.logs.get(command.archiveId);
      if (!log)
        return rejected('invalid-reference', { detail: 'archive-missing' });
      const run = context.runs.get(log.runId);
      if (
        run &&
        run.isActive &&
        log.endedAt === null &&
        log.archiveId === combatArchiveId(run.runId, run.combatGeneration ?? 0)
      )
        return rejected('archive-active');
      // A1: local-only history leaves no tombstone so deletion frees capacity.
      return {
        status: 'planned',
        mutation: { logs: { put: [], delete: [command.archiveId] } },
      };
    }
    case 'combat.pruneSuppressions': {
      const actor = context.actors.get(command.actorId);
      if (!actor?.playerConditionOverlay)
        return rejected('invalid-reference', { detail: 'actor-missing' });
      if (!Array.isArray(command.playerConditionNames))
        return rejected('invalid-command');
      const overlay = actor.playerConditionOverlay;
      const pruned = prunedSuppressions(
        overlay.suppressedSourceConditionIds,
        command.playerConditionNames
      );
      if (pruned.length === overlay.suppressedSourceConditionIds.length)
        return { status: 'unchanged' };
      return {
        status: 'planned',
        mutation: {
          actors: {
            put: [
              {
                ...structuredClone(actor),
                playerConditionOverlay: {
                  ...structuredClone(overlay),
                  suppressedSourceConditionIds: pruned,
                },
                updatedAt: at,
              },
            ],
          },
        },
      };
    }
    default:
      break;
  }

  const run = liveRun(context, command.runId);
  if (!run) return rejected('invalid-reference', { detail: 'run-missing' });

  switch (command.type) {
    case 'combat.start':
      return planStart(context, run, at);
    case 'combat.end':
      return planEnd(context, run, at);
    case 'combat.nextTurn':
      return planTurn(context, run, 'next', at);
    case 'combat.prevTurn':
      return planTurn(context, run, 'prev', at);
    case 'combat.applyStat':
      return planStat(context, run, command.actorId, command.change, at);
    default:
      break;
  }

  if (isImportedActive(run, context.campaign))
    return rejected('imported-active');

  switch (command.type) {
    case 'combat.setParticipants': {
      if (run.isActive) return rejected('run-active');
      if (!Array.isArray(command.actorIds)) return rejected('invalid-command');
      if (command.actorIds.length > MAX_RUN_PARTICIPANTS)
        return rejected('participant-limit');
      if (new Set(command.actorIds).size !== command.actorIds.length)
        return rejected('invalid-command', { detail: 'duplicate-actor' });
      const hidden = new Set(command.hiddenActorIds ?? []);
      const previous = new Map(
        run.participants.map(participant => [participant.actorId, participant])
      );
      const participants: TableEncounterParticipantV1[] = [];
      for (const actorId of command.actorIds) {
        const member = memberOf(context, run, actorId);
        if (!member || !member.sceneMemberId || !context.actors.has(actorId))
          return rejected('invalid-reference', { detail: 'member-missing' });
        if (member.removedAt !== undefined)
          return rejected('member-removed', { actorIds: [actorId] });
        const kept = previous.get(actorId);
        participants.push(
          kept
            ? structuredClone(kept)
            : {
                actorId,
                initiative: null,
                turnResources: { ...RESET_TURN_RESOURCES },
                ...(hidden.has(actorId) ? { hidden: true as const } : {}),
              }
        );
      }
      if (canonicalJson(participants) === canonicalJson(run.participants))
        return { status: 'unchanged' };
      const next: TableEncounterRecordV1 = {
        ...structuredClone(run),
        participants,
        currentActorId: command.actorIds.includes(run.currentActorId ?? '')
          ? run.currentActorId
          : null,
        updatedAt: at,
      };
      return { status: 'planned', mutation: withRun({}, next) };
    }
    case 'combat.setInitiative': {
      const current = run.participants.find(
        participant => participant.actorId === command.actorId
      );
      if (!current)
        return rejected('invalid-reference', { detail: 'participant-missing' });
      if (command.value !== null && !finite(command.value))
        return rejected('invalid-command');
      if (run.isActive && command.value === null)
        return rejected('initiative-required');
      if (current.initiative === command.value) return { status: 'unchanged' };
      const next = updatedParticipant(run, command.actorId, participant => {
        participant.initiative = command.value;
      });
      next.updatedAt = at;
      return { status: 'planned', mutation: withRun({}, next) };
    }
    case 'combat.setHidden': {
      const current = run.participants.find(
        participant => participant.actorId === command.actorId
      );
      if (!current)
        return rejected('invalid-reference', { detail: 'participant-missing' });
      if ((current.hidden === true) === command.hidden)
        return { status: 'unchanged' };
      const next = updatedParticipant(run, command.actorId, participant => {
        if (command.hidden) participant.hidden = true;
        else delete participant.hidden;
      });
      next.updatedAt = at;
      return { status: 'planned', mutation: withRun({}, next) };
    }
  }
  return rejected('invalid-command');
}

/**
 * The one combat command path: plan on the expected snapshot, then a single
 * CAS'd IndexedDB transaction. Success is reported only after commit; a
 * stale or retried command is answered by replay, digest mismatch or
 * conflict, never re-planned.
 */
export async function runCombatCommand(
  repository: TableRepository,
  options: {
    expectedRevision: number;
    operationId: string;
    command: TableCombatCommandV1;
  }
): Promise<TableCombatResult> {
  const { command, expectedRevision, operationId } = options;
  if (!validateCombatCommand(command)) {
    return rejected('invalid-command', { detail: 'malformed' });
  }
  const current = repository.getCurrent();
  if (current?.status === 'read-only') {
    return { status: 'rejected', reason: 'unknown-schema' };
  }
  const snapshot = current?.status === 'ready' ? current.snapshot : null;
  const actualRevision = snapshot?.campaign?.revision ?? 0;
  if (!snapshot || actualRevision !== expectedRevision) {
    return repository.mutateWorkspace(
      expectedRevision,
      operationId,
      {},
      { digestSource: command }
    );
  }
  const plan = planCombatCommand(snapshot, command, operationId);
  if (plan.status === 'rejected') return plan;
  if (plan.status === 'unchanged') {
    return { status: 'unchanged', revision: actualRevision };
  }
  const result = await repository.mutateWorkspace(
    expectedRevision,
    operationId,
    plan.mutation,
    { digestSource: command }
  );
  if (
    command.type === 'combat.start' &&
    result.status === 'rejected' &&
    result.reason === 'limit-exceeded' &&
    (result.detail === 'archive-count' || result.detail === 'workspace-bytes')
  ) {
    return rejected('archive-capacity', { detail: result.detail });
  }
  return result;
}
