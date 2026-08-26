import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import test from 'node:test';

import { getLocalSupabaseTestConfig } from './local-supabase-env.mjs';

const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_ID = '20000000-0000-4000-8000-000000000002';

function jwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function userJwt(secret, userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = jwtPart({ alg: 'HS256', typ: 'JWT' });
  const payload = jwtPart({
    aud: 'authenticated',
    exp: now + 600,
    iat: now,
    iss: 'supabase-demo',
    role: 'authenticated',
    sub: userId,
  });
  return `${header}.${payload}.${createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')}`;
}

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

async function rpc(config, name, token, body, service = false) {
  const apiKey = service ? config.serviceRoleKey : config.anonKey;
  const response = await fetch(`${config.restUrl}/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token ?? apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

function calendarPayload(time, title = 'Festival') {
  return {
    config: {
      clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
      weekDays: [{ name: 'Firstday' }],
      months: [{ name: 'Dawn', days: 30 }],
      seasons: [],
      moons: [],
      namedYears: [],
      eras: [],
      yearOffset: 0,
      yearStartWeekdayOffset: 0,
      mechanics: {
        hoursPerLongRest: 8,
        minutesPerShortRest: 60,
        secondsPerRound: 6,
      },
    },
    currentTime: time,
    startTime: 0,
    weather: 'clear',
    events: [
      {
        id: 'evt-public',
        title,
        description: 'Known',
        year: 1,
        month: 0,
        day: 1,
        createdAt: 1,
        visibility: 'public',
      },
      {
        id: 'evt-private',
        title: 'Secret',
        description: 'Hidden',
        year: 1,
        month: 0,
        day: 2,
        createdAt: 2,
        visibility: 'private',
      },
    ],
  };
}

test('real calendar database enforces recovery staging, CAS, immutable history, isolation, enrollment, and projection leases', async () => {
  const config = getLocalSupabaseTestConfig();
  const owner = userJwt(config.jwtSecret, OWNER_ID);
  const other = userJwt(config.jwtSecret, OTHER_ID);
  const workspace = await rpc(config, 'create_campaign_workspace', owner, {
    p_mutation_id: randomUUID(),
    p_name: 'Calendar integration',
    p_creation_kind: 'new_workspace',
    p_source_fingerprint: null,
  });
  assert.equal(workspace.response.status, 200);
  const campaignId = workspace.body.campaignId;
  const legacyId = 'CAL123';
  const first = calendarPayload(0);
  const bytes = Buffer.byteLength(JSON.stringify(canonical(first)));
  const recovery = fingerprint({ recovery: true });
  const manifest = fingerprint({ family: 'calendar', legacyId });

  const denied = await rpc(config, 'begin_calendar_staging', other, {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_device_id: randomUUID(),
    p_expected_epoch: 0,
    p_manifest_fingerprint: manifest,
    p_recovery_manifest_hash: recovery,
    p_recovery_receipt_hash: recovery,
    p_record_count: 1,
    p_total_bytes: bytes,
  });
  assert.equal(denied.response.status, 403);

  const deviceId = randomUUID();
  const begin = await rpc(config, 'begin_calendar_staging', owner, {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_device_id: deviceId,
    p_expected_epoch: 0,
    p_manifest_fingerprint: manifest,
    p_recovery_manifest_hash: recovery,
    p_recovery_receipt_hash: recovery,
    p_record_count: 1,
    p_total_bytes: bytes,
  });
  assert.equal(begin.response.status, 200);
  const staged = await rpc(config, 'stage_calendar_items', owner, {
    p_mutation_id: randomUUID(),
    p_run_id: begin.body.runId,
    p_items: [
      {
        legacyId,
        schemaVersion: 1,
        payload: first,
        payloadFingerprint: fingerprint(first),
        tombstoned: false,
      },
    ],
  });
  assert.equal(staged.response.status, 200);
  const confirmMutation = randomUUID();
  const confirmBody = {
    p_mutation_id: confirmMutation,
    p_run_id: begin.body.runId,
    p_manifest_fingerprint: manifest,
    p_expected_epoch: 0,
  };
  const confirmations = await Promise.all([
    rpc(config, 'confirm_calendar_cutover', owner, confirmBody),
    rpc(config, 'confirm_calendar_cutover', owner, confirmBody),
  ]);
  assert.deepEqual(
    confirmations.map(value => value.response.status),
    [200, 200]
  );
  assert.deepEqual(confirmations[0].body, confirmations[1].body);

  const preview = await rpc(
    config,
    'preview_calendar_device_enrollment',
    owner,
    { p_campaign_id: campaignId }
  );
  assert.equal(preview.body.authority, 'postgres');
  const enrollment = await rpc(config, 'enroll_calendar_device', owner, {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_device_id: randomUUID(),
    p_expected_epoch: 1,
    p_preview_fingerprint: preview.body.previewFingerprint,
    p_legacy_candidate_fingerprint: fingerprint({ preserved: true }),
  });
  assert.equal(enrollment.response.status, 200);

  const left = calendarPayload(1, 'Left');
  const right = calendarPayload(2, 'Right');
  const makePut = payload => ({
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_expected_epoch: 1,
    p_legacy_id: legacyId,
    p_operation: 'replace',
    p_expected_server_version: 1,
    p_schema_version: 1,
    p_payload: payload,
    p_payload_fingerprint: fingerprint(payload),
  });
  const race = await Promise.all([
    rpc(config, 'put_calendar_document', owner, makePut(left)),
    rpc(config, 'put_calendar_document', owner, makePut(right)),
  ]);
  // PostgREST exposes PostgreSQL serialization failures as 500; the app route
  // deliberately translates SQLSTATE 40001 to the browser-facing 409 contract.
  assert.deepEqual(race.map(value => value.response.status).sort(), [200, 500]);
  const winner = race.find(value => value.response.status === 200);
  assert.equal(winner.body.serverVersion, 2);

  const replayBody = makePut(calendarPayload(3, 'Replay'));
  replayBody.p_expected_server_version = 2;
  const replayMutation = replayBody.p_mutation_id;
  const responseLoss = await Promise.all([
    rpc(config, 'put_calendar_document', owner, replayBody),
    rpc(config, 'put_calendar_document', owner, replayBody),
  ]);
  assert.deepEqual(
    responseLoss.map(value => value.response.status),
    [200, 200]
  );
  assert.equal(responseLoss[0].body.serverVersion, 3);
  assert.deepEqual(responseLoss[0].body, responseLoss[1].body);
  assert.equal(replayBody.p_mutation_id, replayMutation);

  const history = await rpc(config, 'list_calendar_document_versions', owner, {
    p_campaign_id: campaignId,
    p_legacy_id: legacyId,
  });
  assert.equal(history.response.status, 200);
  assert.deepEqual(
    history.body.versions.map(value => value.serverVersion),
    [3, 2, 1]
  );
  assert.equal('payload' in history.body.versions[0], false);
  const exact = await rpc(config, 'export_calendar_document_version', owner, {
    p_campaign_id: campaignId,
    p_legacy_id: legacyId,
    p_server_version: 1,
  });
  assert.equal(exact.body.payload.events[1].title, 'Secret');
  const otherHistory = await rpc(
    config,
    'list_calendar_document_versions',
    other,
    { p_campaign_id: campaignId, p_legacy_id: legacyId }
  );
  assert.equal(otherHistory.response.status, 403);

  const claimed = await rpc(
    config,
    'claim_calendar_projection_events',
    null,
    {
      p_worker_id: randomUUID(),
      p_limit: 20,
      p_lease_seconds: 30,
    },
    true
  );
  assert.equal(claimed.response.status, 200);
  const campaignClaims = claimed.body.filter(
    value => value.campaign_id === campaignId
  );
  assert.equal(
    campaignClaims.every(value => value.campaign_code === legacyId),
    true
  );
  assert.equal(campaignClaims.length, 3);
});
