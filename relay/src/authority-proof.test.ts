import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { MemoryHubBackend } from '@fieldnotes/sync-server';

import { tableAuthorityChallengeKey } from './authority-keys.js';
import { startRelay, type RelayHandle } from './server.js';

const SECRET = 'authority-proof-secret';
const CAMPAIGN = 'ABC123';
const FIRST = '123e4567-e89b-42d3-a456-426614174000';
const SECOND = '223e4567-e89b-42d3-a456-426614174000';

describe('relay authority proof endpoint', () => {
  let handle: RelayHandle;
  const get = vi.fn(async (key: string) =>
    key === tableAuthorityChallengeKey(CAMPAIGN, FIRST)
      ? JSON.stringify({ challengeId: FIRST, nonce: 'first-nonce' })
      : null
  );
  const evalScript = vi.fn(async () => [0, 'invalid']);

  beforeAll(async () => {
    handle = await startRelay({
      secret: SECRET,
      port: 0,
      backend: new MemoryHubBackend(),
      authorityRedis: { get, eval: evalScript } as never,
    });
  });

  afterAll(async () => {
    if (handle) await handle.close();
  });

  async function proof(challengeId: string) {
    return fetch(`http://127.0.0.1:${handle.address().port}/authority-proof`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rollkeeper-relay-secret': SECRET,
      },
      body: JSON.stringify({ campaign: CAMPAIGN, challengeId }),
    });
  }

  it('looks up the exact UUID-addressed key and proves only that challenge', async () => {
    const response = await proof(FIRST);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      challengeId: FIRST,
      sha256: createHash('sha256').update('first-nonce').digest('hex'),
    });
    expect(get).toHaveBeenLastCalledWith(
      tableAuthorityChallengeKey(CAMPAIGN, FIRST)
    );
    const wrong = await proof(SECOND);
    expect(wrong.status).toBe(404);
    expect(get).toHaveBeenLastCalledWith(
      tableAuthorityChallengeKey(CAMPAIGN, SECOND)
    );
  });

  it('rejects invalid challenge IDs before touching Redis', async () => {
    get.mockClear();
    const response = await proof('not-a-uuid');
    expect(response.status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });
});
