import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import test from 'node:test';

import { getLocalSupabaseTestConfig } from './local-supabase-env.mjs';

const PORT = 3122;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const PEPPER = 'synthetic-guest-http-pepper-32-bytes-minimum';

function jwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function userJwt(secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = jwtPart({ alg: 'HS256', typ: 'JWT' });
  const payload = jwtPart({
    aud: 'authenticated',
    exp: now + 300,
    iat: now,
    role: 'authenticated',
    sub: OWNER_ID,
  });
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function bytea(value) {
  return `\\x${createHash('sha256').update(value).digest('hex')}`;
}

async function rpc(config, name, token, body) {
  const response = await fetch(`${config.restUrl}/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { body: await response.json(), response };
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/guest`);
      if (response.status < 500) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Guest HTTP integration server did not become ready');
}

function cookiePair(setCookie) {
  return setCookie.slice(0, setCookie.indexOf(';'));
}

test('real HTTP redemption uses an opaque rotating cookie and enforces Origin/CSRF', async t => {
  const config = getLocalSupabaseTestConfig();
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(PORT)], {
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: config.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
      SUPABASE_SERVICE_ROLE_KEY: config.serviceRoleKey,
      SUPABASE_HYBRID_GUEST_ENABLED: 'true',
      NEXT_PUBLIC_SUPABASE_HYBRID_GUEST_UI_ENABLED: 'true',
      GUEST_SESSION_PEPPER: PEPPER,
    },
    stdio: 'ignore',
  });
  t.after(() => child.kill('SIGTERM'));
  await waitForServer();

  const token = userJwt(config.jwtSecret);
  const workspace = await rpc(config, 'create_campaign_workspace', token, {
    p_mutation_id: randomUUID(),
    p_name: 'Guest HTTP workspace',
    p_creation_kind: 'new_workspace',
    p_source_fingerprint: null,
  });
  assert.equal(workspace.response.status, 200);
  const invitationToken = createHash('sha256')
    .update(randomUUID())
    .digest('hex');
  const invitation = await rpc(
    config,
    'issue_campaign_guest_invitation',
    token,
    {
      p_mutation_id: randomUUID(),
      p_campaign_id: workspace.body.campaignId,
      p_token_hash: bytea(invitationToken),
      p_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      p_max_uses: 1,
      p_legacy_player_id: 'http-bound-player',
    }
  );
  assert.equal(invitation.response.status, 200);

  const missingCsrf = await fetch(
    `${ORIGIN}/api/campaign/guest-session/redeem`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ invitationToken, mutationId: randomUUID() }),
    }
  );
  assert.equal(missingCsrf.status, 403);

  const redemption = await fetch(
    `${ORIGIN}/api/campaign/guest-session/redeem`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'x-rollkeeper-csrf': '1',
      },
      body: JSON.stringify({ invitationToken, mutationId: randomUUID() }),
    }
  );
  assert.equal(
    redemption.status,
    200,
    `redemption failed: ${await redemption.clone().text()}`
  );
  const redemptionBody = await redemption.json();
  assert.equal(redemptionBody.session.legacyPlayerId, 'http-bound-player');
  assert.equal(JSON.stringify(redemptionBody).includes(invitationToken), false);
  const firstSetCookie = redemption.headers.get('set-cookie');
  assert.match(firstSetCookie, /^rk_guest_session=[a-f0-9]{64};/u);
  assert.match(firstSetCookie, /HttpOnly/iu);
  assert.match(firstSetCookie, /SameSite=Strict/iu);
  assert.match(firstSetCookie, /Path=\/api\/campaign/iu);
  assert.match(firstSetCookie, /Max-Age=5184000/iu);
  assert.equal(firstSetCookie.includes(invitationToken), false);
  const firstCookie = cookiePair(firstSetCookie);

  const status = await fetch(
    `${ORIGIN}/api/campaign/guest-session/status?code=${workspace.body.displayCode}`,
    { headers: { Cookie: firstCookie } }
  );
  assert.equal(status.status, 200);

  const rotation = await fetch(`${ORIGIN}/api/campaign/guest-session/rotate`, {
    method: 'POST',
    headers: {
      Cookie: firstCookie,
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'x-rollkeeper-csrf': '1',
    },
    body: JSON.stringify({
      displayCode: workspace.body.displayCode,
      mutationId: randomUUID(),
    }),
  });
  assert.equal(rotation.status, 200);
  const secondSetCookie = rotation.headers.get('set-cookie');
  assert.match(secondSetCookie, /Max-Age=5184000/iu);
  const secondCookie = cookiePair(secondSetCookie);
  assert.notEqual(secondCookie, firstCookie);

  const oldStatus = await fetch(
    `${ORIGIN}/api/campaign/guest-session/status?code=${workspace.body.displayCode}`,
    { headers: { Cookie: firstCookie } }
  );
  assert.equal(oldStatus.status, 401);
  assert.match(oldStatus.headers.get('set-cookie'), /Max-Age=0/iu);
  const newStatus = await fetch(
    `${ORIGIN}/api/campaign/guest-session/status?code=${workspace.body.displayCode}`,
    { headers: { Cookie: secondCookie } }
  );
  assert.equal(newStatus.status, 200);
});
