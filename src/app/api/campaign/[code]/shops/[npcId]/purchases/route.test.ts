import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// `redis` and `rawRedis` are deliberately DISTINCT objects (mirroring
// `../route.test.ts`'s PUT suite) so call-site client identity is
// assertable: the route must pass `rawRedis` (the raw, non-auto-
// deserializing client) to `purchaseFromShop`, and `redis` (the default
// client) to the projection read and the poke. A shared mock object would
// let a swap regress silently — exactly the Critical this task's brief
// calls out as already having bitten the sibling `PUT` route once.
const { redis, rawRedis, purchaseFromShop, authorizeHybridGuestRoute } =
  vi.hoisted(() => ({
    redis: { get: vi.fn(), sismember: vi.fn() },
    rawRedis: { get: vi.fn(), eval: vi.fn() },
    purchaseFromShop: vi.fn(),
    authorizeHybridGuestRoute: vi.fn(),
  }));

const sendBattleMapPokeToLiveRooms = vi.hoisted(() => vi.fn());

vi.mock('@/lib/redis', () => ({
  getRedis: () => redis,
  getRawRedis: () => rawRedis,
  campaignPlayersKey: (code: string) => `players:${code}`,
  campaignShopKey: (code: string, npcId: string) => `shop:${code}:${npcId}`,
  campaignShopLedgerKey: (code: string, npcId: string) =>
    `shop-ledger:${code}:${npcId}`,
  campaignShopSalesKey: (code: string, npcId: string) =>
    `shop-sales:${code}:${npcId}`,
  campaignShopReceiptKey: (code: string, npcId: string, requestId: string) =>
    `shop-receipt:${code}:${npcId}:${requestId}`,
  campaignTransfersKey: (code: string, playerId: string) =>
    `transfers:${code}:${playerId}`,
  SLIDING_TTL_SECONDS: 3600,
}));
vi.mock('@/lib/relayPoke', () => ({ sendBattleMapPokeToLiveRooms }));
vi.mock('@/lib/supabase/guestSessionServer', () => ({
  authorizeHybridGuestRoute,
}));
vi.mock('@/lib/shopPurchases', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/shopPurchases')>();
  return { ...actual, purchaseFromShop };
});

import { POST } from './route';

const params = { params: Promise.resolve({ code: 'ABC', npcId: 'npc-1' }) };

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    playerId: 'player-1',
    entryId: 'item-1',
    requestId: 'request-1',
    quantity: 2,
    ...overrides,
  };
}

function makePublicShop(overrides: Record<string, unknown> = {}) {
  return {
    npcId: 'npc-1',
    merchantName: 'Old Tam',
    entityIds: ['entity-1'],
    items: [
      {
        id: 'item-1',
        name: 'Rope, 50ft',
        itemKind: 'inventory',
        priceCopper: 100,
        remainingQuantity: 10,
      },
    ],
    ...overrides,
  };
}

function okReceipt(overrides: Record<string, unknown> = {}) {
  return {
    ok: true as const,
    receipt: {
      npcId: 'npc-1',
      requestId: 'request-1',
      entryId: 'item-1',
      playerId: 'player-1',
      grantedQuantity: 2,
      costCopper: 200,
      remainingQuantity: 8,
      transferIds: ['transfer-shop-request-1-0'],
      ...overrides,
    },
  };
}

