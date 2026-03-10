import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}));

describe('redis utilities', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('key generators', () => {
    it('campaignKey returns correct key', async () => {
      const { campaignKey } = await import('@/lib/redis');
      expect(campaignKey('ABC123')).toBe('campaign:ABC123');
    });

    it('campaignPlayersKey returns correct key', async () => {
      const { campaignPlayersKey } = await import('@/lib/redis');
      expect(campaignPlayersKey('ABC123')).toBe('campaign:ABC123:players');
    });

    it('campaignPlayerKey returns correct key', async () => {
      const { campaignPlayerKey } = await import('@/lib/redis');
      expect(campaignPlayerKey('ABC123', 'player-1')).toBe(
        'campaign:ABC123:player:player-1'
      );
    });
  });

  describe('SLIDING_TTL_SECONDS', () => {
    it('equals 30 days in seconds', async () => {
      const { SLIDING_TTL_SECONDS } = await import('@/lib/redis');
      expect(SLIDING_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
    });
  });

  describe('getRedis', () => {
    it('throws when env vars are missing', async () => {
      const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
      const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      try {
        const { getRedis } = await import('@/lib/redis');
        expect(() => getRedis()).toThrow(
          'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN'
        );
      } finally {
        process.env.UPSTASH_REDIS_REST_URL = originalUrl;
        process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
      }
    });
  });
});
