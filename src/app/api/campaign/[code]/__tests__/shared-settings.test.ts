import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, string>();
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => void store.set(k, v),
    del: async (k: string) => void store.delete(k),
    pipeline: () => ({ get: () => {}, set: () => {}, exec: async () => [] }),
  }),
  campaignSharedKey: (code: string, feature: string) =>
    `campaign:${code}:shared:${feature}`,
  campaignMessagesKey: (code: string, p: string) => `campaign:${code}:msg:${p}`,
  campaignEffectsKey: (code: string, p: string) => `campaign:${code}:fx:${p}`,
  campaignTransfersKey: (code: string, p: string) => `campaign:${code}:tx:${p}`,
  campaignPlayersKey: (code: string) => `campaign:${code}:players`,
  refreshCampaignTTL: async () => {},
  SLIDING_TTL_SECONDS: 100,
}));
vi.mock('@/lib/dmAuth', () => ({ verifyDmAuthority: async () => 'ok' }));
vi.mock('@/lib/relayPoke', () => ({ sendInitiativePoke: async () => {} }));

import { GET } from '@/app/api/campaign/[code]/shared/route';

function req(url: string) {
  return {
    nextUrl: new URL(url),
  } as unknown as import('next/server').NextRequest;
}

describe('shared state settings', () => {
  beforeEach(() => store.clear());

  it('returns null settings when none stored', async () => {
    const res = await GET(req('http://x/api?role=player'), {
      params: Promise.resolve({ code: 'ABC' }),
    });
    const body = await res.json();
    expect(body.settings).toBeNull();
  });

  it('returns stored stackableInspiration setting', async () => {
    store.set(
      'campaign:ABC:shared:settings',
      JSON.stringify({ stackableInspiration: true })
    );
    const res = await GET(req('http://x/api?role=player'), {
      params: Promise.resolve({ code: 'ABC' }),
    });
    const body = await res.json();
    expect(body.settings).toEqual({ stackableInspiration: true });
  });
});