function guestResolution(legacyPlayerId: string | null) {
  return {
    mode: 'guest' as const,
    principal: {
      sessionId: 'session-1',
      campaignId: 'campaign-1',
      subjectId: 'subject-1',
      legacyPlayerId,
      scopes: ['marker:claim'],
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeHybridGuestRoute.mockResolvedValue({ mode: 'legacy' });
  redis.sismember.mockResolvedValue(1);
  redis.get.mockResolvedValue(JSON.stringify(makePublicShop()));
  purchaseFromShop.mockResolvedValue(okReceipt());
  sendBattleMapPokeToLiveRooms.mockResolvedValue(undefined);
});

describe('shop purchase route — request validation', () => {
  it('rejects a missing playerId, entryId, or requestId', async () => {
    for (const key of ['playerId', 'entryId', 'requestId']) {
      const response = await POST(
        request(validBody({ [key]: undefined })),
        params
      );
      expect(response.status).toBe(400);
    }
    expect(purchaseFromShop).not.toHaveBeenCalled();
  });

  it('rejects an empty-string, wrong-type, or over-long playerId/entryId/requestId', async () => {
    const overLong = 'x'.repeat(201);
    for (const key of ['playerId', 'entryId', 'requestId']) {
      for (const value of ['', 42, overLong]) {
        const response = await POST(
          request(validBody({ [key]: value })),
          params
        );
        expect(response.status).toBe(400);
      }
    }
    expect(purchaseFromShop).not.toHaveBeenCalled();
  });

  it('defaults a missing quantity to 1', async () => {
    await POST(request(validBody({ quantity: undefined })), params);
    expect(purchaseFromShop).toHaveBeenCalledOnce();
    expect(purchaseFromShop.mock.calls[0][2]).toEqual(
      expect.objectContaining({ quantity: 1 })
    );
  });

  it('rejects a non-finite, non-integer, or out-of-range quantity', async () => {
    for (const quantity of [
      0,
      -1,
      1.5,
      1000,
      NaN,
      Infinity,
      -Infinity,
      'two',
    ]) {
      const response = await POST(request(validBody({ quantity })), params);
      expect(response.status).toBe(400);
    }
    expect(purchaseFromShop).not.toHaveBeenCalled();
  });
});

describe('shop purchase route — auth', () => {
  it('rejects a caller the guest resolver denies, before touching the ledger', async () => {
    authorizeHybridGuestRoute.mockResolvedValue({
      mode: 'denied',
      status: 403,
      clearCookie: false,
    });
    const response = await POST(request(validBody()), params);
    expect(response.status).toBe(403);
    expect(purchaseFromShop).not.toHaveBeenCalled();
  });

  it('rejects a hybrid guest bound to a different player', async () => {
    authorizeHybridGuestRoute.mockResolvedValue(
      guestResolution('someone-else')
    );
    const response = await POST(
      request(validBody({ playerId: 'player-1' })),
      params
    );
    expect(response.status).toBe(403);
    expect(purchaseFromShop).not.toHaveBeenCalled();
  });

  it('allows a hybrid guest bound to the asserted player, using the bound id', async () => {
    authorizeHybridGuestRoute.mockResolvedValue(guestResolution('player-1'));
    const response = await POST(
      request(validBody({ playerId: 'player-1' })),
      params
    );
    expect(response.status).toBe(200);
    const [, keysArg, inputArg] = purchaseFromShop.mock.calls[0];
    expect(inputArg.playerId).toBe('player-1');
    expect(keysArg.transfers).toBe('transfers:ABC:player-1');
  });
});

describe('shop purchase route — campaign membership (Critical)', () => {
  // In legacy mode (the hybrid guest server disabled — the common case in
  // this test file), `authorizedPlayerId` is nothing but the client's own
  // asserted `playerId`. Campaign codes are party-shared, not secret, so
  // without this guard anyone holding `code` + `npcId` could name an
  // arbitrary player and drain their shop stock / queue a debit against
  // them. Mirrors `battlemaps/[id]/markers/route.ts`'s identical guard.
  it('rejects a playerId that is not a member of this campaign', async () => {
    redis.sismember.mockResolvedValue(0);
    const response = await POST(
      request(validBody({ playerId: 'not-a-member' })),
      params
    );
    expect(response.status).toBe(403);
    expect(purchaseFromShop).not.toHaveBeenCalled();
  });

  it('checks membership under the campaign players key, for the authorized id', async () => {
    await POST(request(validBody({ playerId: 'player-1' })), params);
    expect(redis.sismember).toHaveBeenCalledWith('players:ABC', 'player-1');
  });

  it('checks membership for a guest bound id, not the raw asserted playerId', async () => {
    authorizeHybridGuestRoute.mockResolvedValue(guestResolution('player-1'));
    await POST(request(validBody({ playerId: 'player-1' })), params);
    expect(redis.sismember).toHaveBeenCalledWith('players:ABC', 'player-1');
  });
});

describe('shop purchase route — client identity', () => {
  it('passes the RAW client to purchaseFromShop, never the default client', async () => {
    await POST(request(validBody()), params);
    expect(purchaseFromShop).toHaveBeenCalledOnce();
    const [redisArg] = purchaseFromShop.mock.calls[0];
    expect(redisArg).toBe(rawRedis);
    expect(redisArg).not.toBe(redis);
  });

  it('reads the public projection (for merchantName) via the default client', async () => {
    await POST(request(validBody()), params);
    expect(redis.get).toHaveBeenCalledWith('shop:ABC:npc-1');
  });
});

describe('shop purchase route — server-side pricing only', () => {
  it('ignores a forged costCopper in the body entirely', async () => {
    const response = await POST(request(validBody({ costCopper: 1 })), params);
    expect(response.status).toBe(200);
    const body = await response.json();
    // The mocked receipt's real (server-computed) price, never the forged one.
    expect(body.costCopper).toBe(200);
    expect(purchaseFromShop.mock.calls[0][2]).not.toHaveProperty('costCopper');
  });
});

describe('shop purchase route — error taxonomy', () => {
  it('maps shop-closed to 409', async () => {
    purchaseFromShop.mockResolvedValue({ ok: false, error: 'shop-closed' });
    const response = await POST(request(validBody()), params);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'shop-closed' });
  });

  it('maps entry-not-found to 404', async () => {
    purchaseFromShop.mockResolvedValue({ ok: false, error: 'entry-not-found' });
    const response = await POST(request(validBody()), params);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'entry-not-found' });
  });

  it('maps insufficient-stock to 409', async () => {
    purchaseFromShop.mockResolvedValue({
      ok: false,
      error: 'insufficient-stock',
    });
    const response = await POST(request(validBody()), params);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'insufficient-stock' });
  });
});

