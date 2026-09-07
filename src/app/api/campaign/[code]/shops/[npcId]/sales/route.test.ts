import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// `redis` and `rawRedis` are deliberately DISTINCT objects (mirroring the
// sibling `../route.test.ts`) so call-site client identity is assertable:
// `verifyDmAuthority` must receive the default client, and the sales log
// itself must be read via the raw, non-auto-deserializing client (it's
// written as a literal JSON string by `PURCHASE_SCRIPT`'s `cjson.encode`).
// `redis` and `rawRedis` are deliberately DISTINCT objects (mirroring the
// sibling `../route.test.ts`) so call-site client identity is assertable:
// `verifyDmAuthority` must receive the default client, and the sales log
// itself must be read/written via the raw, non-auto-deserializing client
// (it's a literal JSON string owned by `PURCHASE_SCRIPT`'s `cjson.encode`,
// and — Task 12a review fix — the DELETE handler below now acknowledges via
// a single atomic `EVAL` (`rawRedis.eval`), never a separate `get`/`set`,
// so a concurrent `PURCHASE_SCRIPT` append can never be silently erased by
// a stale in-JS snapshot. `@/lib/shopPurchases` is intentionally NOT
// mocked in this file — `acknowledgeShopSales`'s KEYS/ARGV-shape and
// return-parsing are exercised for real here, against a mocked `eval`; the
// real Lua filtering/atomicity is proven against real Redis in
// scripts/shop-redis.integration.test.mjs.
const {
  redis,
  rawRedis,
  verifyDmAuthority,
  rejectHybridGuestPrivilegeEscalation,
} = vi.hoisted(() => ({
  redis: { get: vi.fn() },
  rawRedis: { get: vi.fn(), eval: vi.fn() },
  verifyDmAuthority: vi.fn(),
  rejectHybridGuestPrivilegeEscalation: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  getRedis: () => redis,
  getRawRedis: () => rawRedis,
  campaignShopSalesKey: (code: string, npcId: string) =>
    `shop-sales:${code}:${npcId}`,
  SLIDING_TTL_SECONDS: 60 * 24 * 60 * 60,
}));
vi.mock('@/lib/dmAuth', () => ({ verifyDmAuthority }));
vi.mock('@/lib/guestRouteResponses', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/guestRouteResponses')>();
  return { ...actual, rejectHybridGuestPrivilegeEscalation };
});

import { SALES_ACK_SCRIPT } from '@/lib/shopPurchases';

import { DELETE, GET } from './route';

const params = { params: Promise.resolve({ code: 'ABC', npcId: 'npc-1' }) };

function getRequest(query = '') {
  return new NextRequest(`http://localhost/api${query}`, { method: 'GET' });
}

function deleteRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api', {
    method: 'DELETE',
    body: JSON.stringify(body),
  });
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

const saleTwo = {
  id: 'sale-req-2',
  entryId: 'item-2',
  quantity: 1,
  copper: 50,
  playerId: 'player-2',
  at: '2026-09-07T00:01:00.000Z',
};
const saleThree = {
  id: 'sale-req-3',
  entryId: 'item-1',
  quantity: 1,
  copper: 100,
  playerId: 'player-1',
  at: '2026-09-07T00:02:00.000Z',
};

