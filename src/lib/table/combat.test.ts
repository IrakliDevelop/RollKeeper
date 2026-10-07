import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';

import {
  combatArchiveId,
  runCombatCommand,
  type TableCombatCommandV1,
  type TableCombatResult,
} from './combat';
import {
  ADOPTED_PC,
  AT,
  IMPORTED_RUN,
  SCENE_ID,
  openFixture,
  readySnapshot,
  repositories,
  revisionOf,
} from './combat.fixture';
import { runRosterCommand } from './roster';
import type { TableRepository } from './repository';
import { TABLE_LIMITS, canonicalJson, type JsonObject } from './schema';

afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

let counter = 0;
function op(prefix = 'op'): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

async function run(
  repository: TableRepository,
  command: TableCombatCommandV1,
  operationId = op(),
  expectedRevision = revisionOf(repository)
): Promise<TableCombatResult> {
  return runCombatCommand(repository, {
    expectedRevision,
    operationId,
    command,
  });
}

async function committed(
  repository: TableRepository,
  command: TableCombatCommandV1,
  operationId = op()
) {
  const result = await run(repository, command, operationId);
  if (result.status !== 'committed') {
    throw new Error(`${command.type}: ${JSON.stringify(result)}`);
  }
  return { ...result, operationId };
}

function runRecord(repository: TableRepository, runId: string) {
  const record = readySnapshot(repository).encounters.find(
    value => value.runId === runId
  );
  if (!record) throw new Error(`missing run ${runId}`);
  return record;
}

function actorRecord(repository: TableRepository, actorId: string) {
  return readySnapshot(repository).actors.find(
    value => value.actorId === actorId
  )!;
}

async function prepared(
  repository: TableRepository,
  runId: string,
  actorIds: string[],
  initiatives: Array<number | null>
) {
  await committed(repository, {
    type: 'combat.createRun',
    sceneId: SCENE_ID,
    runId,
    label: `Run ${runId}`,
    at: AT,
  });
  if (actorIds.length > 0)
    await committed(repository, {
      type: 'combat.setParticipants',
      runId,
      actorIds,
      at: AT,
    });
  for (const [index, actorId] of actorIds.entries()) {
    const value = initiatives[index] ?? null;
    if (value === null) continue;
    await committed(repository, {
      type: 'combat.setInitiative',
      runId,
      actorId,
      value,
      at: AT,
    });
  }
}

async function started(
  repository: TableRepository,
  runId = 'run-a',
  actorIds = ['goblin', 'knight', 'aria'],
  initiatives: Array<number | null> = [12, 0, 18]
) {
  await prepared(repository, runId, actorIds, initiatives);
  return committed(repository, { type: 'combat.start', runId, at: AT });
}

