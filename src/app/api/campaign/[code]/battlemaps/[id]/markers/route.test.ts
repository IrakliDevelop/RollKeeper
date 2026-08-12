import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { redis, rawRedis, verifyDmAuthority, seedMarkerLoot, claimMarkerLoot } =
  vi.hoisted(() => ({
    redis: {
      get: vi.fn(),
      set: vi.fn(),
      sismember: vi.fn(),
      expire: vi.fn(),
    },
    rawRedis: { get: vi.fn(), eval: vi.fn() },
    verifyDmAuthority: vi.fn(),
    seedMarkerLoot: vi.fn(),
    claimMarkerLoot: vi.fn(),
  }));

vi.mock('@/lib/redis', () => ({
  getRedis: () => redis,
  getRawRedis: () => rawRedis,
  campaignMarkerLootKey: (code: string, id: string) => `loot:${code}:${id}`,
  campaignMarkerClaimKey: (
    code: string,
    id: string,
    playerId: string,
    requestId: string
  ) => `claim:${code}:${id}:${playerId}:${requestId}`,
  campaignPlayersKey: (code: string) => `players:${code}`,
  campaignSharedKey: (code: string, feature: string) =>
    `shared:${code}:${feature}`,
  campaignTransfersKey: (code: string, playerId: string) =>
    `transfers:${code}:${playerId}`,
  refreshCampaignTTL: vi.fn(),
  SLIDING_TTL_SECONDS: 3600,
}));
vi.mock('@/lib/dmAuth', () => ({ verifyDmAuthority }));
vi.mock('@/lib/markerLootClaims', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/markerLootClaims')>();
  return { ...actual, seedMarkerLoot, claimMarkerLoot };
});

import { GET, POST, PUT } from './route';

const params = { params: Promise.resolve({ code: 'ABC', id: 'map-1' }) };
const publicMarker = {
  id: 'marker-1',
  title: 'Chest',
  body: 'Take one.',
  loot: [
    {
      id: 'entry-1',
      name: 'Potion',
      itemKind: 'inventory',
      quantity: 1,
      remainingQuantity: 1,
    },
  ],
};
const ledgerEntry = {
  markerId: 'marker-1',
  id: 'entry-1',
  itemKind: 'inventory',
  item: {
    id: 'item-1',
    name: 'Potion',
    category: 'consumable',
    quantity: 1,
    location: 'Backpack',
    tags: [],
    createdAt: '2026-08-12T00:00:00Z',
    updatedAt: '2026-08-12T00:00:00Z',
  },
  quantity: 1,
  claimedQuantity: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  redis.expire.mockResolvedValue(1);
  redis.set.mockResolvedValue('OK');
  rawRedis.get.mockResolvedValue(null);
});

describe('battle-map marker publication', () => {
  it('rejects a DM identity mismatch', async () => {
    verifyDmAuthority.mockResolvedValue('mismatch');
    const request = new NextRequest('http://localhost/api', {
      method: 'PUT',
      body: JSON.stringify({
        dmId: 'wrong',
        markers: [publicMarker],
        loot: [ledgerEntry],
      }),
    });
    const response = await PUT(request, params);
    expect(response.status).toBe(403);
    expect(seedMarkerLoot).not.toHaveBeenCalled();
  });

  it('stores only the sanitized public projection with canonical counts', async () => {
    verifyDmAuthority.mockResolvedValue('ok');
    seedMarkerLoot.mockResolvedValue([{ ...ledgerEntry, claimedQuantity: 1 }]);
    const request = new NextRequest('http://localhost/api', {
      method: 'PUT',
      body: JSON.stringify({
        dmId: 'dm-1',
        markers: [{ ...publicMarker, dmNotes: 'must not survive' }],
        loot: [ledgerEntry],
      }),
    });
    const response = await PUT(request, params);
    expect(response.status).toBe(200);
    const stored = redis.set.mock.calls[0][1];
    expect(JSON.stringify(stored)).not.toContain('dmNotes');
    expect(stored[0].loot[0].remainingQuantity).toBe(0);
  });

  it('derives fresh remaining quantities from the canonical ledger', async () => {
    redis.get.mockResolvedValue([publicMarker]);
    rawRedis.get.mockResolvedValue(
      JSON.stringify([{ ...ledgerEntry, claimedQuantity: 1 }])
    );
    const response = await GET(new NextRequest('http://localhost/api'), params);
    expect((await response.json()).markers[0].loot[0].remainingQuantity).toBe(
      0
    );
  });
});

describe('player marker loot claims', () => {
  const request = () =>
    new NextRequest('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({
        playerId: 'player-1',
        markerId: 'marker-1',
        entryId: 'entry-1',
        requestId: 'request-1',
      }),
    });

  it('rejects a character outside the campaign', async () => {
    redis.sismember.mockResolvedValue(0);
    const response = await POST(request(), params);
    expect(response.status).toBe(403);
    expect(claimMarkerLoot).not.toHaveBeenCalled();
  });

  it('maps simultaneous last-item loss to a conflict', async () => {
    redis.sismember.mockResolvedValue(1);
    claimMarkerLoot.mockResolvedValue({ ok: false, error: 'depleted' });
    const response = await POST(request(), params);
    expect(response.status).toBe(409);
  });

  it('scopes retry receipts to the map, player, and request id', async () => {
    redis.sismember.mockResolvedValue(1);
    claimMarkerLoot.mockResolvedValue({
      ok: true,
      claim: {
        requestId: 'request-1',
        markerId: 'marker-1',
        entryId: 'entry-1',
        remainingQuantity: 0,
        transferId: 'transfer-loot-request-1',
      },
    });
    redis.get.mockResolvedValue([publicMarker]);
    rawRedis.get.mockResolvedValue(
      JSON.stringify([{ ...ledgerEntry, claimedQuantity: 1 }])
    );
    const response = await POST(request(), params);
    expect(response.status).toBe(200);
    expect(claimMarkerLoot.mock.calls[0][1].receipt).toBe(
      'claim:ABC:map-1:player-1:request-1'
    );
  });
});
