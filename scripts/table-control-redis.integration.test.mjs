import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { promisify } from 'node:util';

// PR04: run real TypeScript service code (Node type stripping). Resolve the
// app's `@/` alias and extensionless relative imports to `src/**.ts`.
const SRC = new URL('../src/', import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith('@/')
      ? new URL(specifier.slice(2), SRC).href
      : specifier;
    if (
      (target.startsWith('file:') || target.startsWith('.')) &&
      context.parentURL &&
      !context.parentURL.includes('/node_modules/')
    ) {
      const url = new URL(target, context.parentURL);
      if (!fs.existsSync(url) && fs.existsSync(new URL(`${url.href}.ts`)))
        return nextResolve(`${url.href}.ts`, context);
      return nextResolve(url.href, context);
    }
    return nextResolve(target, context);
  },
});

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
      randomUUID(),
      new Date().toISOString()
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
    new Date().toISOString(),
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
  // PR04 P1: Show projects the presented scene's source map atomically.
  assert.equal(JSON.parse(redis('GET', keys[5])).activeBattleMapId, 'map-one');
  state = committed(next('blank', state, firstSession));
  assert.equal(state.presentation.blanked, true);
  state = committed(next('show', state, firstSession, { sceneId }));
  assert.equal(state.presentation.blanked, false);
  state = committed(next('unpresent', state, firstSession));
  assert.equal(state.presentation.sceneId, null);
  state = committed(next('show', state, firstSession, { sceneId }));
  state = committed(
    next('deletePresented', state, firstSession, { expectedSceneId: sceneId })
  );
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
        randomUUID(),
        new Date().toISOString()
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

async function startRedis(t, name, extra = []) {
  const child = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      name,
      ...extra,
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
  return cli;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

/**
 * PR04 P1/P2 against real Redis: the compatibility pointer is derived inside
 * the same control EVAL after every commit, deletion is fenced by the
 * expected presented scene, replays are judged by the ledger, and a mapless
 * takeover leaves presentation untouched.
 */
test('PR04 presentation: atomic projection, fenced deletion, replay and takeover', async t => {
  const name = `rollkeeper-table-present-${randomUUID().slice(0, 8)}`;
  const cli = await startRedis(t, name);
  const { parseTableCommand } = await import(
    '../src/lib/tableServer/validation.ts'
  );
  const PRINCIPAL = 'account:synthetic-owner';
  const lua = command => {
    assert.ok(
      command.type === 'initialize' || parseTableCommand(command),
      `validator rejects ${command.type}`
    );
    return JSON.parse(
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
        randomUUID(),
        new Date().toISOString()
      )
    );
  };
  const projection = () => JSON.parse(cli('GET', keys[5]));
  let state = lua({ type: 'initialize', operationId: randomUUID() }).current;
  assert.equal(projection().activeBattleMapId, null);
  assert.match(projection().updatedAt, ISO);
  const op = (type, extra = {}, session = 'table-page') => ({
    type,
    operationId: randomUUID(),
    expectedEpoch: state.epoch,
    expectedRevision: state.revision,
    expectedFence: state.writerFence,
    holderSessionId: session,
    ...extra,
  });
  const commit = command => {
    const result = lua(command);
    assert.equal(result.status, 'committed', JSON.stringify(result));
    state = result.current;
    return result;
  };
  commit(op('acquire'));
  const register = (sceneId, sourceMapId, safeLabel) =>
    commit(
      op('registerScene', {
        sceneId,
        workspaceInstanceId: 'workspace-a',
        sourceMapId,
        contentRevision: 1,
        safeLabel,
        expectedRegistryRevision: 0,
      })
    );
  register('scene-tavern', 'map-tavern', 'Tavern');
  register('scene-forest', 'map-forest', 'Private Forest');
  // P12: a second scene over the same source map is registrable.
  register('scene-tavern-night', 'map-tavern', 'Tavern at night');
  register('scene-nomap', null, 'No map');
  assert.equal(projection().activeBattleMapId, null);

  const show = op('show', { sceneId: 'scene-tavern' });
  commit(show);
  assert.deepEqual(
    { ...projection(), updatedAt: 'iso' },
    { activeBattleMapId: 'map-tavern', name: 'Tavern', updatedAt: 'iso' }
  );
  assert.match(projection().updatedAt, ISO);

  // Renew and initiative commits keep the derived value.
  commit(op('renew'));
  assert.equal(projection().activeBattleMapId, 'map-tavern');
  commit(
    op('publishInitiative', { runId: 'run-one', initiative: initiative() })
  );
  assert.equal(projection().activeBattleMapId, 'map-tavern');
  commit(op('endInitiative'));
  assert.equal(projection().name, 'Tavern');

  // updateScene of the presented scene refreshes the name.
  const tavern = JSON.parse(cli('HGET', keys[1], 'scene-tavern'));
  commit(
    op('updateScene', {
      sceneId: 'scene-tavern',
      workspaceInstanceId: tavern.workspaceInstanceId,
      sourceMapId: tavern.sourceMapId,
      contentRevision: 2,
      safeLabel: 'The Tavern',
      expectedRegistryRevision: tavern.registryRevision,
    })
  );
  assert.equal(projection().name, 'The Tavern');

  // Same-source switch keeps the source id, changes the label.
  commit(op('show', { sceneId: 'scene-tavern-night' }));
  assert.deepEqual(
    [projection().activeBattleMapId, projection().name],
    ['map-tavern', 'Tavern at night']
  );

  // Blank and unpresent publish null in the same EVAL.
  commit(op('blank'));
  assert.equal(state.presentation.blanked, true);
  assert.equal(projection().activeBattleMapId, null);
  assert.equal(projection().name, undefined);
  commit(op('show', { sceneId: 'scene-tavern-night' }));
  assert.equal(projection().activeBattleMapId, 'map-tavern');
  commit(op('unpresent'));
  assert.equal(projection().activeBattleMapId, null);

  // Lua-level only: a scene without a source map projects null when shown.
  commit(op('show', { sceneId: 'scene-nomap' }));
  assert.equal(state.presentation.sceneId, 'scene-nomap');
  assert.equal(projection().activeBattleMapId, null);

  // Idempotent replay of an earlier show after a later blank.
  commit(op('blank'));
  const replay = lua(show);
  assert.equal(replay.status, 'committed');
  assert.equal(replay.reason, 'duplicate');
  assert.equal(replay.historical, true);
  assert.equal(replay.current.presentation.sceneId, 'scene-nomap');
  assert.equal(replay.current.presentation.blanked, true);
  assert.equal(projection().activeBattleMapId, null);
  assert.equal(
    lua({ ...show, sceneId: 'scene-forest' }).reason,
    'operation-id-reused'
  );

  // Fenced deletion.
  commit(op('show', { sceneId: 'scene-tavern' }));
  const staleDelete = op('deletePresented', {
    expectedSceneId: 'scene-forest',
  });
  const fenced = lua(staleDelete);
  assert.equal(fenced.status, 'conflict');
  assert.equal(fenced.reason, 'presentation-changed');
  assert.equal(fenced.current.presentation.sceneId, 'scene-tavern');
  assert.equal(JSON.parse(cli('HGET', keys[1], 'scene-forest')).deleted, false);
  assert.equal(projection().activeBattleMapId, 'map-tavern');
  commit(op('deletePresented', { expectedSceneId: 'scene-tavern' }));
  assert.equal(state.presentation.sceneId, null);
  assert.equal(JSON.parse(cli('HGET', keys[1], 'scene-tavern')).deleted, true);
  assert.equal(projection().activeBattleMapId, null);
  const nothing = lua(
    op('deletePresented', { expectedSceneId: 'scene-forest' })
  );
  assert.equal(nothing.reason, 'no-presented-scene');
  assert.equal(
    lua(op('show', { sceneId: 'scene-tavern' })).reason,
    'scene-deleted'
  );
  assert.equal(
    lua(op('show', { sceneId: 'scene-missing' })).reason,
    'scene-unregistered'
  );

  // Tombstoning the presented scene clears presentation and projection.
  commit(op('show', { sceneId: 'scene-forest' }));
  assert.equal(projection().activeBattleMapId, 'map-forest');
  const forest = JSON.parse(cli('HGET', keys[1], 'scene-forest'));
  commit(
    op('tombstoneScene', {
      sceneId: 'scene-forest',
      expectedRegistryRevision: forest.registryRevision,
    })
  );
  assert.equal(state.presentation.sceneId, null);
  assert.equal(projection().activeBattleMapId, null);

  // A mapless-style takeover leaves presentation and projection intact.
  commit(op('show', { sceneId: 'scene-tavern-night' }));
  const beforeTakeover = state.presentation;
  commit(op('takeover', {}, 'mapless-encounter'));
  assert.deepEqual(state.presentation, beforeTakeover);
  assert.equal(projection().activeBattleMapId, 'map-tavern');
  assert.equal(
    lua(op('blank', {}, 'table-page')).reason,
    'lease-lost',
    'the former Table page cannot blank while another session holds control'
  );

  // Base-only commands are exact-key validated before Lua.
  for (const type of [
    'acquire',
    'renew',
    'takeover',
    'blank',
    'unpresent',
    'endInitiative',
  ])
    assert.equal(parseTableCommand({ ...op(type), smuggled: true }), null);
  assert.equal(parseTableCommand(op('deletePresented')), null);

  // An expired/reinitialized epoch rejects an old show.
  const oldShow = op('show', { sceneId: 'scene-tavern-night' });
  cli('DEL', keys[0]);
  state = lua({ type: 'initialize', operationId: randomUUID() }).current;
  assert.equal(lua(oldShow).reason, 'stale-epoch');
  assert.equal(projection().activeBattleMapId, null);
});

