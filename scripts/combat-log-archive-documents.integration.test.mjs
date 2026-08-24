import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import test from 'node:test';

import { getLocalSupabaseTestConfig } from './local-supabase-env.mjs';

const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_ID = '20000000-0000-4000-8000-000000000002';
const COMBAT_LOG_ARCHIVE_SCHEMA_VERSION = 2;

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

function canonicalBytes(value) {
  return Buffer.byteLength(JSON.stringify(canonical(value)));
}

async function rpc(config, name, token, body) {
  const response = await fetch(`${config.restUrl}/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token ?? config.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

// Mirrors the pgTAP fixture in supabase/tests/combat_log_archive_documents.test.sql
// (clog_fixture 'arc-a') field-for-field: one event of each shape the
// per-discriminator allowlist accepts (combat_start, damage, condition_applied,
// combat_end), so a real payload the browser would produce round-trips intact.
function ashfallArchive(endedAt, extraEvent) {
  const events = [
    {
      id: 'ev-1',
      timestamp: '2026-08-01T18:00:05.000Z',
      round: 1,
      turn: 0,
      encounterId: 'enc-ashfall',
      type: 'combat_start',
      participantNames: ['Sera Vale', 'Ash the Cult Prophet'],
    },
    {
      id: 'ev-2',
      timestamp: '2026-08-01T18:01:00.000Z',
      round: 1,
      turn: 1,
      encounterId: 'enc-ashfall',
      type: 'damage',
      sourceId: 'ent-player-1',
      sourceName: 'Sera Vale',
      targetId: 'ent-npc-1',
      targetName: 'Ash the Cult Prophet',
      amount: 12,
      damageType: 'radiant',
      isCritical: true,
      weaponOrSpellName: 'Sunblade',
    },
    {
      id: 'ev-3',
      timestamp: '2026-08-01T18:02:00.000Z',
      round: 1,
      turn: 2,
      encounterId: 'enc-ashfall',
      type: 'condition_applied',
      targetId: 'ent-player-1',
      targetName: 'Sera Vale',
      conditionName: 'Prone',
    },
    {
      id: 'ev-4',
      timestamp: '2026-08-01T18:41:00.000Z',
      round: 4,
      turn: 0,
      encounterId: 'enc-ashfall',
      type: 'combat_end',
      participantNames: ['Sera Vale'],
      endReason: 'victory',
    },
  ];
  if (extraEvent) events.push(extraEvent);
  return {
    encounterId: 'enc-ashfall',
    startedAt: '2026-08-01T18:00:00.000Z',
    endedAt,
    events,
  };
}

function minimalArchive(startedAt, endedAt) {
  return {
    encounterId: 'enc-ashfall',
    startedAt,
    endedAt,
    events: [],
  };
}

test('real combat log archive database enforces multi-record staging, CAS races, mutation replay, immutable history, isolation, enrollment, and rollback without projection', async () => {
  const config = getLocalSupabaseTestConfig();
  const owner = userJwt(config.jwtSecret, OWNER_ID);
  const other = userJwt(config.jwtSecret, OTHER_ID);
  const workspace = await rpc(config, 'create_campaign_workspace', owner, {
    p_mutation_id: randomUUID(),
    p_name: 'Combat log archive integration',
    p_creation_kind: 'new_workspace',
    p_source_fingerprint: null,
  });
  assert.equal(workspace.response.status, 200);
  const campaignId = workspace.body.campaignId;
  const primaryId = 'arc-a';
  const secondaryId = 'arc-b';
  // Ruling 3 (staging blocker): every staged archive must already be closed
  // (a non-null endedAt), so both fixtures below carry one.
  const first = ashfallArchive('2026-08-01T18:42:00.000Z');
  const second = minimalArchive(
    '2026-08-02T18:00:00.000Z',
    '2026-08-02T18:05:00.000Z'
  );
  const totalBytes = canonicalBytes(first) + canonicalBytes(second);
  const recovery = fingerprint({ recovery: true });
  const manifest = fingerprint({ family: 'combat_log_archive', campaignId });

  const denied = await rpc(config, 'begin_combat_log_archive_staging', other, {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_device_id: randomUUID(),
    p_expected_epoch: 0,
    p_manifest_fingerprint: manifest,
    p_recovery_manifest_hash: recovery,
    p_recovery_receipt_hash: recovery,
    p_record_count: 2,
    p_total_bytes: totalBytes,
  });
  assert.equal(denied.response.status, 403);
  assert.equal(denied.body.message, 'campaign owner authorization is required');

  const deviceId = randomUUID();
  const begin = await rpc(config, 'begin_combat_log_archive_staging', owner, {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_device_id: deviceId,
    p_expected_epoch: 0,
    p_manifest_fingerprint: manifest,
    p_recovery_manifest_hash: recovery,
    p_recovery_receipt_hash: recovery,
    p_record_count: 2,
    p_total_bytes: totalBytes,
  });
  assert.equal(begin.response.status, 200);

  const staged = await rpc(config, 'stage_combat_log_archive_items', owner, {
    p_mutation_id: randomUUID(),
    p_run_id: begin.body.runId,
    p_items: [
      {
        legacyId: primaryId,
        schemaVersion: COMBAT_LOG_ARCHIVE_SCHEMA_VERSION,
        payload: first,
        payloadFingerprint: fingerprint(first),
        tombstoned: false,
      },
      {
        legacyId: secondaryId,
        schemaVersion: COMBAT_LOG_ARCHIVE_SCHEMA_VERSION,
        payload: second,
        payloadFingerprint: fingerprint(second),
        tombstoned: false,
      },
    ],
  });
  assert.equal(staged.response.status, 200);
  assert.equal(staged.body.itemCount, 2);

  // Ruling 3 negative: an open archive (no endedAt at all) is rejected at
  // staging time, not silently dropped or accepted.
  const openStage = await rpc(config, 'stage_combat_log_archive_items', owner, {
    p_mutation_id: randomUUID(),
    p_run_id: begin.body.runId,
    p_items: [
      {
        legacyId: primaryId,
        schemaVersion: COMBAT_LOG_ARCHIVE_SCHEMA_VERSION,
        payload: { ...first, endedAt: undefined },
        payloadFingerprint: fingerprint({ ...first, endedAt: undefined }),
        tombstoned: false,
      },
    ],
  });
  assert.equal(openStage.response.status, 400);
  assert.equal(openStage.body.code, '22023');
  assert.equal(
    openStage.body.message,
    'open combat log archive blocks cutover'
  );

  // Re-stage the valid (closed) set after the rejected attempt cleared the
  // run's staged items.
  const restaged = await rpc(config, 'stage_combat_log_archive_items', owner, {
    p_mutation_id: randomUUID(),
    p_run_id: begin.body.runId,
    p_items: [
      {
        legacyId: primaryId,
        schemaVersion: COMBAT_LOG_ARCHIVE_SCHEMA_VERSION,
        payload: first,
        payloadFingerprint: fingerprint(first),
        tombstoned: false,
      },
      {
        legacyId: secondaryId,
        schemaVersion: COMBAT_LOG_ARCHIVE_SCHEMA_VERSION,
        payload: second,
        payloadFingerprint: fingerprint(second),
        tombstoned: false,
      },
    ],
  });
  assert.equal(restaged.response.status, 200);
  assert.equal(restaged.body.itemCount, 2);

  const confirmBody = {
    p_mutation_id: randomUUID(),
    p_run_id: begin.body.runId,
    p_manifest_fingerprint: manifest,
    p_expected_epoch: 0,
  };
  const confirmations = await Promise.all([
    rpc(config, 'confirm_combat_log_archive_cutover', owner, confirmBody),
    rpc(config, 'confirm_combat_log_archive_cutover', owner, confirmBody),
  ]);
  assert.deepEqual(
    confirmations.map(value => value.response.status),
    [200, 200]
  );
  assert.deepEqual(confirmations[0].body, confirmations[1].body);
  assert.equal(confirmations[0].body.recordCount, 2);

  const preview = await rpc(
    config,
    'preview_combat_log_archive_device_enrollment',
    owner,
    { p_campaign_id: campaignId }
  );
  assert.equal(preview.body.authority, 'postgres');
  assert.equal(preview.body.recordCount, 2);
  assert.deepEqual(
    preview.body.documents.map(value => value.legacyId),
    [primaryId, secondaryId]
  );
  const enrollment = await rpc(
    config,
    'enroll_combat_log_archive_device',
    owner,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_device_id: randomUUID(),
      p_expected_epoch: 1,
      p_preview_fingerprint: preview.body.previewFingerprint,
      p_legacy_candidate_fingerprint: fingerprint({ preserved: true }),
    }
  );
  assert.equal(enrollment.response.status, 200);

  // --- Concurrent CAS race -------------------------------------------------
  // Two writers race to replace arc-a from the same base version (1) with two
  // different mutation IDs. Exactly one wins the compare-and-swap; the loser
  // must observe SQLSTATE 40001, not merely "some failure". A mocked-client
  // unit test cannot produce this: it has no real transaction serializer to
  // race against, so this genuinely exercises the database's own CAS path.
  const left = ashfallArchive('2026-08-03T18:00:00.000Z', {
    id: 'ev-left',
    timestamp: '2026-08-03T18:00:00.000Z',
    round: 5,
    turn: 0,
    encounterId: 'enc-ashfall',
    type: 'round_start',
    roundNumber: 5,
  });
  const right = ashfallArchive('2026-08-04T18:00:00.000Z', {
    id: 'ev-right',
    timestamp: '2026-08-04T18:00:00.000Z',
    round: 5,
    turn: 0,
    encounterId: 'enc-ashfall',
    type: 'round_start',
    roundNumber: 5,
  });
  const makePut = (payload, base) => ({
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_expected_epoch: 1,
    p_legacy_id: primaryId,
    p_operation: 'replace',
    p_expected_server_version: base,
    p_schema_version: COMBAT_LOG_ARCHIVE_SCHEMA_VERSION,
    p_payload: payload,
    p_payload_fingerprint: fingerprint(payload),
  });
  const race = await Promise.all([
    rpc(config, 'put_combat_log_archive_document', owner, makePut(left, 1)),
    rpc(config, 'put_combat_log_archive_document', owner, makePut(right, 1)),
  ]);
  const raceWinners = race.filter(value => value.response.status === 200);
  const raceLosers = race.filter(value => value.response.status !== 200);
  assert.equal(
    raceWinners.length,
    1,
    'exactly one concurrent writer wins the CAS race'
  );
  assert.equal(
    raceLosers.length,
    1,
    'exactly one concurrent writer loses the CAS race'
  );
  // PostgREST exposes PostgreSQL serialization/CAS failures as HTTP 500; the
  // app route deliberately translates SQLSTATE 40001 to the browser-facing
  // 409 contract. The RPC-level assertion below is on the SQLSTATE itself,
  // not the HTTP status the app route would produce.
  assert.equal(raceLosers[0].response.status, 500);
  assert.equal(raceLosers[0].body.code, '40001');
  assert.equal(
    raceLosers[0].body.message,
    'combat log archive server version conflict'
  );
  assert.equal(raceWinners[0].body.serverVersion, 2);

  // --- Response-loss replay -------------------------------------------------
  // The same mutation_id is sent twice, simulating a client that never saw
  // the first response (e.g. the connection dropped after the server
  // committed). Both calls must return the identical receipt, and exactly one
  // new version row must exist — the mutation-receipt idempotency table, not
  // request de-duplication in the client, is what a mocked-client unit test
  // cannot exercise.
  const replayed = ashfallArchive('2026-08-05T18:00:00.000Z', {
    id: 'ev-death',
    timestamp: '2026-08-05T18:00:00.000Z',
    round: 6,
    turn: 0,
    encounterId: 'enc-ashfall',
    type: 'death',
    entityId: 'ent-npc-1',
    entityName: 'Ash the Cult Prophet',
  });
  const replayBody = makePut(replayed, 2);
  const responseLoss = await Promise.all([
    rpc(config, 'put_combat_log_archive_document', owner, replayBody),
    rpc(config, 'put_combat_log_archive_document', owner, replayBody),
  ]);
  assert.deepEqual(
    responseLoss.map(value => value.response.status),
    [200, 200]
  );
  assert.equal(responseLoss[0].body.serverVersion, 3);
  assert.deepEqual(responseLoss[0].body, responseLoss[1].body);
  assert.equal(responseLoss[0].body.playerView, 'not-applicable');
  assert.equal(responseLoss[0].body.cloudSaved, true);

  const history = await rpc(
    config,
    'list_combat_log_archive_document_versions',
    owner,
    { p_campaign_id: campaignId, p_legacy_id: primaryId }
  );
  assert.equal(history.response.status, 200);
  assert.deepEqual(
    history.body.versions.map(value => value.serverVersion),
    [3, 2, 1]
  );
  assert.equal('payload' in history.body.versions[0], false);

  const exact = await rpc(
    config,
    'export_combat_log_archive_document_version',
    owner,
    { p_campaign_id: campaignId, p_legacy_id: primaryId, p_server_version: 1 }
  );
  assert.deepEqual(
    exact.body.payload.events.map(value => value.id),
    ['ev-1', 'ev-2', 'ev-3', 'ev-4']
  );
  assert.equal(exact.body.payload.events[1].isCritical, true);
  assert.equal(exact.body.payload.events[1].weaponOrSpellName, 'Sunblade');
  assert.equal(exact.body.payload.events[2].conditionName, 'Prone');

  const otherHistory = await rpc(
    config,
    'list_combat_log_archive_document_versions',
    other,
    { p_campaign_id: campaignId, p_legacy_id: primaryId }
  );
  assert.equal(otherHistory.response.status, 403);

  const verified = await rpc(
    config,
    'preview_combat_log_archive_device_enrollment',
    owner,
    { p_campaign_id: campaignId }
  );
  assert.equal(verified.body.recordCount, 2);

  // The positive rollback below hands the server back its own generation, so
  // on its own it can never exercise the compare. These three cases do.
  const staleEnrollment = await rpc(
    config,
    'enroll_combat_log_archive_device',
    owner,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_device_id: randomUUID(),
      p_expected_epoch: 1,
      p_preview_fingerprint: 'a'.repeat(64),
      p_legacy_candidate_fingerprint: null,
    }
  );
  assert.equal(staleEnrollment.body.code, '40001');
  assert.equal(
    staleEnrollment.body.message,
    'combat log archive enrollment preview changed'
  );

  const verifiedDocuments = verified.body.documents.map(value => ({
    legacyId: value.legacyId,
    serverVersion: value.serverVersion,
    schemaVersion: value.schemaVersion,
    payloadFingerprint: value.payloadFingerprint,
    tombstoned: value.tombstoned,
  }));
  const mutatedRollback = await rpc(
    config,
    'rollback_combat_log_archive_family',
    owner,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_expected_epoch: 1,
      p_preview_fingerprint: verified.body.previewFingerprint,
      p_current_generation: {
        recordCount: verified.body.recordCount,
        documents: verifiedDocuments.map((value, index) =>
          index === 0 ? { ...value, serverVersion: 99 } : value
        ),
      },
    }
  );
  assert.equal(mutatedRollback.body.code, '40001');
  assert.equal(
    mutatedRollback.body.message,
    'verified combat log archive generation changed'
  );

  const emptyRollback = await rpc(
    config,
    'rollback_combat_log_archive_family',
    owner,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_expected_epoch: 1,
      p_preview_fingerprint: verified.body.previewFingerprint,
      p_current_generation: [],
    }
  );
  assert.equal(emptyRollback.body.code, '55000');
  assert.equal(
    emptyRollback.body.message,
    'verified current combat log archive generation required'
  );

  const rollback = await rpc(
    config,
    'rollback_combat_log_archive_family',
    owner,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_expected_epoch: 1,
      p_preview_fingerprint: verified.body.previewFingerprint,
      p_current_generation: {
        recordCount: verified.body.recordCount,
        documents: verifiedDocuments,
      },
    }
  );
  assert.equal(rollback.response.status, 200);
  assert.equal(rollback.body.authority, 'legacy');
  assert.equal(rollback.body.epoch, 2);
});
