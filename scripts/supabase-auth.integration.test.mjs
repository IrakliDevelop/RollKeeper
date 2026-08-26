import assert from 'node:assert/strict';
import test from 'node:test';

import {
  expireLocalEmailOtp,
  getLocalSupabaseTestConfig,
} from './local-supabase-env.mjs';

const EMAIL_DOMAIN = 'example.test';

async function authRequest(config, path, body) {
  const response = await fetch(`${config.apiUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { body: await response.json(), response };
}

async function waitForOtp(config, email) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const listResponse = await fetch(`${config.mailpitUrl}/api/v1/messages`);
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();

    for (const summary of list.messages ?? []) {
      const detailResponse = await fetch(
        `${config.mailpitUrl}/api/v1/message/${encodeURIComponent(summary.ID)}`
      );
      if (!detailResponse.ok) continue;
      const detail = await detailResponse.json();
      const serialized = JSON.stringify(detail);
      if (!serialized.includes(email)) continue;

      const match = serialized.match(/RollKeeper sign-in code[^0-9]*(\d{6})/u);
      if (match) return match[1];
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error('Local Mailpit did not receive a six-digit OTP');
}

function uniqueEmail(label) {
  return `slice5-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@${EMAIL_DOMAIN}`;
}

test('local Mailpit OTP supports signup/sign-in and rejects invalid or reused codes', async () => {
  const config = getLocalSupabaseTestConfig();
  const email = uniqueEmail('signup');

  const request = await authRequest(config, 'otp', {
    create_user: true,
    email,
  });
  assert.equal(request.response.status, 200);
  const token = await waitForOtp(config, email);

  const invalid = await authRequest(config, 'verify', {
    email,
    token: '000000',
    type: 'email',
  });
  assert.equal(invalid.response.status, 403);

  const verified = await authRequest(config, 'verify', {
    email,
    token,
    type: 'email',
  });
  assert.equal(verified.response.status, 200);
  assert.equal(typeof verified.body.access_token, 'string');

  const reused = await authRequest(config, 'verify', {
    email,
    token,
    type: 'email',
  });
  assert.equal(reused.response.status, 403);
});

test('local Mailpit OTP rejects a code older than the configured ten minutes', async () => {
  const config = getLocalSupabaseTestConfig();
  const email = uniqueEmail('expired');

  const request = await authRequest(config, 'otp', {
    create_user: true,
    email,
  });
  assert.equal(request.response.status, 200);
  const token = await waitForOtp(config, email);
  expireLocalEmailOtp(email);

  const expired = await authRequest(config, 'verify', {
    email,
    token,
    type: 'email',
  });
  assert.equal(expired.response.status, 403);
});