/**
 * PR04 real REST: `TableControlService` and the P5 resource helper run as
 * TypeScript source through `@upstash/redis` against a disposable Redis +
 * serverless-redis-http pair, so the REST flat-array HGETALL shape (A1) is
 * exercised end to end, not mocked.
 */
test('PR04 real REST: registry() and resource resolution through @upstash/redis', async t => {
  const suffix = randomUUID().slice(0, 8);
  const network = `rollkeeper-table-rest-${suffix}`;
  const redisName = `rollkeeper-table-rest-redis-${suffix}`;
  const srhName = `rollkeeper-table-rest-srh-${suffix}`;
  execFileSync('docker', ['network', 'create', network], { stdio: 'ignore' });
  const cli = await startRedis(t, redisName, ['--network', network]);
  const srh = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      srhName,
      '--network',
      network,
      '-p',
      '127.0.0.1::80',
      '-e',
      'SRH_MODE=env',
      '-e',
      'SRH_TOKEN=synthetic_rest_token',
      '-e',
      `SRH_CONNECTION_STRING=redis://${redisName}:6379`,
      'hiett/serverless-redis-http:latest',
    ],
    { stdio: 'ignore' }
  );
  t.after(() => {
    // Stop both containers before removing their network (hook order).
    for (const container of [srhName, redisName]) {
      try {
        execFileSync('docker', ['stop', container], { stdio: 'ignore' });
      } catch {}
    }
    srh.kill('SIGTERM');
    try {
      execFileSync('docker', ['network', 'rm', network], { stdio: 'ignore' });
    } catch {}
  });
  let url = null;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !url) {
    try {
      const port = execFileSync('docker', ['port', srhName, '80/tcp'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .trim()
        .split('\n')[0]
        .split(':')
        .at(-1);
      const probe = await fetch(`http://127.0.0.1:${port}/`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer synthetic_rest_token',
          'content-type': 'application/json',
        },
        body: '["PING"]',
      });
      if (probe.ok && (await probe.json()).result === 'PONG')
        url = `http://127.0.0.1:${port}`;
    } catch {}
    if (!url) await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(url, 'serverless-redis-http did not become ready');

  const { Redis } = await import('@upstash/redis');
  const rawRedis = new Redis({
    url,
    token: 'synthetic_rest_token',
    automaticDeserialization: false,
  });
  const { TableControlService } = await import(
    '../src/lib/tableServer/control.ts'
  );
  const { resolveTableResource, readPresentedTableScene } = await import(
    '../src/lib/tableServer/presentation.ts'
  );
  const service = new TableControlService(rawRedis);
  const principal = {
    id: 'account:synthetic-owner',
    campaignCode: CODE,
    role: 'owner',
  };
  const ok = async command => {
    const result = await service.execute(principal, command);
    assert.equal(result.status, 'committed', JSON.stringify(result));
    return result.current;
  };
  let current = await ok({ type: 'initialize', operationId: randomUUID() });
  const base = () => ({
    operationId: randomUUID(),
    expectedEpoch: current.epoch,
    expectedRevision: current.revision,
    expectedFence: current.writerFence,
    holderSessionId: 'table-page',
  });
  current = await ok({ ...base(), type: 'acquire' });
  for (const [sceneId, sourceMapId, safeLabel] of [
    ['scene-tavern', 'map-tavern', 'Tavern'],
    ['scene-forest', 'map-forest', 'Private Forest'],
    ['scene-tavern-night', 'map-tavern', 'Tavern at night'],
  ]) {
    current = await ok({
      ...base(),
      type: 'registerScene',
      sceneId,
      workspaceInstanceId: 'workspace-a',
      sourceMapId,
      contentRevision: 1,
      safeLabel,
      expectedRegistryRevision: 0,
    });
  }
  current = await ok({ ...base(), type: 'show', sceneId: 'scene-tavern' });

  // The REST client answers HGETALL as a flat array; registry() decodes it.
  const rawHash = await rawRedis.hgetall(keys[1]);
  assert.ok(Array.isArray(rawHash), 'REST HGETALL is a flat array');
  const registry = await service.registry(principal);
  assert.deepEqual(registry.map(entry => entry.sceneId).sort(), [
    'scene-forest',
    'scene-tavern',
    'scene-tavern-night',
  ]);
  assert.equal((await service.read(CODE)).presentation.sceneId, 'scene-tavern');

  const resolve = id => resolveTableResource({ rawRedis, campaign: CODE, id });
  assert.deepEqual(
    {
      ...(await resolve('scene-tavern')),
    },
    {
      kind: 'scene',
      sceneId: 'scene-tavern',
      sourceMapId: 'map-tavern',
      safeLabel: 'Tavern',
      deleted: false,
      audienceVisible: true,
    }
  );
  assert.equal((await resolve('scene-forest')).audienceVisible, false);
  assert.deepEqual(await resolve('map-tavern'), { kind: 'source-map' });
  assert.deepEqual(await resolve('map-forest'), { kind: 'source-map' });
  assert.deepEqual(await resolve('map-unknown'), { kind: 'unregistered' });
  cli(
    'SET',
    `campaign:${CODE}:location:loc-1`,
    JSON.stringify({
      id: 'loc-1',
      name: 'Market',
      mapImageUrl: 'https://cdn.test/market.png',
      updatedAt: '2026-10-07T00:00:00.000Z',
    })
  );
  assert.deepEqual(await resolve('loc-1'), { kind: 'location' });
  assert.deepEqual(
    await readPresentedTableScene({ rawRedis, campaign: CODE }),
    {
      status: 'presented',
      sceneId: 'scene-tavern',
      sourceMapId: 'map-tavern',
      safeLabel: 'Tavern',
    }
  );

  current = await ok({ ...base(), type: 'blank' });
  assert.equal((await resolve('scene-tavern')).audienceVisible, false);
  assert.deepEqual(
    await readPresentedTableScene({ rawRedis, campaign: CODE }),
    {
      status: 'none',
    }
  );
  const projected = JSON.parse(cli('GET', keys[5]));
  assert.equal(projected.activeBattleMapId, null);
});