describe('combat run preparation', () => {
  it('creates a labelled inactive run and selects it', async () => {
    const repository = await openFixture();
    await committed(repository, {
      type: 'combat.createRun',
      sceneId: SCENE_ID,
      runId: 'run-a',
      label: 'Ambush',
      at: AT,
    });
    expect(runRecord(repository, 'run-a')).toMatchObject({
      label: 'Ambush',
      sceneId: SCENE_ID,
      participants: [],
      isActive: false,
      round: 0,
      currentActorId: null,
    });
    expect(readySnapshot(repository).campaign?.selectedRunId).toBe('run-a');
  });

  it('keeps participant insertion order, retained initiatives and hidden defaults', async () => {
    const repository = await openFixture();
    await prepared(repository, 'run-a', ['goblin', 'orc'], [7, 3]);
    await committed(repository, {
      type: 'combat.setParticipants',
      runId: 'run-a',
      actorIds: ['knight', 'goblin', 'aria'],
      hiddenActorIds: ['knight'],
      at: AT,
    });
    const record = runRecord(repository, 'run-a');
    expect(record.participants.map(value => value.actorId)).toEqual([
      'knight',
      'goblin',
      'aria',
    ]);
    expect(record.participants.map(value => value.initiative)).toEqual([
      null,
      7,
      null,
    ]);
    expect(record.participants[0]).toMatchObject({ hidden: true });
    expect(record.participants[1]).not.toHaveProperty('hidden');
  });

  it('rejects removed members, non-members and more than 256 participants', async () => {
    const repository = await openFixture();
    await prepared(repository, 'run-a', [], []);
    await expect(
      run(repository, {
        type: 'combat.setParticipants',
        runId: 'run-a',
        actorIds: ['ghost'],
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'rejected', reason: 'member-removed' });
    await expect(
      run(repository, {
        type: 'combat.setParticipants',
        runId: 'run-a',
        actorIds: ['stranger'],
        at: AT,
      })
    ).resolves.toMatchObject({
      status: 'rejected',
      reason: 'invalid-reference',
      detail: 'member-missing',
    });
    await expect(
      run(repository, {
        type: 'combat.setParticipants',
        runId: 'run-a',
        actorIds: Array.from({ length: 257 }, (_, i) => `actor-${i}`),
        at: AT,
      })
    ).resolves.toMatchObject({
      status: 'rejected',
      reason: 'participant-limit',
    });
  });

  it('clears currentActorId when that participant is dropped', async () => {
    const repository = await openFixture();
    await started(repository, 'run-a', ['goblin', 'orc'], [9, 4]);
    await committed(repository, {
      type: 'combat.end',
      runId: 'run-a',
      at: AT,
    });
    expect(runRecord(repository, 'run-a').currentActorId).toBe('goblin');
    await committed(repository, {
      type: 'combat.setParticipants',
      runId: 'run-a',
      actorIds: ['orc'],
      at: AT,
    });
    expect(runRecord(repository, 'run-a').currentActorId).toBeNull();
  });
});

describe('combat.start (D4, S2)', () => {
  it('rejects a null initiative but accepts 0', async () => {
    const repository = await openFixture();
    await prepared(repository, 'run-a', ['goblin', 'knight'], [5, null]);
    const missing = await run(repository, {
      type: 'combat.start',
      runId: 'run-a',
      at: AT,
    });
    expect(missing).toMatchObject({
      status: 'rejected',
      reason: 'missing-initiative',
      actorIds: ['knight'],
    });
    await committed(repository, {
      type: 'combat.setInitiative',
      runId: 'run-a',
      actorId: 'knight',
      value: 0,
      at: AT,
    });
    await committed(repository, {
      type: 'combat.start',
      runId: 'run-a',
      at: AT,
    });
    expect(runRecord(repository, 'run-a').isActive).toBe(true);
  });

  it('writes generation, round, first actor, resets, pointers, archive and intent atomically', async () => {
    const repository = await openFixture();
    await prepared(
      repository,
      'run-a',
      ['goblin', 'knight', 'orc'],
      [7, 7, 20]
    );
    const result = await committed(repository, {
      type: 'combat.start',
      runId: 'run-a',
      at: AT,
    });
    const record = runRecord(repository, 'run-a');
    expect(record).toMatchObject({
      isActive: true,
      round: 1,
      combatGeneration: 1,
      currentActorId: 'orc',
      publication: {
        intent: 'publish',
        combatGeneration: 1,
        acknowledged: false,
      },
    });
    expect(
      record.participants.every(
        value =>
          value.turnResources.reactionAvailable &&
          value.turnResources.legendaryActionsUsed === 0
      )
    ).toBe(true);
    const snapshot = readySnapshot(repository);
    expect(snapshot.campaign).toMatchObject({
      activeRunId: 'run-a',
      selectedRunId: 'run-a',
    });
    expect(combatArchiveId('run-a', 1)).toBe('run-a:1');
    expect(result.result.archiveIds).toEqual(['run-a:1']);
    const log = snapshot.logs.find(value => value.archiveId === 'run-a:1');
    expect(log).toMatchObject({
      runId: 'run-a',
      sceneId: SCENE_ID,
      combatGeneration: 1,
      startedAt: AT,
      endedAt: null,
    });
    expect(log?.events).toHaveLength(1);
    expect(log?.events[0]).toMatchObject({ type: 'combat_start', round: 1 });
  });

  it('orders equal initiatives deterministically by participant order', async () => {
    const repository = await openFixture();
    await prepared(repository, 'run-a', ['knight', 'goblin'], [10, 10]);
    await committed(repository, {
      type: 'combat.start',
      runId: 'run-a',
      at: AT,
    });
    expect(runRecord(repository, 'run-a').currentActorId).toBe('knight');
  });

  it('replays the same operation with the same archive, generation and round', async () => {
    const repository = await openFixture();
    await prepared(repository, 'run-a', ['goblin'], [3]);
    const revision = revisionOf(repository);
    const first = await run(
      repository,
      { type: 'combat.start', runId: 'run-a', at: AT },
      'start-once',
      revision
    );
    const replay = await run(
      repository,
      { type: 'combat.start', runId: 'run-a', at: AT },
      'start-once',
      revision
    );
    expect(replay).toEqual(first);
    expect(revisionOf(repository)).toBe(revision + 1);
    expect(runRecord(repository, 'run-a').combatGeneration).toBe(1);
    expect(
      readySnapshot(repository).logs.filter(value => value.runId === 'run-a')
    ).toHaveLength(1);
  });

  it('lets one of two different starts win; the loser conflicts, then sees active-run after refresh', async () => {
    const factory = new IDBFactory();
    const left = await openFixture({ factory });
    await prepared(left, 'run-a', ['goblin'], [3]);
    await prepared(left, 'run-b', ['orc'], [4]);
    const right = await openFixture({ factory, seed: false });
    await right.reload();
    const revision = revisionOf(left);
    expect(revisionOf(right)).toBe(revision);
    const [a, b] = await Promise.all([
      run(
        left,
        { type: 'combat.start', runId: 'run-a', at: AT },
        'start-a',
        revision
      ),
      run(
        right,
        { type: 'combat.start', runId: 'run-b', at: AT },
        'start-b',
        revision
      ),
    ]);
    expect([a.status, b.status].sort()).toEqual(['committed', 'conflict']);
    const loser = a.status === 'conflict' ? left : right;
    const loserRun = a.status === 'conflict' ? 'run-a' : 'run-b';
    const winnerRun = loserRun === 'run-a' ? 'run-b' : 'run-a';
    await loser.reload();
    await expect(
      run(
        loser,
        { type: 'combat.start', runId: loserRun, at: AT },
        'start-retry'
      )
    ).resolves.toMatchObject({
      status: 'rejected',
      reason: 'active-run',
      runId: winnerRun,
    });
  });

  it('blocks a second run while one is active and preserves all prior state', async () => {
    const repository = await openFixture();
    await started(repository, 'run-a', ['goblin'], [3]);
    await prepared(repository, 'run-b', ['orc'], [9]);
    const before = canonicalJson(readySnapshot(repository));
    const result = await run(repository, {
      type: 'combat.start',
      runId: 'run-b',
      at: AT,
    });
    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'active-run',
      runId: 'run-a',
    });
    await repository.reload();
    expect(canonicalJson(readySnapshot(repository))).toBe(before);
  });

  it.each(['quota', 'abort'])(
    'leaves run, log and campaign unchanged on %s during start, and recovers committed state on reload',
    async mode => {
      const factory = new IDBFactory();
      let failNext = false;
      const repository = await openFixture({
        factory,
        beforeTransactionCommit: ({ transaction }) => {
          if (!failNext) return;
          failNext = false;
          transaction.abort();
          if (mode === 'quota')
            throw new DOMException('quota exhausted', 'QuotaExceededError');
        },
      });
      await prepared(repository, 'run-a', ['goblin'], [3]);
      const before = canonicalJson(readySnapshot(repository));
      failNext = true;
      const failed = await run(repository, {
        type: 'combat.start',
        runId: 'run-a',
        at: AT,
      });
      expect(failed).toMatchObject({
        status: 'failed',
        reason: mode === 'quota' ? 'quota-exceeded' : 'transaction-failed',
      });
      await repository.reload();
      expect(canonicalJson(readySnapshot(repository))).toBe(before);

      await committed(repository, {
        type: 'combat.start',
        runId: 'run-a',
        at: AT,
      });
      const fresh = await openFixture({ factory, seed: false });
      const reloaded = readySnapshot(fresh);
      expect(reloaded.campaign?.activeRunId).toBe('run-a');
      expect(
        reloaded.encounters.find(value => value.runId === 'run-a')
      ).toMatchObject({
        isActive: true,
        publication: { intent: 'publish', acknowledged: false },
      });
      expect(reloaded.logs.map(value => value.archiveId)).toContain('run-a:1');
    }
  );
});

