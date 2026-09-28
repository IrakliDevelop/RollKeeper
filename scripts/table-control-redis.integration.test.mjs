import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { promisify } from 'node:util';

const execAsync = promisify(execFile);
const CONTAINER = `rollkeeper-table-control-${randomUUID().slice(0, 8)}`;
const CODE = 'SYNTH03A';
const keys = [
  `campaign:${CODE}:table-control`,
  `campaign:${CODE}:table-scenes`,
  `campaign:${CODE}:table-operations`,
  `campaign:${CODE}:table-operations-order`,
  `campaign:${CODE}:shared:initiative`,
  `campaign:${CODE}:shared:battlemap`,
  `campaign:${CODE}:shared:initiativeRequest`,
];
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
