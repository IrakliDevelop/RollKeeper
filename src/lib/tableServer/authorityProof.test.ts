import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockRedis, resetRedis } from '@/test/mocks/redis';
import { proveRelayAuthority } from './authorityProof';
import { tableAuthorityChallengeKey, tableCampaignTag } from './keys';

describe('proveRelayAuthority', () => {
  beforeEach(() => {
    resetRedis();
    mockRedis.set.mockClear();
    process.env.BATTLEMAP_RELAY_SECRET = 'relay-secret';
    process.env.BATTLEMAP_RELAY_INTERNAL_URL = 'http://relay.internal:8787';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BATTLEMAP_RELAY_INTERNAL_URL;
  });

  it('uses the tagged bounded challenge and verifies the relay digest', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const request = JSON.parse(String(init.body)) as {
          challengeId: string;
        };
        const stored = JSON.parse(
          String(
            await mockRedis.get(
              tableAuthorityChallengeKey('ABC123', request.challengeId)
            )
          )
        ) as { nonce: string };
        return new Response(
          JSON.stringify({
            challengeId: request.challengeId,
            sha256: createHash('sha256').update(stored.nonce).digest('hex'),
          }),
          { status: 200 }
        );
      })
    );
    expect(await proveRelayAuthority('ABC123')).toBe(true);
    const call = mockRedis.set.mock.calls.find(entry =>
      String(entry[0]).includes(':table-authority-challenge:')
    );
    expect(call).toBeDefined();
    expect(call?.[0]).toMatch(
      /:table-authority-challenge:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    );
    expect(call?.[1]).toEqual(expect.any(String));
    expect((call as unknown as readonly unknown[])?.[2]).toEqual({ ex: 30 });
  });

  it('keeps deliberately interleaved same-campaign proofs independent', async () => {
    let arrivals = 0;
    let release!: () => void;
    const bothArrived = new Promise<void>(resolve => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const request = JSON.parse(String(init.body)) as {
          challengeId: string;
        };
        arrivals += 1;
        if (arrivals === 2) release();
        await bothArrived;
        const stored = JSON.parse(
          String(
            await mockRedis.get(
              tableAuthorityChallengeKey('ABC123', request.challengeId)
            )
          )
        ) as { nonce: string };
        return new Response(
          JSON.stringify({
            challengeId: request.challengeId,
            sha256: createHash('sha256').update(stored.nonce).digest('hex'),
          }),
          { status: 200 }
        );
      })
    );
    await expect(
      Promise.all([
        proveRelayAuthority('ABC123'),
        proveRelayAuthority('ABC123'),
      ])
    ).resolves.toEqual([true, true]);
    const keys = mockRedis.set.mock.calls
      .map(call => String(call[0]))
      .filter(key => key.includes(':table-authority-challenge:'));
    expect(new Set(keys)).toHaveLength(2);
    expect(keys.every(key => key.includes(tableCampaignTag('ABC123')))).toBe(
      true
    );
  });

  it('fails closed on a mismatched proof', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const request = JSON.parse(String(init.body)) as {
          challengeId: string;
        };
        return new Response(
          JSON.stringify({
            challengeId: request.challengeId,
            sha256: '0'.repeat(64),
          }),
          { status: 200 }
        );
      })
    );
    expect(await proveRelayAuthority('ABC123')).toBe(false);
  });
});
