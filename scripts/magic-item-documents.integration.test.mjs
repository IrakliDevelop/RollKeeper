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

function chargedItem(updatedAt, name = 'Staff of Embers') {
  return {
    name,
    category: 'Staff',
    rarity: 'Rare',
    description: 'A charred oak staff that hums with heat.',
    properties: ['Requires attunement'],
    tags: ['fire', 'staff'],
    requiresAttunement: true,
    isAttuned: false,
    isEquipped: false,
    charges: [{ id: 'chg-1', label: 'Ember', max: 3, current: 3 }],
    chargePool: {
      max: 5,
      current: 5,
      abilities: [{ id: 'abl-1', name: 'Flare', cost: 2 }],
    },
    bonusSpellAttack: 1,
    bonusSpellSaveDc: 1,
    legacyCharges: { max: 3, current: 3 },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt,
    group: 'Arcane',
    sourceItemId: 'srd-staff-of-embers',
  };
}

function minimalItem() {
  return {
    name: 'Charm of Quiet Steps',
    category: 'Wondrous item',
    rarity: 'Common',
    description: 'A plain charm carved from bone.',
    properties: [],
    tags: [],
    requiresAttunement: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    group: null,
  };
}

test('real magic item database enforces multi-record staging, CAS, immutable history, isolation, enrollment, and rollback without projection', async () => {
  const config = getLocalSupabaseTestConfig();
  const owner = userJwt(config.jwtSecret, OWNER_ID);
  const other = userJwt(config.jwtSecret, OTHER_ID);
  const workspace = await rpc(config, 'create_campaign_workspace', owner, {
    p_mutation_id: randomUUID(),
    p_name: 'Magic item integration',
    p_creation_kind: 'new_workspace',
    p_source_fingerprint: null,
  });
  assert.equal(workspace.response.status, 200);
  const campaignId = workspace.body.campaignId;
  const primaryId = 'magic-a';
  const secondaryId = 'magic-b';
  const first = chargedItem('2026-08-02T00:00:00.000Z');
  const second = minimalItem();
  const totalBytes = canonicalBytes(first) + canonicalBytes(second);
  const recovery = fingerprint({ recovery: true });
  const manifest = fingerprint({ family: 'magic_item', campaignId });

  const denied = await rpc(config, 'begin_magic_item_staging', other, {
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

  const deviceId = randomUUID();
  const begin = await rpc(config, 'begin_magic_item_staging', owner, {
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

  const staged = await rpc(config, 'stage_magic_item_items', owner, {
    p_mutation_id: randomUUID(),
    p_run_id: begin.body.runId,
    p_items: [
      {
        legacyId: primaryId,
        schemaVersion: 1,
        payload: first,
        payloadFingerprint: fingerprint(first),
        tombstoned: false,
      },
      {
        legacyId: secondaryId,
        schemaVersion: 1,
        payload: second,
        payloadFingerprint: fingerprint(second),
        tombstoned: false,
      },
    ],
  });
  assert.equal(staged.response.status, 200);
  assert.equal(staged.body.itemCount, 2);

  const confirmBody = {
    p_mutation_id: randomUUID(),
    p_run_id: begin.body.runId,
    p_manifest_fingerprint: manifest,
    p_expected_epoch: 0,
  };
  const confirmations = await Promise.all([
    rpc(config, 'confirm_magic_item_cutover', owner, confirmBody),
    rpc(config, 'confirm_magic_item_cutover', owner, confirmBody),
  ]);
  assert.deepEqual(
    confirmations.map(value => value.response.status),
    [200, 200]
  );
  assert.deepEqual(confirmations[0].body, confirmations[1].body);
  assert.equal(confirmations[0].body.recordCount, 2);

  const preview = await rpc(
    config,
    'preview_magic_item_device_enrollment',
    owner,
    { p_campaign_id: campaignId }
  );
  assert.equal(preview.body.authority, 'postgres');
  assert.equal(preview.body.recordCount, 2);
  assert.deepEqual(
    preview.body.documents.map(value => value.legacyId),
    [primaryId, secondaryId]
  );
  const enrollment = await rpc(config, 'enroll_magic_item_device', owner, {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_device_id: randomUUID(),
    p_expected_epoch: 1,
    p_preview_fingerprint: preview.body.previewFingerprint,
    p_legacy_candidate_fingerprint: fingerprint({ preserved: true }),
  });
  assert.equal(enrollment.response.status, 200);

  const left = chargedItem('2026-08-03T00:00:00.000Z', 'Staff of Left Embers');
  const right = chargedItem(
    '2026-08-04T00:00:00.000Z',
    'Staff of Right Embers'
  );
  const makePut = (payload, base) => ({
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_expected_epoch: 1,
    p_legacy_id: primaryId,
    p_operation: 'replace',
    p_expected_server_version: base,
    p_schema_version: 1,
    p_payload: payload,
    p_payload_fingerprint: fingerprint(payload),
  });
  const race = await Promise.all([
    rpc(config, 'put_magic_item_document', owner, makePut(left, 1)),
    rpc(config, 'put_magic_item_document', owner, makePut(right, 1)),
  ]);
  // PostgREST exposes PostgreSQL serialization failures as 500; the app route
  // deliberately translates SQLSTATE 40001 to the browser-facing 409 contract.
  assert.deepEqual(race.map(value => value.response.status).sort(), [200, 500]);
  const winner = race.find(value => value.response.status === 200);
  assert.equal(winner.body.serverVersion, 2);

  const replayBody = makePut(
    chargedItem('2026-08-05T00:00:00.000Z', 'Staff of Replayed Embers'),
    2
  );
  const responseLoss = await Promise.all([
    rpc(config, 'put_magic_item_document', owner, replayBody),
    rpc(config, 'put_magic_item_document', owner, replayBody),
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
    'list_magic_item_document_versions',
    owner,
    { p_campaign_id: campaignId, p_legacy_id: primaryId }
  );
  assert.equal(history.response.status, 200);
  assert.deepEqual(
    history.body.versions.map(value => value.serverVersion),
    [3, 2, 1]
  );
  assert.equal('payload' in history.body.versions[0], false);

  const exact = await rpc(config, 'export_magic_item_document_version', owner, {
    p_campaign_id: campaignId,
    p_legacy_id: primaryId,
    p_server_version: 1,
  });
  assert.equal(exact.body.payload.charges[0].id, 'chg-1');
  assert.equal(exact.body.payload.chargePool.abilities[0].id, 'abl-1');

  const otherHistory = await rpc(
    config,
    'list_magic_item_document_versions',
    other,
    { p_campaign_id: campaignId, p_legacy_id: primaryId }
  );
  assert.equal(otherHistory.response.status, 403);

  const verified = await rpc(
    config,
    'preview_magic_item_device_enrollment',
    owner,
    { p_campaign_id: campaignId }
  );
  assert.equal(verified.body.recordCount, 2);
  const rollback = await rpc(config, 'rollback_magic_item_family', owner, {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_expected_epoch: 1,
    p_preview_fingerprint: verified.body.previewFingerprint,
    p_current_generation: {
      recordCount: verified.body.recordCount,
      documents: verified.body.documents.map(value => ({
        legacyId: value.legacyId,
        serverVersion: value.serverVersion,
        schemaVersion: value.schemaVersion,
        payloadFingerprint: value.payloadFingerprint,
        tombstoned: value.tombstoned,
      })),
    },
  });
  assert.equal(rollback.response.status, 200);
  assert.equal(rollback.body.authority, 'legacy');
  assert.equal(rollback.body.epoch, 2);
});
