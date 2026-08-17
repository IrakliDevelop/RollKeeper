import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import {
  getLocalSupabaseTestConfig,
  provisionLocalWorkspaceClaim,
  setLocalCharacterTombstone,
} from './local-supabase-env.mjs';

const USER_A_ID = '10000000-0000-4000-8000-000000000001';
const USER_B_ID = '20000000-0000-4000-8000-000000000002';
const CHARACTER_ID = 'a0000000-0000-4000-8000-000000000001';

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createUserJwt(secret, userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJwtPart({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJwtPart({
    aud: 'authenticated',
    exp: now + 300,
    iat: now,
    iss: 'supabase-demo',
    role: 'authenticated',
    sub: userId,
  });
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

async function request(config, path, { body, method = 'GET', token } = {}) {
  const response = await fetch(`${config.restUrl}${path}`, {
    method,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token ?? config.anonKey}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();

  return {
    body: text === '' ? null : JSON.parse(text),
    response,
  };
}

function putBody(mutationId, name, payload, clientRevision, expectedVersion) {
  return {
    p_character_id: CHARACTER_ID,
    p_client_revision: clientRevision,
    p_expected_server_version: expectedVersion,
    p_legacy_client_id: 'local-character-a',
    p_mutation_id: mutationId,
    p_name: name,
    p_payload: payload,
    p_schema_version: 1,
  };
}

test('local JWT clients enforce RLS, CAS receipts, and tombstones', async () => {
  const config = getLocalSupabaseTestConfig();
  const userAToken = createUserJwt(config.jwtSecret, USER_A_ID);
  const userBToken = createUserJwt(config.jwtSecret, USER_B_ID);
  const characterPath = `/characters?id=eq.${CHARACTER_ID}`;

  const anonymousRead = await request(config, characterPath);
  assert.ok(
    [401, 403].includes(anonymousRead.response.status),
    `anonymous read unexpectedly returned ${anonymousRead.response.status}`
  );

  const userARead = await request(config, characterPath, { token: userAToken });
  assert.equal(userARead.response.status, 200);
  assert.equal(userARead.body.length, 1);

  const userBRead = await request(config, characterPath, { token: userBToken });
  assert.equal(userBRead.response.status, 200);
  assert.deepEqual(userBRead.body, []);

  const concurrentBodies = [
    putBody(
      '40000000-0000-4000-8000-000000000001',
      'Concurrent A',
      { concurrent: 'a' },
      2,
      1
    ),
    putBody(
      '40000000-0000-4000-8000-000000000002',
      'Concurrent B',
      { concurrent: 'b' },
      2,
      1
    ),
  ];
  const concurrentResults = await Promise.all(
    concurrentBodies.map(body =>
      request(config, '/rpc/put_character', {
        body,
        method: 'POST',
        token: userAToken,
      })
    )
  );
  assert.deepEqual(concurrentResults.map(result => result.body.status).sort(), [
    'conflict',
    'success',
  ]);

  const responseLossBody = putBody(
    '40000000-0000-4000-8000-000000000003',
    'Committed response loss',
    { responseLoss: true },
    3,
    2
  );
  const ignoredCommittedResponse = await request(config, '/rpc/put_character', {
    body: responseLossBody,
    method: 'POST',
    token: userAToken,
  });
  assert.equal(ignoredCommittedResponse.response.status, 200);

  const retriedResponse = await request(config, '/rpc/put_character', {
    body: responseLossBody,
    method: 'POST',
    token: userAToken,
  });
  assert.deepEqual(retriedResponse.body, {
    characterId: CHARACTER_ID,
    serverVersion: 3,
    status: 'success',
  });

  const mismatchedReuse = await request(config, '/rpc/put_character', {
    body: { ...responseLossBody, p_name: 'Different reuse' },
    method: 'POST',
    token: userAToken,
  });
  assert.equal(mismatchedReuse.response.status, 400);
  assert.equal(
    mismatchedReuse.body.message,
    'mutation ID was already used with different input'
  );

  const receiptRead = await request(config, '/mutation_receipts', {
    token: userAToken,
  });
  assert.ok([401, 403].includes(receiptRead.response.status));

  const ownerReassignment = await request(config, characterPath, {
    body: { owner_id: USER_B_ID },
    method: 'PATCH',
    token: userAToken,
  });
  assert.equal(ownerReassignment.response.status, 403);
  assert.match(ownerReassignment.body.message, /permission denied/u);

  const tombstoneTimestamp = '2026-08-16T01:00:00+00:00';
  setLocalCharacterTombstone(CHARACTER_ID, tombstoneTimestamp);

  const resurrection = await request(config, '/rpc/put_character', {
    body: putBody(
      '40000000-0000-4000-8000-000000000004',
      'Resurrection attempt',
      { resurrected: true },
      4,
      3
    ),
    method: 'POST',
    token: userAToken,
  });
  assert.equal(resurrection.response.status, 200);
  assert.equal(resurrection.body.status, 'tombstoned');

  const tombstonedRead = await request(
    config,
    `${characterPath}&select=deleted_at,payload`,
    { token: userAToken }
  );
  assert.equal(tombstonedRead.body.length, 1);
  assert.equal(tombstonedRead.body[0].deleted_at, '2026-08-16T01:00:00+00:00');
  assert.deepEqual(tombstonedRead.body[0].payload, { responseLoss: true });

  const restoreBody = {
    p_character_id: CHARACTER_ID,
    p_expected_server_version: 3,
    p_mutation_id: '40000000-0000-4000-8000-000000000005',
  };
  const restored = await request(config, '/rpc/restore_character', {
    body: restoreBody,
    method: 'POST',
    token: userAToken,
  });
  assert.deepEqual(restored.body, {
    characterId: CHARACTER_ID,
    serverVersion: 4,
    status: 'success',
  });

  const archiveBody = {
    p_character_id: CHARACTER_ID,
    p_expected_server_version: 4,
    p_mutation_id: '40000000-0000-4000-8000-000000000006',
  };
  const archived = await request(config, '/rpc/soft_delete_character', {
    body: archiveBody,
    method: 'POST',
    token: userAToken,
  });
  assert.deepEqual(archived.body, {
    characterId: CHARACTER_ID,
    serverVersion: 5,
    status: 'success',
  });

  const archiveResponseLossRetry = await request(
    config,
    '/rpc/soft_delete_character',
    { body: archiveBody, method: 'POST', token: userAToken }
  );
  assert.deepEqual(archiveResponseLossRetry.body, archived.body);

  const crossAccountArchive = await request(
    config,
    '/rpc/soft_delete_character',
    {
      body: {
        ...archiveBody,
        p_expected_server_version: 5,
        p_mutation_id: '40000000-0000-4000-8000-000000000007',
      },
      method: 'POST',
      token: userBToken,
    }
  );
  assert.equal(crossAccountArchive.response.status, 200);
  assert.equal(crossAccountArchive.body.status, 'conflict');

  const archivedRead = await request(
    config,
    `${characterPath}&select=deleted_at,payload,server_version`,
    { token: userAToken }
  );
  assert.equal(archivedRead.body[0].server_version, 5);
  assert.notEqual(archivedRead.body[0].deleted_at, null);
  assert.deepEqual(archivedRead.body[0].payload, { responseLoss: true });
});

test('DM workspace RPCs isolate accounts and serialize a one-time ownership claim race', async () => {
  const config = getLocalSupabaseTestConfig();
  const userAToken = createUserJwt(config.jwtSecret, USER_A_ID);
  const userBToken = createUserJwt(config.jwtSecret, USER_B_ID);

  const created = await request(config, '/rpc/create_campaign_workspace', {
    method: 'POST',
    token: userAToken,
    body: {
      p_mutation_id: '70000000-0000-4000-8000-000000000001',
      p_name: 'Integration workspace',
      p_creation_kind: 'new_workspace',
      p_source_fingerprint: null,
    },
  });
  assert.equal(created.response.status, 200);
  assert.equal(created.body.membershipAuthority, 'legacy');
  assert.equal(created.body.familyAuthorities, 'legacy');
  assert.equal(created.body.liveRuntimeAuthority, 'redis_relay');

  const userBWorkspaceRead = await request(
    config,
    `/campaigns?id=eq.${created.body.campaignId}`,
    { token: userBToken }
  );
  assert.equal(userBWorkspaceRead.response.status, 200);
  assert.deepEqual(userBWorkspaceRead.body, []);

  const authorityRead = await request(
    config,
    `/campaign_authority_records?campaign_id=eq.${created.body.campaignId}`,
    { token: userAToken }
  );
  assert.equal(authorityRead.response.status, 200);
  assert.equal(authorityRead.body.length, 11);
  assert.equal(
    authorityRead.body.filter(
      row => row.axis === 'durable_family' && row.authority === 'legacy'
    ).length,
    8
  );

  const sourceFingerprint = 'e'.repeat(64);
  const proofToken = 'synthetic-manual-proof-token';
  provisionLocalWorkspaceClaim({
    authorizationId: '71000000-0000-4000-8000-000000000001',
    claimantId: USER_A_ID,
    sourceFingerprint,
    token: proofToken,
  });
  const raceBodies = [
    '72000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000002',
  ].map(mutationId => ({
    p_authorization_token: proofToken,
    p_legacy_source_fingerprint: sourceFingerprint,
    p_mutation_id: mutationId,
    p_name: 'Manually verified workspace',
  }));
  const race = await Promise.all(
    raceBodies.map(body =>
      request(config, '/rpc/claim_campaign_workspace', {
        method: 'POST',
        token: userAToken,
        body,
      })
    )
  );
  assert.deepEqual(
    race.map(result => result.response.status).sort((a, b) => a - b),
    [200, 403]
  );
  const winnerIndex = race.findIndex(result => result.response.status === 200);
  const replay = await request(config, '/rpc/claim_campaign_workspace', {
    method: 'POST',
    token: userAToken,
    body: raceBodies[winnerIndex],
  });
  assert.equal(replay.response.status, 200);
  assert.deepEqual(replay.body, race[winnerIndex].body);

  const losingReuse = await request(config, '/rpc/claim_campaign_workspace', {
    method: 'POST',
    token: userAToken,
    body: raceBodies[1 - winnerIndex],
  });
  assert.equal(losingReuse.response.status, 403);
  assert.equal(
    losingReuse.body.message,
    'workspace ownership proof was not accepted'
  );
});