describe('combat.end (D4)', () => {
  it('closes the same archive and keeps stats, members and the scene byte-identical', async () => {
    const repository = await openFixture();
    await started(repository, 'run-a', ['goblin', 'orc'], [5, 2]);
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'damage', value: 4 },
      at: AT,
    });
    const snapshot = readySnapshot(repository);
    const actorsBefore = canonicalJson(snapshot.actors);
    const scenesBefore = canonicalJson(snapshot.scenes);
    await committed(repository, { type: 'combat.end', runId: 'run-a', at: AT });
    const after = readySnapshot(repository);
    expect(canonicalJson(after.actors)).toBe(actorsBefore);
    expect(canonicalJson(after.scenes)).toBe(scenesBefore);
    expect(after.campaign?.activeRunId).toBeNull();
    expect(runRecord(repository, 'run-a')).toMatchObject({
      isActive: false,
      round: 1,
      currentActorId: 'goblin',
      publication: { intent: 'end', combatGeneration: 1, acknowledged: false },
    });
    const log = after.logs.find(value => value.archiveId === 'run-a:1')!;
    expect(log.endedAt).toBe(AT);
    expect(log.events.at(-1)).toMatchObject({ type: 'combat_end' });
  });

  it('starts generation 2 into a new archive and preserves the first', async () => {
    const repository = await openFixture();
    await started(repository, 'run-a', ['goblin'], [5]);
    await committed(repository, { type: 'combat.end', runId: 'run-a', at: AT });
    const firstLog = canonicalJson(
      readySnapshot(repository).logs.find(
        value => value.archiveId === 'run-a:1'
      )
    );
    await committed(repository, {
      type: 'combat.start',
      runId: 'run-a',
      at: AT,
    });
    expect(runRecord(repository, 'run-a').combatGeneration).toBe(2);
    const logs = readySnapshot(repository).logs;
    expect(logs.map(value => value.archiveId)).toEqual(
      expect.arrayContaining(['run-a:1', 'run-a:2'])
    );
    expect(
      canonicalJson(logs.find(value => value.archiveId === 'run-a:1'))
    ).toBe(firstLog);
  });

  it('resets an imported legacy-active run without archive or publication intent', async () => {
    const repository = await openFixture();
    for (const type of [
      'combat.start',
      'combat.nextTurn',
      'combat.prevTurn',
    ] as const) {
      await expect(
        run(repository, { type, runId: IMPORTED_RUN, at: AT })
      ).resolves.toMatchObject({
        status: 'rejected',
        reason: 'imported-active',
      });
    }
    await expect(
      run(repository, {
        type: 'combat.setHidden',
        runId: IMPORTED_RUN,
        actorId: ADOPTED_PC,
        hidden: true,
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'rejected', reason: 'imported-active' });
    await committed(repository, {
      type: 'combat.selectRun',
      runId: IMPORTED_RUN,
      at: AT,
    });
    const logsBefore = readySnapshot(repository).logs.length;
    await committed(repository, {
      type: 'combat.end',
      runId: IMPORTED_RUN,
      at: AT,
    });
    const record = runRecord(repository, IMPORTED_RUN);
    expect(record.isActive).toBe(false);
    expect(record).not.toHaveProperty('publication');
    expect(readySnapshot(repository).logs).toHaveLength(logsBefore);
    expect(readySnapshot(repository).campaign?.activeRunId).toBeNull();
  });
});

