import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// `redis` and `rawRedis` are deliberately DISTINCT objects (mirroring the
// sibling `../route.test.ts`) so call-site client identity is assertable:
// `verifyDmAuthority` must receive the default client, and the sales log
// itself must be read via the raw, non-auto-deserializing client (it's
// written as a literal JSON string by `PURCHASE_SCRIPT`'s `cjson.encode`).
const {
  redis,
  rawRedis,
  verifyDmAuthority,
  rejectHybridGuestPrivilegeEscalation,
} = vi.hoisted(() => ({
  redis: { get: vi.fn() },
  rawRedis: { get: vi.fn() },
  verifyDmAuthority: vi.fn(),
  rejectHybridGuestPrivilegeEscalation: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  getRedis: () => redis,
  getRawRedis: () => rawRedis,
  campaignShopSalesKey: (code: string, npcId: string) =>
    `shop-sales:${code}:${npcId}`,
}));
vi.mock('@/lib/dmAuth', () => ({ verifyDmAuthority }));
vi.mock('@/lib/guestRouteResponses', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/guestRouteResponses')>();
  return { ...actual, rejectHybridGuestPrivilegeEscalation };
});

import { GET } from './route';

const params = { params: Promise.resolve({ code: 'ABC', npcId: 'npc-1' }) };

function getRequest(query = '') {
  return new NextRequest(`http://localhost/api${query}`, { method: 'GET' });
}

const sale = {
  id: 'sale-req-1',
  entryId: 'item-1',
  quantity: 2,
  copper: 200,
  playerId: 'player-1',
  at: '2026-09-07T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  rejectHybridGuestPrivilegeEscalation.mockReturnValue(null);
  verifyDmAuthority.mockResolvedValue('ok');
});

describe('shop sales route — auth', () => {
  it('rejects a hybrid guest before checking anything else', async () => {
    rejectHybridGuestPrivilegeEscalation.mockReturnValue(
      NextResponse.json(
        { error: 'Guest sessions cannot perform DM or owner operations' },
        { status: 403 }
      )
    );
    const response = await GET(getRequest('?dmId=dm-1'), params);
    expect(response.status).toBe(403);
    expect(verifyDmAuthority).not.toHaveBeenCalled();
    expect(rawRedis.get).not.toHaveBeenCalled();
  });

  it('rejects a request with no dmId', async () => {
    const response = await GET(getRequest(), params);
    expect(response.status).toBe(400);
    expect(verifyDmAuthority).not.toHaveBeenCalled();
  });

  it('rejects a non-DM (dmId mismatch)', async () => {
    verifyDmAuthority.mockResolvedValue('mismatch');
    const response = await GET(getRequest('?dmId=not-the-dm'), params);
    expect(response.status).toBe(403);
    expect(rawRedis.get).not.toHaveBeenCalled();
  });

  it('rejects when the campaign itself is missing', async () => {
    verifyDmAuthority.mockResolvedValue('missing');
    const response = await GET(getRequest('?dmId=dm-1'), params);
    expect(response.status).toBe(403);
  });
});

describe('shop sales route — reading the log', () => {
  it('returns an empty log when nothing has been sold', async () => {
    rawRedis.get.mockResolvedValue(null);
    const response = await GET(getRequest('?dmId=dm-1'), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sales: [] });
    expect(rawRedis.get).toHaveBeenCalledWith('shop-sales:ABC:npc-1');
  });

  it('parses a well-formed stored sales log via the RAW client', async () => {
    rawRedis.get.mockResolvedValue(JSON.stringify([sale]));
    const response = await GET(getRequest('?dmId=dm-1'), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sales: [sale] });
    // Never the auto-deserializing default client for this key.
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('drops a malformed row instead of failing the whole request', async () => {
    const malformed = { ...sale, id: 'sale-req-2', copper: -1 };
    rawRedis.get.mockResolvedValue(JSON.stringify([sale, malformed]));
    const response = await GET(getRequest('?dmId=dm-1'), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sales: [sale] });
  });

  it('maps an unexpected failure to 500', async () => {
    rawRedis.get.mockRejectedValue(new Error('redis down'));
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const response = await GET(getRequest('?dmId=dm-1'), params);
    expect(response.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
