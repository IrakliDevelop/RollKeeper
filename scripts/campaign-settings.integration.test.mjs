import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  corruptLocalCampaignSettingsCurrentForTest,
  getLocalSupabaseTestConfig,
} from './local-supabase-env.mjs';

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

test('real database enforces Slice 11A atomicity, CAS, history, enrollment, projection leases, repair, and rollback', async () => {
  const config = getLocalSupabaseTestConfig();
  const owner = userJwt(config.jwtSecret, OWNER_ID);
  const other = userJwt(config.jwtSecret, OTHER_ID);
  const workspace = await rpc(config, 'create_campaign_workspace', owner, {
    p_mutation_id: randomUUID(),
    p_name: 'Durable settings integration',
    p_creation_kind: 'new_workspace',
    p_source_fingerprint: null,
  });
  assert.equal(workspace.response.status, 200);
  const campaignId = workspace.body.campaignId;
  const legacyId = 'ABC123';

  const denied = await rpc(
    config,
    'preview_campaign_settings_device_enrollment',
    other,
    { p_campaign_id: campaignId }
  );
  assert.equal(denied.response.status, 403);

  const recovery = fingerprint({ synthetic: 'recovery' });
  const manifest = fingerprint({ legacyId, recordCount: 1 });
  const firstPayload = {
    bannerUrl: null,
    customCounterLabel: 'Momentum',
    playerCounters: { player: 1 },
    stackableInspiration: true,
  };
  const firstPayloadBytes = Buffer.byteLength(
    JSON.stringify(canonical(firstPayload))
  );
  const mismatchedRecovery = await rpc(
    config,
    'begin_campaign_settings_staging',
    owner,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_device_id: randomUUID(),
      p_expected_epoch: 0,
      p_manifest_fingerprint: manifest,
      p_recovery_manifest_hash: recovery,
      p_recovery_receipt_hash: 'f'.repeat(64),
      p_record_count: 1,
      p_total_bytes: firstPayloadBytes,
    }
  );
  assert.equal(mismatchedRecovery.response.status, 400);

  const begin = await rpc(config, 'begin_campaign_settings_staging', owner, {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_device_id: randomUUID(),
    p_expected_epoch: 0,
    p_manifest_fingerprint: manifest,
    p_recovery_manifest_hash: recovery,
    p_recovery_receipt_hash: recovery,
    p_record_count: 1,
    p_total_bytes: firstPayloadBytes,
  });
  assert.equal(begin.response.status, 200);
  const stageBody = {
    p_mutation_id: randomUUID(),
    p_run_id: begin.body.runId,
    p_items: [
      {
        legacyId,
        schemaVersion: 1,
        payload: firstPayload,
        payloadFingerprint: fingerprint(firstPayload),
        tombstoned: false,
      },
    ],
  };
  const stage = await rpc(
    config,
    'stage_campaign_settings_items',
    owner,
    stageBody
  );
  assert.equal(stage.response.status, 200);

  const confirmBody = {
    p_mutation_id: randomUUID(),
    p_run_id: begin.body.runId,
    p_manifest_fingerprint: manifest,
    p_expected_epoch: 0,
  };
  const confirmations = await Promise.all([
    rpc(config, 'confirm_campaign_settings_cutover', owner, confirmBody),
    rpc(config, 'confirm_campaign_settings_cutover', owner, confirmBody),
  ]);
  assert.deepEqual(
    confirmations.map(value => value.response.status),
    [200, 200]
  );
  assert.deepEqual(confirmations[0].body, confirmations[1].body);
  const changedReplay = await rpc(
    config,
    'confirm_campaign_settings_cutover',
    owner,
    { ...confirmBody, p_manifest_fingerprint: 'e'.repeat(64) }
  );
  assert.equal(changedReplay.response.status, 400);

  const preview = await rpc(
    config,
    'preview_campaign_settings_device_enrollment',
    owner,
    { p_campaign_id: campaignId }
  );
  assert.equal(preview.body.authority, 'postgres');
  const enrollmentBody = {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_device_id: randomUUID(),
    p_expected_epoch: 1,
    p_preview_fingerprint: preview.body.previewFingerprint,
    p_legacy_candidate_fingerprint: fingerprint({ candidate: 'preserved' }),
  };
  const enrollments = await Promise.all([
    rpc(config, 'enroll_campaign_settings_device', owner, enrollmentBody),
    rpc(config, 'enroll_campaign_settings_device', owner, enrollmentBody),
  ]);
  assert.deepEqual(
    enrollments.map(value => value.response.status),
    [200, 200]
  );

  const secondPayload = {
    customCounterLabel: 'Resolve',
    playerCounters: { player: 2 },
    stackableInspiration: false,
  };
  const putMutation = randomUUID();
  const putBody = {
    p_mutation_id: putMutation,
    p_campaign_id: campaignId,
    p_family: 'campaign_settings',
    p_expected_epoch: 1,
    p_legacy_id: legacyId,
    p_operation: 'replace',
    p_expected_server_version: 1,
    p_schema_version: 1,
    p_payload: secondPayload,
    p_payload_fingerprint: fingerprint(secondPayload),
  };
  const responseLossReplay = await Promise.all([
    rpc(config, 'put_campaign_document', owner, putBody),
    rpc(config, 'put_campaign_document', owner, putBody),
  ]);
  assert.deepEqual(
    responseLossReplay.map(value => value.response.status),
    [200, 200]
  );
  assert.deepEqual(responseLossReplay[0].body, responseLossReplay[1].body);
  const changedPutReplay = await rpc(config, 'put_campaign_document', owner, {
    ...putBody,
    p_payload: { ...secondPayload, stackableInspiration: true },
  });
  assert.equal(changedPutReplay.response.status, 400);

  const race = await Promise.all([
    rpc(config, 'put_campaign_document', owner, {
      ...putBody,
      p_mutation_id: randomUUID(),
      p_expected_server_version: 2,
      p_payload: { ...secondPayload, playerCounters: { player: 3 } },
      p_payload_fingerprint: fingerprint({
        ...secondPayload,
        playerCounters: { player: 3 },
      }),
    }),
    rpc(config, 'put_campaign_document', owner, {
      ...putBody,
      p_mutation_id: randomUUID(),
      p_expected_server_version: 2,
      p_payload: { ...secondPayload, playerCounters: { player: 4 } },
      p_payload_fingerprint: fingerprint({
        ...secondPayload,
        playerCounters: { player: 4 },
      }),
    }),
  ]);
  assert.deepEqual(race.map(value => value.response.status).sort(), [200, 500]);
  const acceptedRace = race.find(value => value.response.status === 200).body;
  assert.equal(acceptedRace.serverVersion, 3);

  const history = await rpc(config, 'list_campaign_document_versions', owner, {
    p_campaign_id: campaignId,
    p_family: 'campaign_settings',
    p_legacy_id: legacyId,
  });
  assert.equal(history.body.versions.length, 3);
  assert.equal(
    JSON.stringify(history.body).includes('stackableInspiration'),
    false
  );
  const comparison = await rpc(
    config,
    'compare_campaign_document_versions',
    owner,
    {
      p_campaign_id: campaignId,
      p_family: 'campaign_settings',
      p_legacy_id: legacyId,
      p_left: 1,
      p_right: 3,
    }
  );
  assert.equal(comparison.body.identical, false);

  const tombstoneFingerprint = fingerprint({ legacyId, tombstoned: true });
  const removed = await rpc(config, 'put_campaign_document', owner, {
    ...putBody,
    p_mutation_id: randomUUID(),
    p_operation: 'delete',
    p_expected_server_version: 3,
    p_payload: null,
    p_payload_fingerprint: tombstoneFingerprint,
  });
  assert.equal(removed.body.serverVersion, 4);
  assert.equal(removed.body.playerView, 'pending');
  const restored = await rpc(
    config,
    'restore_campaign_document_version',
    owner,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_family: 'campaign_settings',
      p_expected_epoch: 1,
      p_legacy_id: legacyId,
      p_source_version: 1,
      p_expected_server_version: 4,
    }
  );
  assert.equal(restored.body.serverVersion, 5);
  assert.equal(restored.body.restoredFromVersion, 1);

  const claimWorker = randomUUID();
  const claimed = await rpc(
    config,
    'claim_campaign_document_projection_events',
    config.serviceRoleKey,
    {
      p_worker_id: claimWorker,
      p_limit: 100,
      p_lease_seconds: 30,
    },
    true
  );
  assert.equal(claimed.response.status, 200);
  assert.ok(claimed.body.length >= 5);
  assert.ok(
    claimed.body.every(event => event.campaign_code === legacyId),
    'projection events target the preserved legacy compatibility code, not the cloud workspace display code'
  );
  const competingClaim = await rpc(
    config,
    'claim_campaign_document_projection_events',
    config.serviceRoleKey,
    {
      p_worker_id: randomUUID(),
      p_limit: 100,
      p_lease_seconds: 30,
    },
    true
  );
  assert.deepEqual(competingClaim.body, []);
  const [poisonedEvent, ...healthyEvents] = claimed.body;
  const poisoned = await rpc(
    config,
    'fail_campaign_document_projection_event',
    config.serviceRoleKey,
    {
      p_event_id: poisonedEvent.event_id,
      p_worker_id: claimWorker,
      p_error_code: 'synthetic-poison',
      p_incident_kind: 'poison_event',
    },
    true
  );
  assert.equal(poisoned.response.status, 204);
  for (const event of healthyEvents) {
    assert.equal(event.legacy_id, legacyId);
    const acknowledged = await rpc(
      config,
      'ack_campaign_document_projection_event',
      config.serviceRoleKey,
      {
        p_event_id: event.event_id,
        p_worker_id: claimWorker,
        p_projection_fingerprint: fingerprint({ event: event.event_id }),
      },
      true
    );
    assert.equal(acknowledged.response.status, 204);
    const replayedAck = await rpc(
      config,
      'ack_campaign_document_projection_event',
      config.serviceRoleKey,
      {
        p_event_id: event.event_id,
        p_worker_id: claimWorker,
        p_projection_fingerprint: fingerprint({ event: event.event_id }),
      },
      true
    );
    assert.equal(replayedAck.response.status, 204);
  }

  const incidents = await rpc(
    config,
    'list_campaign_document_projection_incidents',
    owner,
    { p_campaign_id: campaignId, p_family: 'campaign_settings' }
  );
  assert.equal(incidents.body.incidents.length, 1);
  const replay = await rpc(
    config,
    'replay_campaign_document_projection_event',
    owner,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_expected_epoch: 1,
      p_event_id: poisonedEvent.event_id,
    }
  );
  assert.equal(replay.body.state, 'queued');
  const replayWorker = randomUUID();
  const replayClaim = await rpc(
    config,
    'claim_campaign_document_projection_events',
    config.serviceRoleKey,
    { p_worker_id: replayWorker, p_limit: 10, p_lease_seconds: 30 },
    true
  );
  assert.equal(replayClaim.body.length, 1);
  await rpc(
    config,
    'ack_campaign_document_projection_event',
    config.serviceRoleKey,
    {
      p_event_id: poisonedEvent.event_id,
      p_worker_id: replayWorker,
      p_projection_fingerprint: fingerprint({ replayed: true }),
    },
    true
  );

  const currentStatus = await rpc(
    config,
    'campaign_document_projection_status',
    owner,
    { p_campaign_id: campaignId, p_family: 'campaign_settings' }
  );
  assert.equal(currentStatus.body.status, 'current');

  corruptLocalCampaignSettingsCurrentForTest(campaignId);
  const repaired = await rpc(
    config,
    'repair_campaign_document_current_from_history',
    owner,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_family: 'campaign_settings',
      p_expected_epoch: 1,
      p_legacy_id: legacyId,
      p_expected_latest_version: 5,
      p_expected_latest_fingerprint: fingerprint(firstPayload),
    }
  );
  assert.equal(repaired.body.recoveredFromHistory, true);
  const exact = await rpc(config, 'export_campaign_document_version', owner, {
    p_campaign_id: campaignId,
    p_family: 'campaign_settings',
    p_legacy_id: legacyId,
    p_server_version: 5,
  });
  assert.deepEqual(exact.body.payload, firstPayload);

  const repairWorker = randomUUID();
  const repairProjection = await rpc(
    config,
    'claim_campaign_document_projection_events',
    config.serviceRoleKey,
    {
      p_worker_id: repairWorker,
      p_limit: 10,
      p_lease_seconds: 30,
    },
    true
  );
  assert.equal(repairProjection.body.length, 1);
  await rpc(
    config,
    'ack_campaign_document_projection_event',
    config.serviceRoleKey,
    {
      p_event_id: repairProjection.body[0].event_id,
      p_worker_id: repairWorker,
      p_projection_fingerprint: fingerprint({ repaired: true }),
    },
    true
  );

  const rollbackPreview = await rpc(
    config,
    'preview_campaign_settings_device_enrollment',
    owner,
    { p_campaign_id: campaignId }
  );
  const rollbackBody = {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_expected_epoch: 1,
    p_manifest_fingerprint: rollbackPreview.body.previewFingerprint,
    p_current_generation: {
      legacyId,
      fingerprint: rollbackPreview.body.payloadFingerprint,
      serverVersion: rollbackPreview.body.serverVersion,
    },
    p_projection_journal_reconciled: true,
  };
  const rollbackReplay = await Promise.all([
    rpc(config, 'rollback_campaign_settings_family', owner, rollbackBody),
    rpc(config, 'rollback_campaign_settings_family', owner, rollbackBody),
  ]);
  assert.deepEqual(
    rollbackReplay.map(value => value.response.status),
    [200, 200]
  );
  assert.equal(rollbackReplay[0].body.epoch, 2);
  assert.deepEqual(rollbackReplay[0].body, rollbackReplay[1].body);

  const deniedHistory = await rpc(
    config,
    'list_campaign_document_versions',
    other,
    {
      p_campaign_id: campaignId,
      p_family: 'campaign_settings',
      p_legacy_id: legacyId,
    }
  );
  assert.equal(deniedHistory.response.status, 403);
});
