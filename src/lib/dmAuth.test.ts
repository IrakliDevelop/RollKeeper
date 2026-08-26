import { describe, it, expect } from 'vitest';
import type { Redis } from '@upstash/redis';
import { verifyDmAuthority } from '@/lib/dmAuth';

function fakeRedis(storedValue: unknown): Redis {
  return { get: async () => storedValue } as unknown as Redis;
}

describe('verifyDmAuthority', () => {
  it('returns ok when dmId matches (object value)', async () => {
    const redis = fakeRedis({
      dmId: 'dm-1',
      campaignName: 'C',
      createdAt: 'x',
    });
    expect(await verifyDmAuthority(redis, 'ABC123', 'dm-1')).toBe('ok');
  });

  it('returns ok when dmId matches (JSON string value)', async () => {
    const redis = fakeRedis(
      JSON.stringify({ dmId: 'dm-1', campaignName: 'C' })
    );
    expect(await verifyDmAuthority(redis, 'ABC123', 'dm-1')).toBe('ok');
  });

  it('returns mismatch when dmId differs', async () => {
    const redis = fakeRedis({ dmId: 'dm-1', campaignName: 'C' });
    expect(await verifyDmAuthority(redis, 'ABC123', 'dm-EVIL')).toBe(
      'mismatch'
    );
  });

  it('returns missing when no campaign record exists', async () => {
    const redis = fakeRedis(null);
    expect(await verifyDmAuthority(redis, 'ABC123', 'dm-1')).toBe('missing');
  });
});