describe('shop sales route — DELETE (acknowledge) auth', () => {
  it('rejects a hybrid guest before checking anything else', async () => {
    rejectHybridGuestPrivilegeEscalation.mockReturnValue(
      NextResponse.json(
        { error: 'Guest sessions cannot perform DM or owner operations' },
        { status: 403 }
      )
    );
    const response = await DELETE(
      deleteRequest({ dmId: 'dm-1', saleIds: ['sale-req-1'] }),
      params
    );
    expect(response.status).toBe(403);
    expect(verifyDmAuthority).not.toHaveBeenCalled();
    expect(rawRedis.eval).not.toHaveBeenCalled();
  });

  it('rejects a request with no dmId', async () => {
    const response = await DELETE(
      deleteRequest({ saleIds: ['sale-req-1'] }),
      params
    );
    expect(response.status).toBe(400);
    expect(verifyDmAuthority).not.toHaveBeenCalled();
  });

  // Minor fix (Task 12a review): DELETE used to accept dmId: '' where the
  // sibling GET's `!dmId` check already rejected it — an avoidable
  // divergence from the route this one was written to mirror exactly.
  it('rejects an empty-string dmId the same as a missing one', async () => {
    const response = await DELETE(
      deleteRequest({ dmId: '', saleIds: ['sale-req-1'] }),
      params
    );
    expect(response.status).toBe(400);
    expect(verifyDmAuthority).not.toHaveBeenCalled();
  });

  it('rejects a non-DM (dmId mismatch)', async () => {
    verifyDmAuthority.mockResolvedValue('mismatch');
    const response = await DELETE(
      deleteRequest({ dmId: 'not-the-dm', saleIds: ['sale-req-1'] }),
      params
    );
    expect(response.status).toBe(403);
    expect(rawRedis.eval).not.toHaveBeenCalled();
  });

  it('rejects when the campaign itself is missing', async () => {
    verifyDmAuthority.mockResolvedValue('missing');
    const response = await DELETE(
      deleteRequest({ dmId: 'dm-1', saleIds: ['sale-req-1'] }),
      params
    );
    expect(response.status).toBe(403);
  });

  it('rejects a malformed saleIds payload', async () => {
    const response = await DELETE(
      deleteRequest({ dmId: 'dm-1', saleIds: [123, 'sale-req-1'] }),
      params
    );
    expect(response.status).toBe(400);
    expect(rawRedis.eval).not.toHaveBeenCalled();
  });
});

describe('shop sales route — DELETE (acknowledge) behavior', () => {
  it('an empty saleIds array is a no-op and never wipes the log', async () => {
    const response = await DELETE(
      deleteRequest({ dmId: 'dm-1', saleIds: [] }),
      params
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    // Never even runs the ack script for an empty batch — this guarantee
    // must hold regardless of what the Lua script would do with one.
    expect(rawRedis.eval).not.toHaveBeenCalled();
  });

  // Task 12a review fix, Critical: the ack must be ONE atomic EVAL, never a
  // separate get-then-set/del from the route — a PURCHASE_SCRIPT append
  // landing between those two would otherwise be silently erased by a set
  // computed from a stale snapshot. This asserts the route calls
  // `SALES_ACK_SCRIPT` exactly once with the documented KEYS/ARGV; the
  // script's own filtering/atomicity is proven for real in
  // shopPurchases.test.ts (mocked eval) and
  // scripts/shop-redis.integration.test.mjs (real Redis, concurrent
  // append).
  it('acknowledges via exactly one atomic EVAL call with the documented KEYS/ARGV', async () => {
    rawRedis.eval.mockResolvedValue(JSON.stringify([saleTwo, saleThree]));
    const response = await DELETE(
      deleteRequest({ dmId: 'dm-1', saleIds: [sale.id] }),
      params
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(rawRedis.eval).toHaveBeenCalledOnce();
    expect(rawRedis.eval).toHaveBeenCalledWith(
      SALES_ACK_SCRIPT,
      ['shop-sales:ABC:npc-1'],
      [JSON.stringify([sale.id]), 60 * 24 * 60 * 60]
    );
    // Never the auto-deserializing default client for this key.
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('acknowledges every id in the log in a single batch call, not one per id', async () => {
    rawRedis.eval.mockResolvedValue('[]');
    const response = await DELETE(
      deleteRequest({ dmId: 'dm-1', saleIds: [sale.id, saleTwo.id] }),
      params
    );
    expect(response.status).toBe(200);
    expect(rawRedis.eval).toHaveBeenCalledOnce();
    expect(rawRedis.eval.mock.calls[0][2][0]).toBe(
      JSON.stringify([sale.id, saleTwo.id])
    );
  });

  it('maps an unexpected failure to 500', async () => {
    rawRedis.eval.mockRejectedValue(new Error('redis down'));
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const response = await DELETE(
      deleteRequest({ dmId: 'dm-1', saleIds: ['sale-req-1'] }),
      params
    );
    expect(response.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
