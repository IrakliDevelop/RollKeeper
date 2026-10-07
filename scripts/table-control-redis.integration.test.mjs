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