describe('turns (D5)', () => {
  it('wraps next turn into a new round, logs it and applies turn-start resets', async () => {
    const repository = await openFixture();
    await started(repository, 'run-a', ['goblin', 'aria'], [20, 10]);
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'setReaction', available: false },
      at: AT,
    });
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: {
        kind: 'addCondition',
        condition: { name: 'Blessed', rounds: 1, source: 'dm' },
      },
      at: AT,
    });
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'aria',
      change: {
        kind: 'addCondition',
        condition: { name: 'Hexed', rounds: 2, source: 'dm' },
      },
      at: AT,
    });
    await committed(repository, {
      type: 'combat.nextTurn',
      runId: 'run-a',
      at: AT,
    });
    expect(runRecord(repository, 'run-a')).toMatchObject({
      round: 1,
      currentActorId: 'aria',
    });
    expect(
      actorRecord(repository, 'aria').playerConditionOverlay?.dmConditions
    ).toEqual([expect.objectContaining({ name: 'Hexed', rounds: 1 })]);
    const nextRound = await committed(repository, {
      type: 'combat.nextTurn',
      runId: 'run-a',
      at: AT,
    });
    const record = runRecord(repository, 'run-a');
    expect(record).toMatchObject({ round: 2, currentActorId: 'goblin' });
    expect(record.participants[0]?.turnResources.reactionAvailable).toBe(true);
    expect(actorRecord(repository, 'goblin').liveStats?.conditions).toEqual([]);
    const log = readySnapshot(repository).logs.find(
      value => value.archiveId === 'run-a:1'
    )!;
    expect(log.events.slice(-2)).toEqual([
      expect.objectContaining({
        type: 'round_start',
        roundNumber: 2,
        id: `${nextRound.operationId}:0`,
      }),
      expect.objectContaining({
        type: 'turn_start',
        entityId: 'm-goblin',
        entityName: 'Goblin',
      }),
    ]);
  });

  it('never writes turn-start expiry onto an adopted PC', async () => {
    const repository = await openFixture();
    // Make the adopted PC's stats carry a timed condition, as adoption copies them.
    const key = repository.workspaceIdentity;
    const pc = actorRecord(repository, ADOPTED_PC);
    await repository.mutateWorkspace(revisionOf(repository), 'pc-cond', {
      actors: {
        put: [
          {
            ...structuredClone(pc),
            workspaceKey: key,
            liveStats: {
              ...pc.liveStats!,
              conditions: [{ id: 'c', name: 'Stunned', rounds: 1 }],
            },
          },
        ],
      },
    });
    const before = canonicalJson(actorRecord(repository, ADOPTED_PC));
    await started(repository, 'run-a', ['goblin', ADOPTED_PC], [20, 10]);
    await committed(repository, {
      type: 'combat.nextTurn',
      runId: 'run-a',
      at: AT,
    });
    expect(runRecord(repository, 'run-a').currentActorId).toBe(ADOPTED_PC);
    expect(canonicalJson(actorRecord(repository, ADOPTED_PC))).toBe(before);
  });

  it('mirrors legacy prevTurn: wraps back without dropping below round 1', async () => {
    const repository = await openFixture();
    await started(repository, 'run-a', ['goblin', 'orc'], [20, 10]);
    await committed(repository, {
      type: 'combat.prevTurn',
      runId: 'run-a',
      at: AT,
    });
    expect(runRecord(repository, 'run-a')).toMatchObject({
      round: 1,
      currentActorId: 'orc',
    });
    await committed(repository, {
      type: 'combat.prevTurn',
      runId: 'run-a',
      at: AT,
    });
    expect(runRecord(repository, 'run-a')).toMatchObject({
      round: 1,
      currentActorId: 'goblin',
    });
  });

  it('keeps currentActorId when initiative order changes mid-fight; null is refused while active', async () => {
    const repository = await openFixture();
    await started(repository, 'run-a', ['goblin', 'orc'], [20, 10]);
    await committed(repository, {
      type: 'combat.setInitiative',
      runId: 'run-a',
      actorId: 'orc',
      value: 25,
      at: AT,
    });
    expect(runRecord(repository, 'run-a').currentActorId).toBe('goblin');
    await committed(repository, {
      type: 'combat.nextTurn',
      runId: 'run-a',
      at: AT,
    });
    // goblin (20) → next in sorted [orc 25, goblin 20] wraps to orc, round 2.
    expect(runRecord(repository, 'run-a')).toMatchObject({
      currentActorId: 'orc',
      round: 2,
    });
    await expect(
      run(repository, {
        type: 'combat.setInitiative',
        runId: 'run-a',
        actorId: 'orc',
        value: null,
        at: AT,
      })
    ).resolves.toMatchObject({
      status: 'rejected',
      reason: 'initiative-required',
    });
  });

  it('keeps a removed member as a participant mid-fight', async () => {
    const repository = await openFixture();
    await started(repository, 'run-a', ['goblin', 'orc'], [20, 10]);
    const removed = await runRosterCommand(repository, {
      expectedRevision: revisionOf(repository),
      operationId: op('remove'),
      command: {
        type: 'roster.removeMember',
        sceneId: SCENE_ID,
        sceneMemberId: 'm-orc',
        at: AT,
      },
    });
    expect(removed.status).toBe('committed');
    await committed(repository, {
      type: 'combat.nextTurn',
      runId: 'run-a',
      at: AT,
    });
    expect(runRecord(repository, 'run-a')).toMatchObject({
      currentActorId: 'orc',
    });
    expect(
      runRecord(repository, 'run-a').participants.map(value => value.actorId)
    ).toEqual(['goblin', 'orc']);
  });

  it('requires an active run owned by the campaign pointer for turn and stat commands', async () => {
    const repository = await openFixture();
    await prepared(repository, 'run-a', ['goblin'], [3]);
    for (const command of [
      { type: 'combat.nextTurn', runId: 'run-a', at: AT },
      { type: 'combat.prevTurn', runId: 'run-a', at: AT },
      {
        type: 'combat.applyStat',
        runId: 'run-a',
        actorId: 'goblin',
        change: { kind: 'damage', value: 1 },
        at: AT,
      },
    ] as TableCombatCommandV1[]) {
      await expect(run(repository, command)).resolves.toMatchObject({
        status: 'rejected',
        reason: 'not-active',
      });
    }
  });
});

