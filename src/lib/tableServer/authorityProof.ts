import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import { getRawRedis } from '@/lib/redis';
import { tableAuthorityChallengeKey } from './keys';

function relayProofUrl(): string | null {
  const raw =
    process.env.BATTLEMAP_RELAY_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (url.protocol === 'wss:') url.protocol = 'https:';
    url.pathname = '/authority-proof';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** Proves the app and relay observe the exact same tagged Redis authority. */
export async function proveRelayAuthority(code: string): Promise<boolean> {
  const secret = process.env.BATTLEMAP_RELAY_SECRET;
  const endpoint = relayProofUrl();
  if (!secret || !endpoint) return false;
  const challengeId = randomUUID();
  const nonce = randomBytes(32).toString('hex');
  const expected = createHash('sha256').update(nonce).digest();
  try {
    await getRawRedis().set(
      tableAuthorityChallengeKey(code, challengeId),
      JSON.stringify({ challengeId, nonce }),
      { ex: 30 }
    );
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rollkeeper-relay-secret': secret,
      },
      body: JSON.stringify({ campaign: code, challengeId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as {
      challengeId?: unknown;
      sha256?: unknown;
    };
    if (
      body.challengeId !== challengeId ||
      typeof body.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/u.test(body.sha256)
    )
      return false;
    const actual = Buffer.from(body.sha256, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
