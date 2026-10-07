import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { promisify } from 'node:util';

const execAsync = promisify(execFile);
const CONTAINER = `rollkeeper-table-control-${randomUUID().slice(0, 8)}`;
const CODE = 'SYNTH03A';
const TAG = `{rk-table-v1:${createHash('sha256').update(CODE, 'utf8').digest('hex')}}`;
const keys = [
  `campaign:${TAG}:table-control`,
  `campaign:${TAG}:table-scenes`,
  `campaign:${TAG}:table-operations`,
  `campaign:${TAG}:table-operations-order`,
  `campaign:${TAG}:shared:initiative`,
  `campaign:${TAG}:shared:battlemap`,
  `campaign:${TAG}:shared:initiativeRequest`,
];
assert.ok(keys.every(key => key.includes(TAG)));
const source = fs.readFileSync(
  new URL('../src/lib/tableServer/atomic.ts', import.meta.url),
  'utf8'
);
const script = source.match(
  /export const TABLE_CONTROL_SCRIPT = `([\s\S]*?)`;/u
)?.[1];
assert.ok(script);

function redis(...args) {
  return execFileSync(
    'docker',
    ['exec', CONTAINER, 'redis-cli', '--raw', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
}
function evaluate(command, principal = 'account:synthetic-owner') {
  const digest = JSON.stringify(command);
  return JSON.parse(
    redis(
      'EVAL',
      script,
      String(keys.length),
      ...keys,
      JSON.stringify(command),
      digest,
      principal,
      randomUUID(),
      randomUUID()
    )
  );
}
async function evaluateAsync(command, principal = 'account:synthetic-owner') {
  const { stdout } = await execAsync('docker', [
    'exec',
    CONTAINER,
    'redis-cli',
    '--raw',
    'EVAL',
    script,
    String(keys.length),
    ...keys,
    JSON.stringify(command),
    JSON.stringify(command),
    principal,
    randomUUID(),
    randomUUID(),
  ]);
  return JSON.parse(stdout.trim());
}
function next(type, state, session = 'session-one', extra = {}) {
  return {
    type,
    operationId: randomUUID(),
    expectedEpoch: state.epoch,
    expectedRevision: state.revision,
    expectedFence: state.writerFence,
    holderSessionId: session,
    ...extra,
  };
}
function committed(command, principal) {
  const result = evaluate(command, principal);
  assert.equal(
    result.status,
    'committed',
    `${command.type}: ${JSON.stringify(result)}`
  );
  return result.current;
}
function initiative(runId = 'run-one') {
  return {
    encounterId: runId,
    isActive: true,
    round: 1,
    currentEntityId: null,
    turnOrder: [],
    enemyHpMode: 'off',
    enemyConditionsMode: 'off',
    updatedAt: 'synthetic',
  };
}

test('Table control is atomic under competing writers, registry mutations, leases, and expiry', async t => {
  const child = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      CONTAINER,
      'redis:8.10.0',
      'redis-server',
      '--save',
      '',
      '--appendonly',
      'no',
    ],
    { stdio: 'ignore' }
  );
  t.after(() => {
    try {
      execFileSync('docker', ['stop', CONTAINER], { stdio: 'ignore' });
    } catch {}
    child.kill('SIGTERM');
  });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (redis('PING') === 'PONG') break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(redis('PING'), 'PONG');

  const missing = evaluate(
    next('acquire', { epoch: randomUUID(), revision: 0, writerFence: 0 })
  );
  assert.equal(missing.reason, 'missing-control');
  const firstInitialize = { type: 'initialize', operationId: randomUUID() };
  let state = committed(firstInitialize);
  assert.equal(state.revision, 0);
  assert.equal(
    evaluate({ type: 'initialize', operationId: randomUUID() }).reason,
    'already-initialized'
  );
  assert.ok(Number(redis('TTL', keys[0])) > 86000);

  const competing = await Promise.all([
    evaluateAsync(next('acquire', state, 'session-one')),
    evaluateAsync(next('acquire', state, 'session-two')),
  ]);
  assert.deepEqual(competing.map(value => value.status).sort(), [
    'committed',
    'conflict',
  ]);
  state = competing.find(value => value.status === 'committed').current;
  const firstSession = state.holderSessionId;
  const otherSession =
    firstSession === 'session-one' ? 'session-two' : 'session-one';

  const staleFence = next('publishInitiative', state, otherSession, {
    runId: 'run-one',
    initiative: initiative(),
  });
  assert.equal(evaluate(staleFence).reason, 'lease-lost');
  const publication = next('publishInitiative', state, firstSession, {
    runId: 'run-one',
    initiative: initiative(),
  });
  state = committed(publication);
  const storedInitiative = JSON.parse(redis('GET', keys[4]));
  assert.equal(storedInitiative.expiresAt, state.leaseUntil);
  const sameOperation = evaluate(publication);
  assert.equal(sameOperation.status, 'committed');
  assert.equal(sameOperation.historical, false);
  assert.equal(
    evaluate({ ...publication, runId: 'run-two' }).reason,
    'operation-id-reused'
  );
  const beforeRenewalExpiry = storedInitiative.expiresAt;
  await new Promise(resolve => setTimeout(resolve, 5));
  state = committed(next('renew', state, firstSession));
  assert.ok(JSON.parse(redis('GET', keys[4])).expiresAt > beforeRenewalExpiry);
  assert.equal(evaluate(publication).historical, true);
  const savedPublication = JSON.parse(
    redis('HGET', keys[2], publication.operationId)
  );
  redis(
    'HSET',
    keys[2],
    publication.operationId,
    JSON.stringify({ ...savedPublication, expiresAt: 0 })
  );
  assert.equal(evaluate(publication).reason, 'stale-control');
  const request = {
    requestId: 'request-one',
    encounterId: 'run-one',
    encounterName: 'Synthetic encounter',
    requestedAt: 1,
  };
  state = committed(
    next('publishInitiativeRequest', state, firstSession, { request })
  );
  assert.equal(JSON.parse(redis('GET', keys[6])).requestId, 'request-one');
  state = committed(
    next('publishInitiativeRequest', state, firstSession, { request: null })
  );
  assert.equal(redis('EXISTS', keys[6]), '0');

  const register = next('registerScene', state, firstSession, {
    sceneId: 'scene-one',
    workspaceInstanceId: 'workspace-one',
    sourceMapId: 'map-one',
    contentRevision: 1,
    safeLabel: 'Safe scene',
    expectedRegistryRevision: 0,
  });
  const concurrentRegistry = await Promise.all([
    evaluateAsync(register),
    evaluateAsync({
      ...register,
      operationId: randomUUID(),
      sceneId: 'scene-two',
    }),
  ]);
  assert.deepEqual(concurrentRegistry.map(value => value.status).sort(), [
    'committed',
    'conflict',
  ]);
  state = concurrentRegistry.find(
    value => value.status === 'committed'
  ).current;
  assert.equal(redis('HLEN', keys[1]), '1');
  const sceneId =
    concurrentRegistry[0].status === 'committed' ? 'scene-one' : 'scene-two';
  assert.equal(JSON.parse(redis('HGET', keys[1], sceneId)).roomId.length, 36);
  assert.equal(
    evaluate(
      next('updateScene', state, firstSession, {
        sceneId: 'missing',
        workspaceInstanceId: 'workspace-one',
        sourceMapId: 'map-one',
        contentRevision: 2,
        safeLabel: 'Updated',
        expectedRegistryRevision: 0,
      })
    ).reason,
    'scene-identity-mismatch'
  );
  const originalEntry = JSON.parse(redis('HGET', keys[1], sceneId));
  state = committed(
    next('updateScene', state, firstSession, {
      sceneId,
      workspaceInstanceId: originalEntry.workspaceInstanceId,
      sourceMapId: originalEntry.sourceMapId,
      contentRevision: 2,
      safeLabel: 'Updated',
      expectedRegistryRevision: 1,
    })
  );
  assert.equal(JSON.parse(redis('HGET', keys[1], sceneId)).contentRevision, 2);
  assert.equal(
    evaluate(
      next('adoptScene', state, firstSession, {
        sceneId,
        workspaceInstanceId: 'new-workspace',
        expectedRegistryRevision: 2,
      })
    ).reason,
    'takeover-required'
  );
  assert.equal(
    evaluate(
      next('registerScene', state, firstSession, {
        sceneId,
        sourceMapId: 'map-one',
        contentRevision: 1,
        safeLabel: 'Safe scene',
        expectedRegistryRevision: 0,
        workspaceInstanceId: 'another-workspace',
      })
    ).reason,
    'scene-already-registered'
  );
  state = committed(next('show', state, firstSession, { sceneId }));
  assert.equal(state.presentation.sceneId, sceneId);
  assert.equal(JSON.parse(redis('GET', keys[0])).displayGeneration, 0);
  assert.equal(JSON.parse(redis('GET', keys[5])).activeBattleMapId, null);
  state = committed(next('blank', state, firstSession));
  assert.equal(state.presentation.blanked, true);
  state = committed(next('show', state, firstSession, { sceneId }));
  assert.equal(state.presentation.blanked, false);
  state = committed(next('unpresent', state, firstSession));
  assert.equal(state.presentation.sceneId, null);
  state = committed(next('show', state, firstSession, { sceneId }));
  state = committed(next('deletePresented', state, firstSession));
  assert.equal(state.presentation.sceneId, null);
  assert.equal(JSON.parse(redis('HGET', keys[1], sceneId)).deleted, true);
  assert.equal(
    evaluate(
      next('updateScene', state, firstSession, {
        sceneId,
        workspaceInstanceId: originalEntry.workspaceInstanceId,
        sourceMapId: originalEntry.sourceMapId,
        contentRevision: 3,
        safeLabel: 'Resurrect',
        expectedRegistryRevision: 3,
      })
    ).reason,
    'scene-identity-mismatch'
  );
  const third = 'scene-three';
  state = committed(
    next('registerScene', state, firstSession, {
      sceneId: third,
      workspaceInstanceId: 'workspace-one',
      sourceMapId: null,
      contentRevision: 1,
      safeLabel: 'Third',
      expectedRegistryRevision: 0,
    })
  );
  state = committed(
    next('tombstoneScene', state, firstSession, {
      sceneId: third,
      expectedRegistryRevision: 1,
    })
  );
  assert.equal(JSON.parse(redis('HGET', keys[1], third)).deleted, true);
  state = committed(
    next('registerScene', state, firstSession, {
      sceneId: 'scene-four',
      workspaceInstanceId: 'workspace-one',
      sourceMapId: null,
      contentRevision: 1,
      safeLabel: 'Fourth',
      expectedRegistryRevision: 0,
    })
  );
  state = committed(next('endInitiative', state, firstSession));
  assert.equal(redis('EXISTS', keys[4]), '0');
  state = committed(
    next('publishInitiative', state, firstSession, {
      runId: 'run-one',
      initiative: initiative(),
    })
  );
  assert.equal(redis('EXISTS', keys[4]), '1');

  const former = next('publishInitiative', state, firstSession, {
    runId: 'run-one',
    initiative: initiative(),
  });
  state = committed(next('takeover', state, otherSession));
  assert.equal(redis('EXISTS', keys[4]), '0');
  assert.equal(state.publicRunId, null);
  assert.equal(evaluate(former).reason, 'stale-control');
  state = committed(
    next('adoptScene', state, otherSession, {
      sceneId: 'scene-four',
      workspaceInstanceId: 'imported-workspace',
      expectedRegistryRevision: 1,
    })
  );
  assert.equal(
    evaluate(
      next('publishInitiative', state, firstSession, {
        runId: 'run-one',
        initiative: initiative(),
      })
    ).reason,
    'lease-lost'
  );
  const oldEpoch = state.epoch;
  redis('DEL', keys[0]);
  assert.equal(
    evaluate(next('renew', state, otherSession)).reason,
    'missing-control'
  );
  state = committed({ type: 'initialize', operationId: randomUUID() });
  assert.notEqual(state.epoch, oldEpoch);
  assert.equal(evaluate(firstInitialize).reason, 'stale-epoch');
  assert.equal(
    evaluate({ ...former, expectedRevision: state.revision }).reason,
    'stale-epoch'
  );
});