describe('stats (D6, R2-2, C3-2, C3-5)', () => {
  it('updates an editable actor atomically with a log event', async () => {
    const repository = await openFixture();
    await started(repository, 'run-a', ['goblin', 'orc'], [20, 10]);
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'addTempHp', value: 3 },
      at: AT,
    });
    await expect(
      run(repository, {
        type: 'combat.applyStat',
        runId: 'run-a',
        actorId: 'goblin',
        change: { kind: 'addTempHp', value: 2 },
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'unchanged' });
    expect(actorRecord(repository, 'goblin').liveStats?.tempHp).toBe(3);
    const damage = await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'damage', value: 5 },
      at: AT,
    });
    expect(actorRecord(repository, 'goblin').liveStats).toMatchObject({
      currentHp: 8,
      tempHp: 0,
    });
    const log = readySnapshot(repository).logs.find(
      value => value.archiveId === 'run-a:1'
    )!;
    expect(log.events.at(-1)).toMatchObject({
      id: `${damage.operationId}:0`,
      type: 'damage',
      targetId: 'm-goblin',
      targetName: 'Goblin',
      amount: 5,
    });
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'heal', value: 50 },
      at: AT,
    });
    expect(actorRecord(repository, 'goblin').liveStats?.currentHp).toBe(10);
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'setTempHp', value: 4 },
      at: AT,
    });
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'setTempHp', value: 0 },
      at: AT,
    });
    expect(actorRecord(repository, 'goblin').liveStats?.tempHp).toBe(0);
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'setMaxHp', value: 6 },
      at: AT,
    });
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'setArmorClass', value: 17 },
      at: AT,
    });
    expect(actorRecord(repository, 'goblin').liveStats).toMatchObject({
      currentHp: 6,
      maxHp: 6,
      armorClass: 17,
    });
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'setHp', value: 3 },
      at: AT,
    });
    expect(actorRecord(repository, 'goblin').liveStats?.currentHp).toBe(3);
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'setHp', value: 99 },
      at: AT,
    });
    expect(actorRecord(repository, 'goblin').liveStats?.currentHp).toBe(6);
  });

  it('rejects HP/AC/temp writes for adopted PCs and player references as read-only', async () => {
    const repository = await openFixture();
    await started(
      repository,
      'run-a',
      ['goblin', 'aria', ADOPTED_PC],
      [20, 10, 5]
    );
    for (const actorId of ['aria', ADOPTED_PC]) {
      for (const change of [
        { kind: 'damage', value: 1 },
        { kind: 'setArmorClass', value: 20 },
        { kind: 'addTempHp', value: 5 },
      ]) {
        await expect(
          run(repository, {
            type: 'combat.applyStat',
            runId: 'run-a',
            actorId,
            change,
            at: AT,
          } as TableCombatCommandV1)
        ).resolves.toMatchObject({ status: 'rejected', reason: 'read-only' });
      }
    }
    await expect(
      run(repository, {
        type: 'combat.applyStat',
        runId: 'run-a',
        actorId: ADOPTED_PC,
        change: { kind: 'addCondition', condition: { name: 'Prone' } },
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'rejected', reason: 'read-only' });
    // Participant turn resources stay editable for adopted PCs (R8).
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: ADOPTED_PC,
      change: { kind: 'setReaction', available: false },
      at: AT,
    });
  });

  it('applies player overlay rules: DM add, player-sync suppression with prune, DM removal', async () => {
    const repository = await openFixture();
    await started(repository, 'run-a', ['goblin', 'aria'], [20, 10]);
    const added = await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'aria',
      change: {
        kind: 'addCondition',
        condition: { name: 'Frightened', source: 'dm' } as JsonObject,
      },
      at: AT,
    });
    const overlay = () =>
      actorRecord(repository, 'aria').playerConditionOverlay;
    expect(overlay()?.dmConditions).toEqual([
      expect.objectContaining({
        id: `cond-${added.operationId}`,
        name: 'Frightened',
        source: 'dm',
      }),
    ]);
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'aria',
      change: {
        kind: 'removeCondition',
        conditionId: 'psync-prone',
        conditionName: 'Prone',
        playerConditionNames: ['Prone', 'Poisoned'],
      },
      at: AT,
    });
    expect(overlay()?.suppressedSourceConditionIds).toEqual(['Prone']);
    // Player cleared Prone; the next overlay write prunes the stale name.
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'aria',
      change: {
        kind: 'removeCondition',
        conditionId: 'psync-poisoned',
        conditionName: 'Poisoned',
        playerConditionNames: ['Poisoned'],
      },
      at: AT,
    });
    expect(overlay()?.suppressedSourceConditionIds).toEqual(['Poisoned']);
    await committed(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'aria',
      change: {
        kind: 'removeCondition',
        conditionId: `cond-${added.operationId}`,
        conditionName: 'Frightened',
        playerConditionNames: ['Poisoned'],
      },
      at: AT,
    });
    expect(overlay()?.dmConditions).toEqual([]);
    expect(overlay()?.suppressedSourceConditionIds).toEqual(['Poisoned']);
  });
});

