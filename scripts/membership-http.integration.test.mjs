import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

import { getLocalSupabaseTestConfig } from './local-supabase-env.mjs';

const PORT = 3123;
const ORIGIN = `http://127.0.0.1:${PORT}`;

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/membership`);
      if (response.status < 500) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Membership HTTP integration server did not become ready');
}

async function authenticatedCookie(config, email, password) {
  const values = new Map();
  const client = createServerClient(config.apiUrl, config.publishableKey, {
    cookies: {
      getAll: () => [],
      setAll: cookies => {
        for (const cookie of cookies) values.set(cookie.name, cookie.value);
      },
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
    if (encoded.length <= 3180) {
      values.set(storageKey, encoded);
    } else {
      for (
        let offset = 0, index = 0;
        offset < encoded.length;
        offset += 3180, index += 1
      ) {
        values.set(
          `${storageKey}.${index}`,
          encoded.slice(offset, offset + 3180)
        );
      }
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

function secretPair() {
  const secret = randomBytes(32).toString('hex');
  return {
    secret,
    tokenHash: createHash('sha256').update(secret).digest('hex'),
  };
}

async function mutation(path, cookie, body, method = 'POST', headers = {}) {
  const response = await fetch(`${ORIGIN}${path}`, {
    method,
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

test('real HTTP membership routes enforce cookies, CSRF, hash-only issuance, replay, and revocation', async t => {
  const config = getLocalSupabaseTestConfig();
  const admin = createClient(config.apiUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const password = `Synthetic-${randomBytes(18).toString('base64url')}!9`;
  const ownerEmail = `slice10b-owner-${suffix}@example.test`;
  const playerEmail = `slice10b-player-${suffix}@example.test`;
  const otherEmail = `slice10b-other-${suffix}@example.test`;
  for (const email of [ownerEmail, playerEmail, otherEmail]) {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(error);
  }
  const owner = await authenticatedCookie(config, ownerEmail, password);
  const player = await authenticatedCookie(config, playerEmail, password);
  const other = await authenticatedCookie(config, otherEmail, password);

  const child = spawn('npm', ['run', 'dev', '--', '--port', String(PORT)], {
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: config.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
      NEXT_PUBLIC_SUPABASE_AUTH_ENABLED: 'true',
      SUPABASE_SERVICE_ROLE_KEY: config.serviceRoleKey,
      SUPABASE_CAMPAIGN_MEMBERSHIP_ENABLED: 'true',
      NEXT_PUBLIC_SUPABASE_CAMPAIGN_MEMBERSHIP_UI_ENABLED: 'true',
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
      p_name: 'Membership HTTP workspace',
      p_creation_kind: 'new_workspace',
      p_source_fingerprint: null,
    }
  );
  assert.equal(workspace.response.status, 200);

  const pair = secretPair();
  const issueMutation = randomUUID();
  const issueBody = {
    mutationId: issueMutation,
    tokenHash: pair.tokenHash,
    campaignId: workspace.body.campaignId,
    invitedAccountId: player.session.user.id,
    legacyPlayerId: 'http-player',
    guestSubjectId: null,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    maxUses: 1,
    role: 'player',
  };
  const missingCsrf = await mutation(
    '/api/campaign/membership-invitations',
    owner.cookie,
    issueBody,
    'POST',
    { 'x-rollkeeper-csrf': '' }
  );
  assert.equal(missingCsrf.response.status, 403);

  const issued = await mutation(
    '/api/campaign/membership-invitations',
    owner.cookie,
    issueBody
  );
  assert.equal(issued.response.status, 200, JSON.stringify(issued.body));
  assert.equal(issued.body.acceptancePath, '/membership');
  assert.equal(JSON.stringify(issued.body).includes(pair.secret), false);
  assert.equal(JSON.stringify(issued.body).includes(pair.tokenHash), false);

  const issuedReplay = await mutation(
    '/api/campaign/membership-invitations',
    owner.cookie,
    issueBody
  );
  assert.equal(issuedReplay.response.status, 200);
  assert.deepEqual(issuedReplay.body, issued.body);

  const wrongAccount = await mutation(
    '/api/campaign/membership-invitations/respond',
    other.cookie,
    {
      mutationId: randomUUID(),
      invitationToken: pair.secret,
      decision: 'accepted',
    }
  );
  assert.equal(wrongAccount.response.status, 401);

  const acceptanceMutation = randomUUID();
  const acceptanceBody = {
    mutationId: acceptanceMutation,
    invitationToken: pair.secret,
    decision: 'accepted',
  };
  const accepted = await mutation(
    '/api/campaign/membership-invitations/respond',
    player.cookie,
    acceptanceBody
  );
  assert.equal(accepted.response.status, 200, JSON.stringify(accepted.body));
  assert.equal(JSON.stringify(accepted.body).includes(pair.secret), false);
  const acceptedReplay = await mutation(
    '/api/campaign/membership-invitations/respond',
    player.cookie,
    acceptanceBody
  );
  assert.deepEqual(acceptedReplay.body, accepted.body);
  const changedReplay = await mutation(
    '/api/campaign/membership-invitations/respond',
    player.cookie,
    { ...acceptanceBody, decision: 'refused' }
  );
  assert.equal(changedReplay.response.status, 401);

  const revokedPair = secretPair();
  const revokedIssue = await mutation(
    '/api/campaign/membership-invitations',
    owner.cookie,
    { ...issueBody, mutationId: randomUUID(), tokenHash: revokedPair.tokenHash }
  );
  assert.equal(revokedIssue.response.status, 200);
  const revoked = await mutation(
    '/api/campaign/membership-invitations',
    owner.cookie,
    {
      mutationId: randomUUID(),
      invitationId: revokedIssue.body.invitation.invitationId,
    },
    'DELETE'
  );
  assert.equal(revoked.response.status, 200);
  const revokedAcceptance = await mutation(
    '/api/campaign/membership-invitations/respond',
    player.cookie,
    {
      mutationId: randomUUID(),
      invitationToken: revokedPair.secret,
      decision: 'accepted',
    }
  );
  assert.equal(revokedAcceptance.response.status, 401);
});