/**
 * PR03 scene combat publication against real Redis: the Table page's control
 * session and combat publisher (imported from source via Node type
 * stripping), the real request validator, and the real control Lua. Covers
 * an adopted `<encounter>:<entity>` run publishing under sceneMemberIds,
 * renew after an interleaved commit, failed end + retry, and a former
 * controller's delayed retry after takeover.
 */
test('Scene combat publication: adopted run, renew retry, stale end retry, takeover refusal', async t => {
  const name = `rollkeeper-table-combat-${randomUUID().slice(0, 8)}`;
  const child = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      name,
      'redis:8.10.0',
      'redis-server',
      '--save',
      '',
      '--appendonly',
      'no',
    ],
    { stdio: 'ignore' }
  );
  t.after(() => {
    try {
      execFileSync('docker', ['stop', name], { stdio: 'ignore' });
    } catch {}
    child.kill('SIGTERM');
  });
  const cli = (...args) =>
    execFileSync('docker', ['exec', name, 'redis-cli', '--raw', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (cli('PING') === 'PONG') break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(cli('PING'), 'PONG');

  const { parseTableCommand } = await import(
    '../src/lib/tableServer/validation.ts'
  );
  const { createTableControlSession } = await import(
    '../src/lib/table/authorityLifecycle.ts'
  );
  const { createCombatPublisher } = await import(
    '../src/lib/table/combatPublisher.ts'
  );
  const fixture = JSON.parse(
    fs.readFileSync(
      new URL(
        '../src/lib/table/combatPublication.fixture.json',
        import.meta.url
      ),
      'utf8'
    )
  );
  const PRINCIPAL = 'account:synthetic-owner';
  const lua = command =>
    JSON.parse(
      cli(
        'EVAL',
        script,
        String(keys.length),
        ...keys,
        JSON.stringify(command),
        createHash('sha256')
          .update(JSON.stringify({ principal: PRINCIPAL, command }))
          .digest('hex'),
        PRINCIPAL,
        randomUUID(),
        randomUUID()
      )
    );
  let failNextEnd = false;
  const sent = [];
  // Mirrors the control route: bounded JSON, real validator, Lua, status map.
  const fetcher = async (_url, init) => {
    const raw = String(init.body);
    assert.ok(Buffer.byteLength(raw) <= 16 * 1024);
    const body = JSON.parse(raw);
    const command = parseTableCommand(body.command);
    if (!command) return Response.json({ error: 'invalid' }, { status: 400 });
    sent.push(command);
    if (command.type === 'endInitiative' && failNextEnd) {
      failNextEnd = false;
      throw new TypeError('network down');
    }
    const result = lua(command);
    const status =
      result.status === 'committed'
        ? 200
        : result.status === 'conflict'
          ? 409
          : result.status === 'denied'
            ? 403
            : 503;
    return Response.json(result, { status });
  };

  let current = lua({ type: 'initialize', operationId: randomUUID() }).current;
  current = lua({
    type: 'acquire',
    operationId: randomUUID(),
    expectedEpoch: current.epoch,
    expectedRevision: current.revision,
    expectedFence: current.writerFence,
    holderSessionId: 'table-page-a',
  }).current;
  const session = createTableControlSession({
    campaignCode: CODE,
    dmId: 'dm-1',
    holderSessionId: 'table-page-a',
    initial: current,
    fetcher,
  });

  // An adopted `<enc>:<entity>` run publishes only sceneMemberId identities.
  const state = {
    active: {
      runId: fixture.runId,
      combatGeneration: 1,
      publication: {
        intent: 'publish',
        combatGeneration: 1,
        acknowledged: false,
      },
    },
    pendingEnds: [],
  };
  const acknowledged = [];
  const statuses = [];
  const publisher = createCombatPublisher({
    getSession: () => session,
    readState: () => structuredClone(state),
    buildPayload: runId =>
      state.active?.runId === runId
        ? {
            status: 'ok',
            initiative: {
              ...fixture.initiative,
              updatedAt: new Date().toISOString(),
            },
          }
        : { status: 'not-running' },
    acknowledge: async targets => {
      acknowledged.push(...targets);
      for (const target of targets) {
        if (state.active?.runId === target.runId && target.intent === 'publish')
          state.active.publication.acknowledged = true;
        state.pendingEnds = state.pendingEnds.filter(
          end => end.runId !== target.runId
        );
      }
      return true;
    },
    onStatus: status => statuses.push(status),
  });
  publisher.hold();
  await publisher.publishCurrentState();
  assert.deepEqual(statuses.at(-1), {
    kind: 'broadcasting',
    runId: fixture.runId,
  });
  const stored = JSON.parse(cli('GET', keys[4]));
  assert.equal(stored.encounterId, fixture.runId);
  assert.deepEqual(
    stored.turnOrder.map(entry => entry.entityId),
    fixture.initiative.turnOrder.map(entry => entry.entityId)
  );
  assert.ok(!JSON.stringify(stored).includes('enc-1'));
  assert.equal(session.current().publicRunId, fixture.runId);
  assert.deepEqual(acknowledged, [
    { runId: fixture.runId, combatGeneration: 1, intent: 'publish' },
  ]);

  // Renew after an interleaved commit by another request of this holder.
  const before = session.current();
  lua({
    type: 'publishInitiativeRequest',
    operationId: randomUUID(),
    expectedEpoch: before.epoch,
    expectedRevision: before.revision,
    expectedFence: before.writerFence,
    holderSessionId: 'table-page-a',
    request: null,
  });
  const renewed = await session.renew();
  assert.equal(renewed.status, 'committed', JSON.stringify(renewed));
  assert.equal(sent.filter(command => command.type === 'renew').length, 2);

  // Local end + failed endInitiative: stale, then explicit retry clears.
  state.active = null;
  state.pendingEnds = [{ runId: fixture.runId, combatGeneration: 1 }];
  failNextEnd = true;
  publisher.changed();
  for (
    let index = 0;
    index < 20 && statuses.at(-1)?.kind !== 'stale';
    index += 1
  )
    await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(statuses.at(-1).kind, 'stale');
  assert.equal(cli('EXISTS', keys[4]), '1');
  await publisher.publishCurrentState();
  assert.equal(cli('EXISTS', keys[4]), '0');
  assert.deepEqual(statuses.at(-1), { kind: 'saved-locally' });

  // Start again, publish, then another controller takes over.
  state.active = {
    runId: fixture.runId,
    combatGeneration: 2,
    publication: {
      intent: 'publish',
      combatGeneration: 2,
      acknowledged: false,
    },
  };
  await publisher.publishCurrentState();
  assert.equal(cli('EXISTS', keys[4]), '1');
  const live = session.current();
  lua({
    type: 'takeover',
    operationId: randomUUID(),
    expectedEpoch: live.epoch,
    expectedRevision: live.revision,
    expectedFence: live.writerFence,
    holderSessionId: 'table-page-b',
  });
  assert.equal(cli('EXISTS', keys[4]), '0');
  // The former controller's delayed retry is refused and never republishes.
  state.active.publication.acknowledged = true;
  const refused = await session.publishInitiative(fixture.runId, {
    ...fixture.initiative,
    updatedAt: new Date().toISOString(),
  });
  assert.equal(refused.status, 'lost');
  state.active = null;
  state.pendingEnds = [{ runId: fixture.runId, combatGeneration: 2 }];
  const sentBefore = sent.length;
  publisher.changed();
  await publisher.publishCurrentState();
  assert.equal(sent.length, sentBefore);
  assert.equal(statuses.at(-1).kind, 'not-broadcasting');
  assert.equal(cli('EXISTS', keys[4]), '0');
  assert.equal(JSON.parse(cli('GET', keys[0])).holderSessionId, 'table-page-b');
});