/**
 * PR04 Q1/P3.4 against real Redis and the real page control session: a Show
 * whose response is lost commits exactly once; the user's Retry re-sends the
 * identical command and the ledger duplicate is judged by the CURRENT
 * presentation (Published after an interleaved renew; "changed" after an
 * interleaved different Show), never by the `historical` flag alone.
 */
test('PR04 session: lost Show response, Retry, duplicate judged by presentation', async t => {
  const name = `rollkeeper-table-retry-${randomUUID().slice(0, 8)}`;
  const cli = await startRedis(t, name);
  const { parseTableCommand } = await import(
    '../src/lib/tableServer/validation.ts'
  );
  const { createTableControlSession, judgePresentationOutcome } = await import(
    '../src/lib/table/authorityLifecycle.ts'
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
        randomUUID(),
        new Date().toISOString()
      )
    );
  let dropNextResponse = false;
  const fetcher = async (_url, init) => {
    const command = parseTableCommand(JSON.parse(String(init.body)).command);
    if (!command) return Response.json({ error: 'invalid' }, { status: 400 });
    const result = lua(command);
    if (dropNextResponse) {
      dropNextResponse = false;
      throw new TypeError('response lost after commit');
    }
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
  const base = () => ({
    operationId: randomUUID(),
    expectedEpoch: current.epoch,
    expectedRevision: current.revision,
    expectedFence: current.writerFence,
    holderSessionId: 'table-page',
  });
  current = lua({ ...base(), type: 'acquire' }).current;
  for (const sceneId of ['scene-tavern', 'scene-forest'])
    current = lua({
      ...base(),
      type: 'registerScene',
      sceneId,
      workspaceInstanceId: 'workspace-a',
      sourceMapId: `map-${sceneId}`,
      contentRevision: 1,
      safeLabel: sceneId,
      expectedRegistryRevision: 0,
    }).current;
  const session = createTableControlSession({
    campaignCode: CODE,
    dmId: 'dm-1',
    holderSessionId: 'table-page',
    initial: current,
    fetcher,
  });
  const ledgerCount = operationId =>
    cli('LRANGE', keys[3], '0', '-1')
      .split('\n')
      .filter(value => value === operationId).length;

  // 1) Lost response → interleaved renew commit → Retry ⇒ Published.
  dropNextResponse = true;
  const first = await session.show('scene-tavern', 'show-tavern-1');
  assert.equal(first.status, 'failed');
  assert.equal(first.reason, 'network');
  assert.equal(
    JSON.parse(cli('GET', keys[0])).presentation.sceneId,
    'scene-tavern'
  );
  assert.equal((await session.renew()).status, 'committed');
  const retried = await session.resend(first.command);
  assert.equal(retried.status, 'committed');
  assert.equal(retried.duplicate, true);
  assert.equal(
    judgePresentationOutcome(
      { type: 'show', sceneId: 'scene-tavern' },
      retried.current
    ),
    'published'
  );
  assert.equal(ledgerCount('show-tavern-1'), 1);

  // 2) Lost response → interleaved different Show → Retry ⇒ changed.
  dropNextResponse = true;
  const blank = await session.blank('blank-1');
  assert.equal(blank.status, 'failed');
  assert.equal(
    (await session.show('scene-forest', 'show-forest-1')).status,
    'committed'
  );
  const blankRetry = await session.resend(blank.command);
  assert.equal(blankRetry.status, 'committed');
  assert.equal(blankRetry.duplicate, true);
  assert.equal(
    judgePresentationOutcome({ type: 'blank' }, blankRetry.current),
    'changed'
  );
  assert.equal(ledgerCount('blank-1'), 1);
  assert.equal(JSON.parse(cli('GET', keys[0])).presentation.blanked, false);
  assert.equal(session.isLost(), false);

  // 2b) F1: Lua commits but the response is a 503 (lost REST reply):
  // "not confirmed", and the identical Retry is a ledger duplicate.
  let fail503 = true;
  const fetch503 = async (url, init) => {
    const response = await fetcher(url, init);
    if (!fail503) return response;
    fail503 = false;
    return Response.json(
      { status: 'unavailable', reason: 'redis-unavailable', current: null },
      { status: 503 }
    );
  };
  const session503 = createTableControlSession({
    campaignCode: CODE,
    dmId: 'dm-1',
    holderSessionId: 'table-page',
    initial: session.current(),
    fetcher: fetch503,
  });
  const unconfirmed = await session503.show('scene-tavern', 'show-503');
  assert.equal(unconfirmed.status, 'failed');
  assert.ok(
    unconfirmed.command,
    '503 keeps the command for an identical Retry'
  );
  assert.equal(
    JSON.parse(cli('GET', keys[0])).presentation.sceneId,
    'scene-tavern'
  );
  const confirmed = await session503.resend(unconfirmed.command);
  assert.equal(confirmed.status, 'committed');
  assert.equal(confirmed.duplicate, true);
  assert.equal(
    judgePresentationOutcome(
      { type: 'show', sceneId: 'scene-tavern' },
      confirmed.current
    ),
    'published'
  );
  assert.equal(ledgerCount('show-503'), 1);
  // Restore the original session's view for the fenced-delete step.
  assert.equal((await session.renew()).status, 'committed');

  // 3) A fenced deletePresented against a stale expectation is rejected,
  // not lost, and leaves the presented scene in place.
  const stale = await session.deletePresented('scene-forest', 'delete-1');
  assert.equal(stale.status, 'rejected');
  assert.equal(stale.reason, 'presentation-changed');
  assert.equal(session.isLost(), false);
  assert.equal(
    JSON.parse(cli('GET', keys[0])).presentation.sceneId,
    'scene-tavern'
  );
});