describe('history caps (D7, A1)', () => {
  it('pauses logging when the archive is full while combat continues', async () => {
    const repository = await openFixture();
    await started(repository, 'run-a', ['goblin', 'orc'], [20, 10]);
    const key = repository.workspaceIdentity;
    const log = readySnapshot(repository).logs.find(
      value => value.archiveId === 'run-a:1'
    )!;
    const filler = 'x'.repeat(TABLE_LIMITS.maxCombatArchiveBytes - 2_000);
    await repository.mutateWorkspace(revisionOf(repository), 'fill-log', {
      logs: {
        put: [
          {
            ...structuredClone(log),
            workspaceKey: key,
            events: [...log.events, { id: 'filler', type: 'note', filler }],
          },
        ],
      },
    });
    for (let index = 0; index < 40; index += 1) {
      await committed(repository, {
        type: 'combat.applyStat',
        runId: 'run-a',
        actorId: 'goblin',
        change: { kind: 'damage', value: 0.25 },
        at: AT,
      });
    }
    const paused = readySnapshot(repository).logs.find(
      value => value.archiveId === 'run-a:1'
    )!;
    expect(paused.loggingPaused).toBe(true);
    expect(actorRecord(repository, 'goblin').liveStats?.currentHp).toBe(0);
    await committed(repository, {
      type: 'combat.nextTurn',
      runId: 'run-a',
      at: AT,
    });
    expect(runRecord(repository, 'run-a').currentActorId).toBe('orc');
  });

  it('rejects start with archive-capacity at the archive cap; deleting a closed archive frees capacity', async () => {
    const repository = await openFixture();
    const key = repository.workspaceIdentity;
    await prepared(repository, 'run-a', ['goblin'], [3]);
    const logs = Array.from(
      { length: TABLE_LIMITS.maxCombatArchives },
      (_, index) => ({
        schemaVersion: 1 as const,
        workspaceKey: key,
        archiveId: `run-a:old-${index}`,
        runId: 'run-a',
        events: [],
        startedAt: AT,
        endedAt: AT,
      })
    );
    await repository.mutateWorkspace(revisionOf(repository), 'fill-archives', {
      logs: { put: logs },
    });
    await expect(
      run(repository, { type: 'combat.start', runId: 'run-a', at: AT })
    ).resolves.toMatchObject({
      status: 'rejected',
      reason: 'archive-capacity',
    });
    await committed(repository, {
      type: 'combat.deleteArchive',
      archiveId: 'run-a:old-0',
      at: AT,
    });
    expect(
      readySnapshot(repository).tombstones.filter(value => value.kind === 'log')
    ).toEqual([]);
    await committed(repository, {
      type: 'combat.start',
      runId: 'run-a',
      at: AT,
    });
    await expect(
      run(repository, {
        type: 'combat.deleteArchive',
        archiveId: 'run-a:1',
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'rejected', reason: 'archive-active' });
  });

  it('replays a start whose archive was later deleted with the recorded result', async () => {
    const repository = await openFixture();
    await prepared(repository, 'run-a', ['goblin'], [3]);
    const revision = revisionOf(repository);
    const first = await run(
      repository,
      { type: 'combat.start', runId: 'run-a', at: AT },
      'start-then-delete',
      revision
    );
    expect(first.status).toBe('committed');
    await committed(repository, { type: 'combat.end', runId: 'run-a', at: AT });
    await committed(repository, {
      type: 'combat.deleteArchive',
      archiveId: 'run-a:1',
      at: AT,
    });
    const replay = await run(
      repository,
      { type: 'combat.start', runId: 'run-a', at: AT },
      'start-then-delete',
      revision
    );
    expect(replay).toEqual(first);
    expect(runRecord(repository, 'run-a').isActive).toBe(false);
  });

  it('records command latency with a 100-archive workspace', async () => {
    const repository = await openFixture();
    const key = repository.workspaceIdentity;
    await started(repository, 'run-a', ['goblin', 'orc'], [20, 10]);
    const events = Array.from({ length: 400 }, (_, index) => ({
      id: `filler-${index}`,
      type: 'damage',
      round: 1,
      amount: index,
    }));
    await repository.mutateWorkspace(revisionOf(repository), 'fill-100', {
      logs: {
        put: Array.from(
          { length: TABLE_LIMITS.maxCombatArchives - 1 },
          (_, i) => ({
            schemaVersion: 1 as const,
            workspaceKey: key,
            archiveId: `run-a:old-${i}`,
            runId: 'run-a',
            events,
            startedAt: AT,
            endedAt: AT,
          })
        ),
      },
    });
    const startedAt = performance.now();
    for (let index = 0; index < 5; index += 1) {
      await committed(repository, {
        type: 'combat.nextTurn',
        runId: 'run-a',
        at: AT,
      });
    }
    const perCommand = (performance.now() - startedAt) / 5;
    console.info(
      `[combat latency] nextTurn with 100 archives: ${perCommand.toFixed(1)} ms/command`
    );
    expect(readySnapshot(repository).logs).toHaveLength(
      TABLE_LIMITS.maxCombatArchives
    );
  });
});

describe('publication acknowledgements (R2-5, C3-9)', () => {
  it('acknowledges only matching unacknowledged intents, all ends in one command', async () => {
    const repository = await openFixture();
    await started(repository, 'run-a', ['goblin'], [3]);
    await committed(repository, { type: 'combat.end', runId: 'run-a', at: AT });
    await started(repository, 'run-b', ['orc'], [3]);
    await committed(repository, { type: 'combat.end', runId: 'run-b', at: AT });
    await expect(
      run(repository, {
        type: 'combat.acknowledgePublication',
        targets: [{ runId: 'run-a', combatGeneration: 1, intent: 'publish' }],
        at: AT,
      })
    ).resolves.toMatchObject({ status: 'unchanged' });
    await committed(repository, {
      type: 'combat.acknowledgePublication',
      targets: [
        { runId: 'run-a', combatGeneration: 1, intent: 'end' },
        { runId: 'run-b', combatGeneration: 1, intent: 'end' },
      ],
      at: AT,
    });
    expect(runRecord(repository, 'run-a').publication?.acknowledged).toBe(true);
    expect(runRecord(repository, 'run-b').publication?.acknowledged).toBe(true);
  });
});

describe('no legacy writers (D6)', () => {
  it('runs a full scene combat flow without touching legacy stores or localStorage', async () => {
    const { useEncounterStore } = await import('@/store/encounterStore');
    const { useCombatLogStore } = await import('@/store/combatLogStore');
    const { useNPCStore } = await import('@/store/npcStore');
    const { useBattleMapStore } = await import('@/store/battleMapStore');
    const { buildCombatReadModel } = await import('./combatReadModel');
    const { vi } = await import('vitest');
    const stores = [
      useEncounterStore,
      useCombatLogStore,
      useNPCStore,
      useBattleMapStore,
    ];
    // Zustand's internal `set` bypasses a setState spy: state identity and
    // persisted storage are the discriminating assertions.
    const snapshots = stores.map(store => store.getState());
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    try {
      const repository = await openFixture();
      await started(
        repository,
        'run-a',
        ['goblin', 'aria', ADOPTED_PC],
        [20, 10, 5]
      );
      await committed(repository, {
        type: 'combat.applyStat',
        runId: 'run-a',
        actorId: 'goblin',
        change: { kind: 'damage', value: 3 },
        at: AT,
      });
      await committed(repository, {
        type: 'combat.applyStat',
        runId: 'run-a',
        actorId: 'aria',
        change: { kind: 'addCondition', condition: { name: 'Prone' } },
        at: AT,
      });
      await committed(repository, {
        type: 'combat.nextTurn',
        runId: 'run-a',
        at: AT,
      });
      buildCombatReadModel({
        snapshot: readySnapshot(repository),
        runId: 'run-a',
      });
      await committed(repository, {
        type: 'combat.end',
        runId: 'run-a',
        at: AT,
      });
      expect(storage).not.toHaveBeenCalled();
      stores.forEach((store, index) =>
        expect(store.getState()).toBe(snapshots[index])
      );
    } finally {
      storage.mockRestore();
    }
  });
});
