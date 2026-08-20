import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import test from 'node:test';

import { getLocalSupabaseTestConfig } from './local-supabase-env.mjs';

const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const PLAYER_ID = '20000000-0000-4000-8000-000000000002';

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
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function bytea(value) {
  return `\\x${createHash('sha256').update(value).digest('hex')}`;
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

test('real database serializes membership acceptance, readiness, cutover, removal, and rollback', async () => {
  const config = getLocalSupabaseTestConfig();
  const ownerToken = userJwt(config.jwtSecret, OWNER_ID);
  const playerToken = userJwt(config.jwtSecret, PLAYER_ID);
  const workspace = await rpc(config, 'create_campaign_workspace', ownerToken, {
    p_mutation_id: randomUUID(),
    p_name: 'Membership integration workspace',
    p_creation_kind: 'new_workspace',
    p_source_fingerprint: null,
  });
  assert.equal(workspace.response.status, 200);
  const campaignId = workspace.body.campaignId;

  const characterId = randomUUID();
  const character = await rpc(config, 'put_character', playerToken, {
    p_mutation_id: randomUUID(),
    p_character_id: characterId,
    p_legacy_client_id: 'integration-character',
    p_name: 'Membership integration character',
    p_payload: {
      id: 'integration-character',
      name: 'Membership integration character',
    },
    p_schema_version: 1,
    p_client_revision: 0,
    p_expected_server_version: 0,
  });
  assert.equal(character.body.status, 'success');

  const invitationToken = createHash('sha256')
    .update(randomUUID())
    .digest('hex');
  const issued = await rpc(
    config,
    'issue_campaign_membership_invitation',
    ownerToken,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_invited_account_id: PLAYER_ID,
      p_token_hash: bytea(invitationToken),
      p_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      p_max_uses: 1,
      p_role: 'player',
      p_legacy_player_id: 'integration-player',
      p_guest_subject_id: null,
    }
  );
  assert.equal(issued.response.status, 200);
  assert.equal(JSON.stringify(issued.body).includes(invitationToken), false);

  const acceptanceMutation = randomUUID();
  const acceptanceBody = {
    p_mutation_id: acceptanceMutation,
    p_token_hash: bytea(invitationToken),
    p_decision: 'accepted',
  };
  const identicalConcurrent = await Promise.all([
    rpc(
      config,
      'accept_campaign_membership_invitation',
      playerToken,
      acceptanceBody
    ),
    rpc(
      config,
      'accept_campaign_membership_invitation',
      playerToken,
      acceptanceBody
    ),
  ]);
  assert.deepEqual(
    identicalConcurrent.map(result => result.response.status),
    [200, 200]
  );
  assert.deepEqual(identicalConcurrent[0].body, identicalConcurrent[1].body);
  const exhausted = await rpc(
    config,
    'accept_campaign_membership_invitation',
    playerToken,
    {
      ...acceptanceBody,
      p_mutation_id: randomUUID(),
    }
  );
  assert.equal(exhausted.response.status, 403);

  const linked = await rpc(config, 'link_campaign_character', playerToken, {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_character_id: characterId,
    p_legacy_player_id: 'integration-player',
    p_legacy_character_id: 'integration-character',
    p_guest_subject_id: null,
  });
  assert.equal(linked.body.status, 'active');

  const guestInvitationToken = createHash('sha256')
    .update(randomUUID())
    .digest('hex');
  const guestInvitation = await rpc(
    config,
    'issue_campaign_guest_invitation',
    ownerToken,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_token_hash: bytea(guestInvitationToken),
      p_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      p_max_uses: 1,
      p_legacy_player_id: 'integration-player',
    }
  );
  assert.equal(guestInvitation.response.status, 200);
  const guestSessionToken = createHash('sha256')
    .update(randomUUID())
    .digest('hex');
  const guestSubjectId = randomUUID();
  const guestSession = await rpc(
    config,
    'redeem_campaign_guest_invitation',
    config.serviceRoleKey,
    {
      p_mutation_id: randomUUID(),
      p_token_hash: bytea(guestInvitationToken),
      p_request_hash: 'a'.repeat(64),
      p_subject_id: guestSubjectId,
      p_session_token_hash: bytea(guestSessionToken),
      p_session_expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    },
    true
  );
  assert.equal(guestSession.response.status, 200);

  const shadow = async entries =>
    rpc(
      config,
      'replace_campaign_membership_shadow',
      config.serviceRoleKey,
      {
        p_mutation_id: randomUUID(),
        p_owner_id: OWNER_ID,
        p_campaign_id: campaignId,
        p_entries: entries,
      },
      true
    );
  const baseEntries = [
    {
      kind: 'legacy_roster',
      sourceId: 'integration-player',
      label: 'Integration player',
      fingerprint: 'b'.repeat(64),
    },
    {
      kind: 'guest_subject',
      sourceId: guestSubjectId,
      label: 'Integration guest',
      fingerprint: 'c'.repeat(64),
    },
  ];
  assert.equal((await shadow(baseEntries)).response.status, 200);
  const classifiedGuest = await rpc(
    config,
    'classify_campaign_membership_shadow',
    ownerToken,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_entry_kind: 'guest_subject',
      p_source_id: guestSubjectId,
      p_classification: 'duplicate',
    }
  );
  assert.equal(classifiedGuest.response.status, 200);

  const prepare = () =>
    rpc(config, 'prepare_campaign_membership_manifest', ownerToken, {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
    });
  const ready = await prepare();
  assert.equal(ready.body.blockerCount, 0);
  const begin = await rpc(
    config,
    'begin_campaign_membership_freeze',
    ownerToken,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_manifest_fingerprint: ready.body.fingerprint,
      p_manifest_version: ready.body.version,
    }
  );
  assert.equal(begin.body.state, 'freezing');

  await shadow([
    ...baseEntries,
    {
      kind: 'legacy_roster',
      sourceId: 'concurrent-player',
      label: 'Concurrent player',
      fingerprint: 'd'.repeat(64),
    },
  ]);
  const staleCutover = await rpc(
    config,
    'confirm_campaign_membership_cutover',
    ownerToken,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_manifest_fingerprint: ready.body.fingerprint,
      p_manifest_version: ready.body.version,
    }
  );
  assert.equal(
    staleCutover.response.status,
    500,
    JSON.stringify(staleCutover.body)
  );
  assert.equal(staleCutover.body.code, '40001');
  const guestAfterFailure = await rpc(
    config,
    'authorize_campaign_guest_session',
    config.serviceRoleKey,
    {
      p_session_token_hash: bytea(guestSessionToken),
      p_display_code: workspace.body.displayCode,
      p_required_scope: 'player:sync',
    },
    true
  );
  assert.equal(guestAfterFailure.response.status, 200);

  const classified = await rpc(
    config,
    'classify_campaign_membership_shadow',
    ownerToken,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_entry_kind: 'legacy_roster',
      p_source_id: 'concurrent-player',
      p_classification: 'abandoned',
    }
  );
  assert.equal(classified.response.status, 200);
  const current = await prepare();
  assert.equal(current.body.blockerCount, 0);
  await rpc(config, 'begin_campaign_membership_freeze', ownerToken, {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_manifest_fingerprint: current.body.fingerprint,
    p_manifest_version: current.body.version,
  });
  const cutovers = await Promise.all([
    rpc(config, 'confirm_campaign_membership_cutover', ownerToken, {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_manifest_fingerprint: current.body.fingerprint,
      p_manifest_version: current.body.version,
    }),
    rpc(config, 'confirm_campaign_membership_cutover', ownerToken, {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_manifest_fingerprint: current.body.fingerprint,
      p_manifest_version: current.body.version,
    }),
  ]);
  assert.deepEqual(
    cutovers.map(result => result.response.status).sort(),
    [200, 403]
  );
  const committed = cutovers.find(
    result => result.response.status === 200
  ).body;
  assert.equal(committed.authority, 'postgres');
  assert.equal(committed.epoch, 1);

  const staleGuest = await rpc(
    config,
    'authorize_campaign_guest_session',
    config.serviceRoleKey,
    {
      p_session_token_hash: bytea(guestSessionToken),
      p_display_code: workspace.body.displayCode,
      p_required_scope: 'player:sync',
    },
    true
  );
  assert.equal(staleGuest.response.status, 403);
  const accountAuthority = await rpc(
    config,
    'authorize_campaign_membership',
    playerToken,
    {
      p_campaign_id: campaignId,
      p_expected_epoch: 1,
    }
  );
  assert.equal(accountAuthority.body.legacyPlayerId, 'integration-player');

  const removed = await rpc(config, 'remove_campaign_member', ownerToken, {
    p_mutation_id: randomUUID(),
    p_campaign_id: campaignId,
    p_member_id: PLAYER_ID,
    p_expected_legacy_player_id: 'integration-player',
    p_expected_epoch: 1,
  });
  assert.equal(removed.body.status, 'removed');
  const removedAuthority = await rpc(
    config,
    'authorize_campaign_membership',
    playerToken,
    {
      p_campaign_id: campaignId,
      p_expected_epoch: 1,
    }
  );
  assert.equal(removedAuthority.response.status, 403);
  const characterStillExists = await fetch(
    `${config.restUrl}/characters?id=eq.${characterId}&select=id`,
    {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${playerToken}`,
      },
    }
  );
  assert.equal((await characterStillExists.json()).length, 1);

  const rollback = await rpc(
    config,
    'rollback_campaign_membership',
    ownerToken,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: campaignId,
      p_expected_epoch: 1,
      p_generation: current.body.manifest,
      p_generation_fingerprint: current.body.fingerprint,
    }
  );
  assert.equal(rollback.body.authority, 'legacy');
  assert.equal(rollback.body.epoch, 2);
});