/** A disposable Redis + serverless-redis-http pair; returns cli and REST. */
async function startRestRedis(t, label) {
  const suffix = randomUUID().slice(0, 8);
  const network = `rollkeeper-table-${label}-${suffix}`;
  const redisName = `rollkeeper-table-${label}-redis-${suffix}`;
  const srhName = `rollkeeper-table-${label}-srh-${suffix}`;
  execFileSync('docker', ['network', 'create', network], { stdio: 'ignore' });
  const cli = await startRedis(t, redisName, ['--network', network]);
  const srh = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      srhName,
      '--network',
      network,
      '-p',
      '127.0.0.1::80',
      '-e',
      'SRH_MODE=env',
      '-e',
      'SRH_TOKEN=synthetic_rest_token',
      '-e',
      `SRH_CONNECTION_STRING=redis://${redisName}:6379`,
      'hiett/serverless-redis-http:latest',
    ],
    { stdio: 'ignore' }
  );
  t.after(() => {
    for (const container of [srhName, redisName]) {
      try {
        execFileSync('docker', ['stop', container], { stdio: 'ignore' });
      } catch {}
    }
    srh.kill('SIGTERM');
    try {
      execFileSync('docker', ['network', 'rm', network], { stdio: 'ignore' });
    } catch {}
  });
  let url = null;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !url) {
    try {
      const port = execFileSync('docker', ['port', srhName, '80/tcp'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .trim()
        .split('\n')[0]
        .split(':')
        .at(-1);
      const probe = await fetch(`http://127.0.0.1:${port}/`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer synthetic_rest_token',
          'content-type': 'application/json',
        },
        body: '["PING"]',
      });
      if (probe.ok && (await probe.json()).result === 'PONG')
        url = `http://127.0.0.1:${port}`;
    } catch {}
    if (!url) await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(url, 'serverless-redis-http did not become ready');
  const { Redis } = await import('@upstash/redis');
  const rawRedis = new Redis({
    url,
    token: 'synthetic_rest_token',
    automaticDeserialization: false,
  });
  return { cli, rawRedis };
}

