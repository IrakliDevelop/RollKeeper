import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import {
  getLocalSupabaseTestConfig,
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
});
