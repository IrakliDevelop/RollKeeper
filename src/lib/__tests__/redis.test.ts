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

    it('campaignShopKey returns correct key', async () => {
      const { campaignShopKey } = await import('@/lib/redis');
      expect(campaignShopKey('ABC123', 'npc-1')).toBe(
        'campaign:ABC123:shop:npc-1'
      );
    });

    it('campaignShopLedgerKey returns correct key', async () => {
      const { campaignShopLedgerKey } = await import('@/lib/redis');
      expect(campaignShopLedgerKey('ABC123', 'npc-1')).toBe(
        'campaign:ABC123:shop-ledger:npc-1'
      );
    });

    it('campaignShopSalesKey returns correct key', async () => {
      const { campaignShopSalesKey } = await import('@/lib/redis');
      expect(campaignShopSalesKey('ABC123', 'npc-1')).toBe(
        'campaign:ABC123:shop-sales:npc-1'
      );
    });

    it('campaignShopReceiptKey returns correct key', async () => {
      const { campaignShopReceiptKey } = await import('@/lib/redis');
      expect(campaignShopReceiptKey('ABC123', 'npc-1', 'req-1')).toBe(
        'campaign:ABC123:shop-receipt:npc-1:req-1'
      );
    });
  });

  describe('refreshCampaignTTL', () => {
    it('does not touch the per-NPC shop keys (they set their own TTL at write time)', async () => {
      const { refreshCampaignTTL } = await import('@/lib/redis');
      const calledKeys: string[] = [];
      const fakeRedis = {
        expire: (key: string) => {
          calledKeys.push(key);
          return Promise.resolve(1);
        },
      } as unknown as import('@upstash/redis').Redis;

      await refreshCampaignTTL(fakeRedis, 'ABC123');

      expect(calledKeys).toEqual([
        'campaign:ABC123',
        'campaign:ABC123:players',
        'campaign:ABC123:locations',
        'campaign:ABC123:battlemaps',
      ]);
      expect(calledKeys.some(k => k.includes('shop'))).toBe(false);
    });
  });

  describe('SLIDING_TTL_SECONDS', () => {
    it('equals 60 days in seconds', async () => {
      const { SLIDING_TTL_SECONDS } = await import('@/lib/redis');
      expect(SLIDING_TTL_SECONDS).toBe(60 * 24 * 60 * 60);
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
