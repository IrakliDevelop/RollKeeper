import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

import { getLocalSupabaseTestConfig } from './local-supabase-env.mjs';

const PORT = 3125;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonical(value[key])])
  );
}

function fingerprint(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/dm`);
      if (response.status < 500) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(
    'Campaign settings HTTP integration server did not become ready'
  );
}

async function authenticatedCookie(config, email, password) {
  const values = new Map();
  const client = createServerClient(config.apiUrl, config.publishableKey, {
    cookies: {
      getAll: () => [],
      setAll: cookies =>
        cookies.forEach(cookie => values.set(cookie.name, cookie.value)),
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  assert.ifError(error);
  assert.ok(data.session);
  await new Promise(resolve => setImmediate(resolve));
  if (values.size === 0) {
    const storageKey = `sb-${new URL(config.apiUrl).hostname.split('.')[0]}-auth-token`;
    const encoded = `base64-${Buffer.from(JSON.stringify(data.session)).toString('base64url')}`;
    for (
      let offset = 0, index = 0;
      offset < encoded.length;
      offset += 3180, index += 1
    ) {
      values.set(
        index === 0 && encoded.length <= 3180
          ? storageKey
          : `${storageKey}.${index}`,
        encoded.slice(offset, offset + 3180)
      );
    }
  }
  return {
    cookie: [...values].map(([name, value]) => `${name}=${value}`).join('; '),
    session: data.session,
  };
}

async function rpc(config, name, accessToken, body) {
  const response = await fetch(`${config.restUrl}/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

async function action(cookie, body, headers = {}) {
  const response = await fetch(`${ORIGIN}/api/campaign-settings`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      'x-rollkeeper-csrf': '1',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

test('real HTTP Slice 11A routes enforce cookie owner auth, Origin/CSRF, replay, and cloud-vs-player status', async t => {
  const config = getLocalSupabaseTestConfig();
  const admin = createClient(config.apiUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const password = `Synthetic-${randomBytes(18).toString('base64url')}!9`;
  const ownerEmail = `slice11a-owner-${suffix}@example.test`;
  const otherEmail = `slice11a-other-${suffix}@example.test`;
  for (const email of [ownerEmail, otherEmail]) {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(error);
  }
  const owner = await authenticatedCookie(config, ownerEmail, password);
  const other = await authenticatedCookie(config, otherEmail, password);

  const child = spawn('npm', ['run', 'dev', '--', '--port', String(PORT)], {
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: config.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
      NEXT_PUBLIC_SUPABASE_AUTH_ENABLED: 'true',
      SUPABASE_SERVICE_ROLE_KEY: config.serviceRoleKey,
      SUPABASE_CAMPAIGN_SETTINGS_SYNC_ENABLED: 'true',
      NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE: 'true',
      CAMPAIGN_SETTINGS_PROJECTION_WORKER_ENABLED: 'false',
      UPSTASH_REDIS_REST_URL: 'http://127.0.0.1:6399',
      UPSTASH_REDIS_REST_TOKEN: 'synthetic-local-disabled-worker',
      NEXT_PUBLIC_RELAY_URL: 'ws://127.0.0.1:6398',
    },
    stdio: 'ignore',
  });
  t.after(() => child.kill('SIGTERM'));
  await waitForServer();

  const workspace = await rpc(
    config,
    'create_campaign_workspace',
    owner.session.access_token,
    {
      p_mutation_id: randomUUID(),
      p_name: 'Settings HTTP workspace',
      p_creation_kind: 'new_workspace',
      p_source_fingerprint: null,
    }
  );
  assert.equal(workspace.response.status, 200);
  const campaignId = workspace.body.campaignId;
  const legacyId = workspace.body.displayCode;
  const payload = {
    customCounterLabel: 'Momentum',
    playerCounters: { synthetic: 1 },
    stackableInspiration: true,
  };
  const payloadFingerprint = fingerprint(payload);
  const manifestFingerprint = fingerprint({
    family: 'campaign_settings',
    legacyId,
    payloadFingerprint,
  });
  const recoveryFingerprint = fingerprint({ synthetic: 'downloaded-recovery' });
  const deviceId = randomUUID();

  const missingCsrf = await action(
    owner.cookie,
    { action: 'preview-enrollment', campaignId },
    { 'x-rollkeeper-csrf': '' }
  );
  assert.equal(missingCsrf.response.status, 403);
  const wrongOrigin = await action(
    owner.cookie,
    { action: 'preview-enrollment', campaignId },
    { Origin: 'http://127.0.0.1:9' }
  );
  assert.equal(wrongOrigin.response.status, 403);

  const begin = await action(owner.cookie, {
    action: 'begin-staging',
    mutationId: randomUUID(),
    campaignId,
    deviceId,
    expectedEpoch: 0,
    manifestFingerprint,
    recoveryManifestHash: recoveryFingerprint,
    recoveryReceiptHash: recoveryFingerprint,
    recordCount: 1,
    totalBytes: Buffer.byteLength(JSON.stringify(canonical(payload))),
  });
  assert.equal(begin.response.status, 200, JSON.stringify(begin.body));
  const staged = await action(owner.cookie, {
    action: 'stage-items',
    mutationId: randomUUID(),
    runId: begin.body.runId,
    items: [
      {
        legacyId,
        schemaVersion: 1,
        payload,
        payloadFingerprint,
        tombstoned: false,
      },
    ],
  });
  assert.equal(staged.response.status, 200);
  const cutoverMutation = randomUUID();
  const cutoverBody = {
    action: 'confirm-cutover',
    mutationId: cutoverMutation,
    runId: begin.body.runId,
    manifestFingerprint,
    expectedEpoch: 0,
  };
  const cutover = await action(owner.cookie, cutoverBody);
  const cutoverReplay = await action(owner.cookie, cutoverBody);
  assert.equal(cutover.response.status, 200);
  assert.deepEqual(cutoverReplay.body, cutover.body);

  const otherHistory = await action(other.cookie, {
    action: 'history',
    campaignId,
    legacyId,
  });
  assert.equal(otherHistory.response.status, 403);
  const history = await action(owner.cookie, {
    action: 'history',
    campaignId,
    legacyId,
  });
  assert.equal(history.response.status, 200);
  assert.equal(
    JSON.stringify(history.body).includes('stackableInspiration'),
    false
  );

  const nextPayload = { ...payload, stackableInspiration: false };
  const putBody = {
    action: 'put',
    mutationId: randomUUID(),
    campaignId,
    expectedEpoch: 1,
    legacyId,
    operation: 'replace',
    expectedServerVersion: 1,
    schemaVersion: 1,
    payload: nextPayload,
    payloadFingerprint: fingerprint(nextPayload),
  };
  const saved = await action(owner.cookie, putBody);
  const replayed = await action(owner.cookie, putBody);
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.cloudSaved, true);
  assert.equal(saved.body.playerView, 'pending');
  assert.deepEqual(replayed.body, saved.body);

  const removedDevice = await action(owner.cookie, {
    action: 'remove-device',
    mutationId: randomUUID(),
    campaignId,
    deviceId,
    expectedEpoch: 1,
  });
  assert.equal(removedDevice.response.status, 200);
  assert.equal(removedDevice.body.state, 'removed');
});