/**
 * PR05 S4 display capability against real Redis through the real REST client
 * (`@upstash/redis` → serverless-redis-http): lease-free rotation that keeps
 * the fenced command revision and TTL (M2/R4-F1), compare-if-unbound nonce
 * binding with control-PTTL expiry (E4/R4-F5), the exact ACK tuple (E7), DM
 * status computed with Redis TIME (E13), and generation precision through
 * later command commits plus the relay access Lua (M1/R4-F8).
 */
test('PR05 display capability: rotation, binding, ACK tuple, status and precision', async t => {
  const { cli, rawRedis } = await startRestRedis(t, 'display');
  const { TableControlService } = await import(
    '../src/lib/tableServer/control.ts'
  );
  const display = await import('../src/lib/tableServer/displayCapability.ts');
  const { DISPLAY_ROTATE_SCRIPT, DISPLAY_VERIFY_SCRIPT, DISPLAY_ACK_SCRIPT } =
    await import('../src/lib/tableServer/displayScripts.ts');
  const tableKeys = await import('../src/lib/tableServer/keys.ts');
  const controlKey = tableKeys.tableControlKey(CODE);
  const sessionKey = tableKeys.tableDisplaySessionKey(CODE);
  const ackKey = tableKeys.tableDisplayAckKey(CODE);
  assert.equal(controlKey, keys[0]);
  for (const key of [sessionKey, ackKey]) assert.ok(key.includes(TAG));
  const service = new TableControlService(rawRedis);
  const principal = {
    id: 'account:synthetic-owner',
    campaignCode: CODE,
    role: 'owner',
  };
  const ok = async command => {
    const result = await service.execute(principal, command);
    assert.equal(result.status, 'committed', JSON.stringify(result));
    return result.current;
  };
  const stored = () => JSON.parse(cli('GET', controlKey));
  const nonce = () => randomUUID().replace(/-/gu, '').slice(0, 22);
  const nonceA = nonce();
  const nonceB = nonce();

  assert.deepEqual(await display.rotateDisplayCapability(rawRedis, CODE), {
    status: 'not-initialized',
  });
  let current = await ok({ type: 'initialize', operationId: randomUUID() });
  assert.equal(stored().displayGeneration, 0);
  assert.equal(stored().displayCapabilityHash, null);
  const base = () => ({
    operationId: randomUUID(),
    expectedEpoch: current.epoch,
    expectedRevision: current.revision,
    expectedFence: current.writerFence,
    holderSessionId: 'mapless-holder',
  });
  current = await ok({ ...base(), type: 'acquire' });
  for (const [sceneId, sourceMapId, safeLabel] of [
    ['scene-tavern', 'map-tavern', 'Tavern'],
    ['scene-forest', 'map-forest', 'Private Forest'],
  ]) {
    current = await ok({
      ...base(),
      type: 'registerScene',
      sceneId,
      workspaceInstanceId: 'workspace-a',
      sourceMapId,
      contentRevision: 1,
      safeLabel,
      expectedRegistryRevision: 0,
    });
  }
  current = await ok({ ...base(), type: 'show', sceneId: 'scene-tavern' });
  current = await ok({
    ...base(),
    type: 'publishInitiative',
    runId: 'run-one',
    initiative: initiative(),
  });

  // M2 / R4-F1: rotation keeps the fenced command state and the TTL.
  cli('SET', sessionKey, '{"displayGeneration":0,"nonceHash":"x"}');
  cli('SET', ackKey, '{"v":1}');
  const before = stored();
  const pttlBefore = Number(cli('PTTL', controlKey));
  const joinBannerBefore = cli('GET', keys[5]);
  const preRotation = current;
  const first = await display.rotateDisplayCapability(rawRedis, CODE);
  assert.equal(first.status, 'rotated');
  assert.match(first.capability, /^[A-Za-z0-9_-]{43}$/u);
  assert.ok(Number.isSafeInteger(first.displayGeneration));
  assert.ok(first.displayGeneration >= 1 && first.displayGeneration < 1e14);
  const rotated = stored();
  assert.equal(
    rotated.displayCapabilityHash,
    createHash('sha256').update(first.capability, 'utf8').digest('hex')
  );
  assert.equal(rotated.displayGeneration, first.displayGeneration);
  for (const field of [
    'revision',
    'writerFence',
    'leaseUntil',
    'holderSessionId',
    'holderPrincipal',
    'epoch',
    'publicRunId',
  ])
    assert.deepEqual(rotated[field], before[field], field);
  assert.deepEqual(rotated.presentation, before.presentation);
  const pttlAfter = Number(cli('PTTL', controlKey));
  assert.ok(pttlAfter > 0 && pttlAfter <= pttlBefore, 'TTL is not extended');
  assert.equal(cli('EXISTS', sessionKey), '0');
  assert.equal(cli('EXISTS', ackKey), '0');
  assert.ok(!cli('KEYS', '*').includes(first.capability));
  // PR04 P1: the join-banner projection is untouched by rotation.
  assert.equal(cli('GET', keys[5]), joinBannerBefore);
  assert.equal(JSON.parse(joinBannerBefore).activeBattleMapId, 'map-tavern');
  // The mapless holder renews and publishes with its pre-rotation revision.
  current = await ok({
    operationId: randomUUID(),
    type: 'renew',
    expectedEpoch: preRotation.epoch,
    expectedRevision: preRotation.revision,
    expectedFence: preRotation.writerFence,
    holderSessionId: 'mapless-holder',
  });
  current = await ok({
    ...base(),
    type: 'publishInitiative',
    runId: 'run-one',
    initiative: { ...initiative(), round: 2 },
  });
  assert.equal(stored().displayGeneration, first.displayGeneration);

  // E4: first nonce wins, a second nonce is denied, the same nonce reloads.
  const verify = (capability, sessionNonce, bind) =>
    display.verifyDisplayCapability({
      rawRedis,
      code: CODE,
      capability,
      nonce: sessionNonce,
      bind,
    });
  const ackOf = (extra = {}) => ({
    displayGeneration: first.displayGeneration,
    epoch: current.epoch,
    presentationRevision: stored().presentation.revision,
    sceneId: 'scene-tavern',
    blanked: false,
    phase: 'loaded',
    ...extra,
  });
  const sendAck = (ack, sessionNonce = nonceA, capability = first.capability) =>
    display.recordDisplayAck({
      rawRedis,
      code: CODE,
      capability,
      nonce: sessionNonce,
      ack,
    });
  assert.deepEqual(await sendAck(ackOf()), { status: 'stale' });
  assert.equal((await verify(first.capability, nonceA, false)).status, 'stale');
  const bound = await verify(first.capability, nonceA, true);
  assert.equal(bound.status, 'ok');
  assert.equal(bound.displayGeneration, first.displayGeneration);
  const sessionTtl = Number(cli('PTTL', sessionKey));
  const controlTtl = Number(cli('PTTL', controlKey));
  assert.ok(
    Math.abs(controlTtl - sessionTtl) < 2_000,
    'binding follows control'
  );
  assert.deepEqual(await verify(first.capability, nonceB, true), {
    status: 'denied',
    httpStatus: 403,
    error: 'Display link is in use on another screen',
  });
  assert.equal((await verify(first.capability, nonceA, true)).status, 'ok');
  assert.equal((await verify(first.capability, nonceA, false)).status, 'ok');
  // Review 01 L6: every verified use re-sets the binding to the control PTTL.
  cli('PEXPIRE', sessionKey, '5000');
  assert.equal((await verify(first.capability, nonceA, false)).status, 'ok');
  assert.ok(
    Math.abs(
      Number(cli('PTTL', controlKey)) - Number(cli('PTTL', sessionKey))
    ) < 2_000,
    'verified use refreshes the binding expiry to the control PTTL'
  );

  // E7: the exact tuple is stored with Redis TIME and EX 30.
  const timeBefore = Number(cli('TIME').split('\n')[0]) * 1000;
  const recorded = await sendAck(ackOf());
  assert.equal(recorded.status, 'recorded');
  assert.ok(recorded.receivedAt >= timeBefore - 1_000);
  const record = JSON.parse(cli('GET', ackKey));
  assert.deepEqual(record, {
    v: 1,
    displayGeneration: first.displayGeneration,
    epoch: current.epoch,
    presentationRevision: stored().presentation.revision,
    sceneId: 'scene-tavern',
    blanked: false,
    phase: 'loaded',
    receivedAt: recorded.receivedAt,
  });
  const ackTtl = Number(cli('TTL', ackKey));
  assert.ok(ackTtl > 25 && ackTtl <= 30);
  assert.equal(
    (await display.readDisplayStatus(rawRedis, CODE)).display.state,
    'loaded'
  );

  cli('DEL', ackKey);
  for (const [label, ack, sessionNonce] of [
    ['stale revision', ackOf({ presentationRevision: 0 })],
    ['wrong epoch', ackOf({ epoch: randomUUID() })],
    ['wrong generation', ackOf({ displayGeneration: 1 })],
    ['other scene', ackOf({ sceneId: 'scene-forest' })],
    ['blank while visible', ackOf({ sceneId: null, phase: 'blank' })],
    ['claims blanked', ackOf({ blanked: true })],
    ['wrong nonce', ackOf(), nonceB],
  ]) {
    const result = await sendAck(ack, sessionNonce);
    assert.notEqual(result.status, 'recorded', label);
    assert.equal(cli('EXISTS', ackKey), '0', label);
  }
  current = await ok({ ...base(), type: 'blank' });
  assert.equal(
    (await sendAck(ackOf({ sceneId: null }))).status,
    'stale',
    'loaded while blanked'
  );
  assert.equal(
    (await sendAck(ackOf({ sceneId: null, blanked: true, phase: 'blank' })))
      .status,
    'recorded'
  );
  const blankStatus = (await display.readDisplayStatus(rawRedis, CODE)).display;
  assert.equal(blankStatus.state, 'blank');
  assert.equal(blankStatus.sceneId, null);
  assert.ok(blankStatus.ageMs >= 0 && blankStatus.ageMs < 15_000);

  // E13 with Redis TIME: updating (tuple differs), stale (>= 15 s), none.
  current = await ok({ ...base(), type: 'show', sceneId: 'scene-tavern' });
  assert.equal(
    (await display.readDisplayStatus(rawRedis, CODE)).display.state,
    'updating'
  );
  const nowMs = Number(cli('TIME').split('\n')[0]) * 1000;
  cli(
    'SET',
    ackKey,
    JSON.stringify({
      ...JSON.parse(cli('GET', ackKey)),
      receivedAt: nowMs - 16_000,
    }),
    'EX',
    '30'
  );
  const staleStatus = (await display.readDisplayStatus(rawRedis, CODE)).display;
  assert.equal(staleStatus.state, 'stale');
  assert.ok(staleStatus.ageMs >= 15_000);
  cli('DEL', ackKey);
  assert.deepEqual((await display.readDisplayStatus(rawRedis, CODE)).display, {
    state: 'none',
    sceneId: null,
    ageMs: null,
  });
  current = await ok({ ...base(), type: 'unpresent' });
  // Review 01 L9: loaded with a null scene while nothing is shown is stale.
  assert.equal(
    (await sendAck(ackOf({ sceneId: null, blanked: false, phase: 'loaded' })))
      .status,
    'stale'
  );
  assert.equal(
    (await sendAck(ackOf({ sceneId: null, phase: 'blank' }))).status,
    'recorded'
  );
  assert.equal(
    (await display.readDisplayStatus(rawRedis, CODE)).display.state,
    'waiting'
  );
  current = await ok({ ...base(), type: 'show', sceneId: 'scene-tavern' });

  // R4-F5: an expired binding answers stale; the descriptor re-binds; a
  // different nonce after expiry must win the descriptor bind first.
  cli('DEL', sessionKey);
  assert.equal((await sendAck(ackOf())).status, 'stale');
  assert.equal((await verify(first.capability, nonceA, true)).status, 'ok');
  assert.equal((await sendAck(ackOf())).status, 'recorded');
  cli('DEL', sessionKey);
  assert.equal((await sendAck(ackOf(), nonceB)).status, 'stale');
  assert.equal((await verify(first.capability, nonceB, true)).status, 'ok');
  assert.equal(
    (await verify(first.capability, nonceA, true)).error,
    'Display link is in use on another screen'
  );

  // Review 01 L14: a deleted presented entry projects to no scene in the
  // ACK and status scripts (the DM did not unpresent it yet).
  assert.equal(
    (await verify(first.capability, nonceA, true)).error,
    'Display link is in use on another screen'
  );
  cli('DEL', sessionKey);
  assert.equal((await verify(first.capability, nonceA, true)).status, 'ok');
  const registryKey = tableKeys.tableRegistryKey(CODE);
  const liveEntry = cli('HGET', registryKey, 'scene-tavern');
  cli(
    'HSET',
    registryKey,
    'scene-tavern',
    JSON.stringify({ ...JSON.parse(liveEntry), deleted: true })
  );
  assert.equal(stored().presentation.sceneId, 'scene-tavern');
  cli('DEL', ackKey);
  assert.equal((await sendAck(ackOf())).status, 'stale');
  assert.equal(
    (await sendAck(ackOf({ sceneId: null, phase: 'blank' }))).status,
    'recorded'
  );
  assert.equal(
    (await display.readDisplayStatus(rawRedis, CODE)).display.state,
    'waiting'
  );
  cli('HSET', registryKey, 'scene-tavern', liveEntry);

  // Rotation denies the old capability for descriptor, ACK and bind.
  const second = await display.rotateDisplayCapability(rawRedis, CODE);
  assert.equal(second.status, 'rotated');
  assert.notEqual(second.displayGeneration, first.displayGeneration);
  assert.equal(cli('EXISTS', sessionKey), '0');
  assert.equal(cli('EXISTS', ackKey), '0');
  for (const bind of [true, false])
    assert.equal(
      (await verify(first.capability, nonceB, bind)).error,
      'Display link expired'
    );
  assert.equal(
    (
      await sendAck(
        ackOf({ displayGeneration: first.displayGeneration }),
        nonceB,
        first.capability
      )
    ).error,
    'Display link expired'
  );
  assert.equal(cli('EXISTS', sessionKey), '0');
  // Review 01 L13: the scripts re-check the hash atomically even when the
  // TS pre-check is bypassed (a rotation between pre-check and script).
  const oldHash = createHash('sha256')
    .update(first.capability, 'utf8')
    .digest('hex');
  const nonceHashB = createHash('sha256').update(nonceB, 'utf8').digest('hex');
  assert.equal(
    JSON.parse(
      await rawRedis.eval(
        DISPLAY_VERIFY_SCRIPT,
        [controlKey, sessionKey, registryKey],
        [oldHash, nonceHashB, '1']
      )
    ).status,
    'expired'
  );
  assert.equal(cli('EXISTS', sessionKey), '0');
  assert.equal(
    JSON.parse(
      await rawRedis.eval(
        DISPLAY_ACK_SCRIPT,
        [controlKey, sessionKey, ackKey, registryKey],
        [
          oldHash,
          nonceHashB,
          JSON.stringify(ackOf({ displayGeneration: first.displayGeneration })),
        ]
      )
    ).status,
    'expired'
  );
  assert.equal(cli('EXISTS', ackKey), '0');

  // R4-F8: a near-maximum generation survives later command commits and the
  // relay access Lua compares it exactly.
  const MAX = 99999999999999;
  const maxHash = createHash('sha256')
    .update('precision', 'utf8')
    .digest('hex');
  assert.equal(
    JSON.parse(
      await rawRedis.eval(
        DISPLAY_ROTATE_SCRIPT,
        [controlKey, sessionKey, ackKey],
        [maxHash, String(MAX)]
      )
    ).displayGeneration,
    MAX
  );
  current = await ok({ ...base(), type: 'renew' });
  current = await ok({ ...base(), type: 'blank' });
  current = await ok({ ...base(), type: 'show', sceneId: 'scene-tavern' });
  assert.match(
    cli('GET', controlKey),
    /"displayGeneration":99999999999999[,}]/u
  );
  assert.equal(stored().displayGeneration, MAX);
  const relaySource = fs.readFileSync(
    new URL('../relay/src/authority-access.ts', import.meta.url),
    'utf8'
  );
  const accessLua = relaySource.match(
    /const ACCESS_LUA = String\.raw`([\s\S]*?)`;/u
  )?.[1];
  assert.ok(accessLua, 'relay ACCESS_LUA is readable');
  const roomId = JSON.parse(
    cli('HGET', tableKeys.tableRegistryKey(CODE), 'scene-tavern')
  ).roomId;
  const meta = tableKeys.tableAuthorityRoomKeys(CODE, roomId).meta;
  const roomGeneration = randomUUID();
  cli('SET', meta, JSON.stringify({ v: 1, generation: roomGeneration }));
  const access = async generation =>
    rawRedis.eval(
      accessLua,
      [controlKey, tableKeys.tableRegistryKey(CODE), meta],
      [
        JSON.stringify([
          {
            epoch: current.epoch,
            sceneId: 'scene-tavern',
            room: roomId,
            roomGeneration,
            role: 'display',
            displayGeneration: generation,
          },
        ]),
      ]
    );
  assert.deepEqual(await access(MAX), [1]);
  assert.deepEqual(await access(MAX - 1), [0]);
  assert.deepEqual(await access(second.displayGeneration), [0]);
});