describe('shop purchase route — receipt ownership', () => {
  it('rejects a replayed requestId whose receipt belongs to another player', async () => {
    purchaseFromShop.mockResolvedValue(okReceipt({ playerId: 'other-player' }));
    const response = await POST(
      request(validBody({ playerId: 'player-1' })),
      params
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    // Never echo the other player's purchase back.
    expect(body).not.toHaveProperty('grantedQuantity');
    expect(body).not.toHaveProperty('costCopper');
    expect(sendBattleMapPokeToLiveRooms).not.toHaveBeenCalled();
  });

  it('rejects a requestId reused against a different entryId', async () => {
    purchaseFromShop.mockResolvedValue(okReceipt({ entryId: 'other-item' }));
    const response = await POST(
      request(validBody({ playerId: 'player-1', entryId: 'item-1' })),
      params
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).not.toHaveProperty('grantedQuantity');
    expect(body).not.toHaveProperty('costCopper');
    expect(sendBattleMapPokeToLiveRooms).not.toHaveBeenCalled();
  });

  it('succeeds and echoes the receipt when playerId matches the caller', async () => {
    const response = await POST(request(validBody()), params);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      entryId: 'item-1',
      grantedQuantity: 2,
      costCopper: 200,
      remainingQuantity: 8,
    });
  });
});

describe('shop purchase route — magic-item clamp visibility', () => {
  it('surfaces a grantedQuantity smaller than requested (magic-item fan-out cap)', async () => {
    purchaseFromShop.mockResolvedValue(
      okReceipt({ grantedQuantity: 25, costCopper: 2500 })
    );
    const response = await POST(request(validBody({ quantity: 999 })), params);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.grantedQuantity).toBe(25);
    expect(body.costCopper).toBe(2500);
  });
});

describe('shop purchase route — best-effort poke', () => {
  it('pokes live rooms with the default client after a successful sale', async () => {
    await POST(request(validBody()), params);
    expect(sendBattleMapPokeToLiveRooms).toHaveBeenCalledWith(
      'ABC',
      redis,
      'shop'
    );
  });

  it('does not poke after a rejected purchase', async () => {
    purchaseFromShop.mockResolvedValue({ ok: false, error: 'shop-closed' });
    await POST(request(validBody()), params);
    expect(sendBattleMapPokeToLiveRooms).not.toHaveBeenCalled();
  });

  it('a failing poke never fails the sale', async () => {
    sendBattleMapPokeToLiveRooms.mockRejectedValue(new Error('relay down'));
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const response = await POST(request(validBody()), params);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });
});

describe('shop purchase route — merchant name fallback', () => {
  it('falls back to a generic merchant name when the projection is missing', async () => {
    redis.get.mockResolvedValue(null);
    await POST(request(validBody()), params);
    expect(purchaseFromShop).toHaveBeenCalledOnce();
    expect(purchaseFromShop.mock.calls[0][2]).toEqual(
      expect.objectContaining({ merchantName: 'Shop' })
    );
  });

  it('uses the published merchantName when the projection is present', async () => {
    await POST(request(validBody()), params);
    expect(purchaseFromShop.mock.calls[0][2]).toEqual(
      expect.objectContaining({ merchantName: 'Old Tam' })
    );
  });

  it('falls back to a generic merchant name — never 500s — on a corrupt/non-JSON projection', async () => {
    redis.get.mockResolvedValue('{not valid json');
    const response = await POST(request(validBody()), params);
    expect(response.status).toBe(200);
    expect(purchaseFromShop.mock.calls[0][2]).toEqual(
      expect.objectContaining({ merchantName: 'Shop' })
    );
  });
});