/**
 * PR06 A1: one workspace session registers scenes through its own queue
 * against the real control Lua — no second acquire per scene, idempotent
 * re-preparation, identity conflicts and registry-full are not ownership
 * loss, and ownership loss still is.
 */
test('PR06 session registerScene: one acquire, many scenes, refusals not lost', async t => {
  const name = `rollkeeper-table-pr06-${randomUUID().slice(0, 8)}`;
  const cli = await startRedis(t, name);
  const { parseTableCommand } = await import(
    '../src/lib/tableServer/validation.ts'
  );
  const { acquireTableControl, prepareTableSceneRoom } = await import(
    '../src/lib/table/authorityLifecycle.ts'
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
        randomUUID(),
        new Date().toISOString()
      )
    );
  const sent = [];
  let initializes = 0;
  const fetcher = async (url, init) => {
    const href = String(url);
    if (!init?.method || init.method === 'GET') {
      const raw = cli('GET', keys[0]);
      const fields = cli('HGETALL', keys[1]).split('\n').filter(Boolean);
      const registry = [];
      for (let index = 1; index < fields.length; index += 2)
        registry.push(JSON.parse(fields[index]));
      return Response.json({
        current: raw ? JSON.parse(raw) : null,
        registry,
      });
    }
    if (href.endsWith('/authority/initialize-if-empty')) {
      initializes += 1;
      return Response.json({ status: 'provisioned' });
    }
    const command = parseTableCommand(JSON.parse(String(init.body)).command);
    if (!command) return Response.json({ error: 'invalid' }, { status: 400 });
    sent.push(command.type);
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
  const options = { campaignCode: CODE, dmId: 'dm-1', fetcher };
  const acquired = await acquireTableControl({
    ...options,
    holderSessionId: 'workspace-page',
  });
  assert.equal(acquired.status, 'acquired');
  const session = acquired.session;
  const room = sceneId => ({
    sceneId,
    sourceMapId: sceneId,
    workspaceInstanceId: 'workspace-a',
    contentRevision: 1,
    safeLabel: `Scene ${sceneId}`,
    canvasState: {},
  });

  for (let round = 0; round < 5; round += 1)
    for (const sceneId of ['scene-forest', 'scene-tavern'])
      assert.equal(
        (await prepareTableSceneRoom(session, room(sceneId), options)).status,
        'ready'
      );
  assert.deepEqual(
    sent.filter(type => type !== 'initialize'),
    ['acquire', 'registerScene', 'registerScene']
  );
  assert.equal(initializes, 10);
  const forest = JSON.parse(cli('HGET', keys[1], 'scene-forest'));
  assert.equal(forest.workspaceInstanceId, 'workspace-a');
  assert.equal(forest.registryRevision, 1);

  // Same-holder interleaved commit → one stale-control retry, committed.
  const interleaved = lua({
    type: 'renew',
    operationId: randomUUID(),
    expectedEpoch: session.current().epoch,
    expectedRevision: session.current().revision,
    expectedFence: session.current().writerFence,
    holderSessionId: 'workspace-page',
  });
  assert.equal(interleaved.status, 'committed');
  assert.equal(
    (await prepareTableSceneRoom(session, room('scene-cave'), options)).status,
    'ready'
  );
  assert.equal(session.isLost(), false);

  // A registry entry of another workspace → identity conflict, not lost.
  const conflict = await prepareTableSceneRoom(
    session,
    { ...room('scene-forest'), workspaceInstanceId: 'workspace-b' },
    options
  );
  assert.deepEqual(conflict, {
    status: 'conflict',
    reason: 'scene-identity-conflict',
  });
  assert.equal(session.isLost(), false);

  // Registry full (HLEN ≥ 100) → rejected, not lost.
  for (let index = 0; index < 100; index += 1)
    cli(
      'HSET',
      keys[1],
      `filler-${index}`,
      JSON.stringify({
        v: 1,
        sceneId: `filler-${index}`,
        workspaceInstanceId: 'workspace-a',
        sourceMapId: `filler-${index}`,
        registryRevision: 1,
        deleted: false,
      })
    );
  assert.deepEqual(
    await prepareTableSceneRoom(session, room('scene-overflow'), options),
    { status: 'rejected', reason: 'registry-full' }
  );
  assert.equal(session.isLost(), false);
  assert.equal((await session.renew()).status, 'committed');

  // Ownership loss (explicit takeover elsewhere) → lost.
  const latest = JSON.parse(cli('GET', keys[0]));
  assert.equal(
    lua({
      type: 'takeover',
      operationId: randomUUID(),
      expectedEpoch: latest.epoch,
      expectedRevision: latest.revision,
      expectedFence: latest.writerFence,
      holderSessionId: 'other-tab',
    }).status,
    'committed'
  );
  const lost = await prepareTableSceneRoom(session, room('scene-new'), {
    ...options,
  });
  assert.equal(lost.status, 'lost');
  assert.equal(session.isLost(), true);
  assert.equal(sent.filter(type => type === 'acquire').length, 1);
});
