import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// `redis` and `rawRedis` are deliberately DISTINCT objects (mirroring
// `markers/route.test.ts`) so call-site client identity is assertable: the
// route must pass `rawRedis` (the raw, non-auto-deserializing client) to
// `seedShopLedger`, and `redis` (the default client) to `verifyDmAuthority`/
// `set`/`del`. A shared mock object would let a swap regress silently.
const {
  redis,
  rawRedis,
  verifyDmAuthority,
  rejectHybridGuestPrivilegeEscalation,
  seedShopLedger,
} = vi.hoisted(() => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  rawRedis: { get: vi.fn(), eval: vi.fn() },
  verifyDmAuthority: vi.fn(),
  rejectHybridGuestPrivilegeEscalation: vi.fn(),
  seedShopLedger: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  getRedis: () => redis,
  getRawRedis: () => rawRedis,
  campaignShopKey: (code: string, npcId: string) => `shop:${code}:${npcId}`,
  campaignShopLedgerKey: (code: string, npcId: string) =>
    `shop-ledger:${code}:${npcId}`,
  SLIDING_TTL_SECONDS: 3600,
}));
vi.mock('@/lib/dmAuth', () => ({ verifyDmAuthority }));
vi.mock('@/lib/guestRouteResponses', () => ({
  rejectHybridGuestPrivilegeEscalation,
}));
vi.mock('@/lib/shopPurchases', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/shopPurchases')>();
  return { ...actual, seedShopLedger };
});

import {
  INVALID_SHOP_LEDGER_SEED_ERROR,
  SHOP_LEDGER_SEED_TOO_LARGE_ERROR,
} from '@/lib/shopPurchases';

import { PUT } from './route';

const params = { params: Promise.resolve({ code: 'ABC', npcId: 'npc-1' }) };

function makeNpc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'npc-1',
    campaignCode: 'ABC',
    name: 'Old Tam',
    armorClass: '10',
    maxHp: 10,
    speed: '30 ft',
    inventory: [
      {
        id: 'item-1',
        name: 'Rope, 50ft',
        quantity: 5,
        forSale: true,
        value: 100,
      },
    ],
    shop: { open: true, updatedAt: '2026-01-01T00:00:00.000Z' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

const storedLedgerEntry = {
  id: 'item-1',
  name: 'Rope, 50ft',
  itemKind: 'inventory',
  priceCopper: 100,
  remainingQuantity: 5,
  soldQuantity: 0,
  item: {
    id: 'item-1',
    name: 'Rope, 50ft',
    category: 'misc',
    quantity: 1,
    location: 'Backpack',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  rejectHybridGuestPrivilegeEscalation.mockReturnValue(null);
  verifyDmAuthority.mockResolvedValue('ok');
  redis.set.mockResolvedValue('OK');
  redis.del.mockResolvedValue(1);
  seedShopLedger.mockResolvedValue([storedLedgerEntry]);
});

describe('shop publish route — auth', () => {
  it('rejects a non-DM (dmId mismatch)', async () => {
    verifyDmAuthority.mockResolvedValue('mismatch');
    const response = await PUT(
      request({ dmId: 'not-the-dm', npc: makeNpc(), entityIds: ['entity-1'] }),
      params
    );
    expect(response.status).toBe(403);
    expect(seedShopLedger).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('rejects a hybrid guest before checking DM authority at all', async () => {
    rejectHybridGuestPrivilegeEscalation.mockReturnValue(
      NextResponse.json(
        { error: 'Guest sessions cannot perform DM or owner operations' },
        { status: 403 }
      )
    );
    const response = await PUT(
      request({ dmId: 'dm-1', npc: makeNpc(), entityIds: ['entity-1'] }),
      params
    );
    expect(response.status).toBe(403);
    expect(verifyDmAuthority).not.toHaveBeenCalled();
    expect(seedShopLedger).not.toHaveBeenCalled();
  });
});

describe('shop publish route — publishing an open shop', () => {
  it('writes the public projection and seeds the ledger, both with a TTL', async () => {
    const response = await PUT(
      request({ dmId: 'dm-1', npc: makeNpc(), entityIds: ['entity-1'] }),
      params
    );
    expect(response.status).toBe(200);

    expect(seedShopLedger).toHaveBeenCalledOnce();
    const [redisArg, ledgerKeyArg, seedArg, ttlArg] =
      seedShopLedger.mock.calls[0];
    // The Critical fix: seedShopLedger must receive the RAW client, never
    // the auto-deserializing default — see the note on `getRawRedis` above.
    expect(redisArg).toBe(rawRedis);
    expect(ledgerKeyArg).toBe('shop-ledger:ABC:npc-1');
    expect(seedArg).toEqual([
      expect.objectContaining({ id: 'item-1', seededQuantity: 5 }),
    ]);
    expect(ttlArg).toBe(3600);

    expect(redis.set).toHaveBeenCalledOnce();
    const [shopKeyArg, storedShop, options] = redis.set.mock.calls[0];
    expect(shopKeyArg).toBe('shop:ABC:npc-1');
    expect(options).toEqual({ ex: 3600 });
    const parsed = JSON.parse(storedShop as string);
    expect(parsed.npcId).toBe('npc-1');
    expect(parsed.entityIds).toEqual(['entity-1']);
    expect(parsed.items).toEqual([
      expect.objectContaining({ id: 'item-1', remainingQuantity: 5 }),
    ]);

    expect(redis.del).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.shop.items[0].remainingQuantity).toBe(5);
  });

  it('overlays the ledger canonical remaining quantity — a republish never restores sold stock (preserves sold quantities)', async () => {
    // The DM changes the price on republish; the (mocked) seed script
    // reports 2 units already sold against the fresh 10-unit stock.
    seedShopLedger.mockResolvedValue([
      {
        ...storedLedgerEntry,
        priceCopper: 150,
        remainingQuantity: 8,
        soldQuantity: 2,
      },
    ]);
    const npc = makeNpc({
      inventory: [
        {
          id: 'item-1',
          name: 'Rope, 50ft',
          quantity: 10,
          forSale: true,
          priceCopper: 150,
        },
      ],
    });

    const response = await PUT(
      request({ dmId: 'dm-1', npc, entityIds: ['entity-1'] }),
      params
    );
    expect(response.status).toBe(200);

    // The seed sent to seedShopLedger carries the freshly-authored total
    // (10) and the new price — never the stale remaining count.
    const [, , seedArg] = seedShopLedger.mock.calls[0];
    expect(seedArg).toEqual([
      expect.objectContaining({
        id: 'item-1',
        seededQuantity: 10,
        priceCopper: 150,
      }),
    ]);

    // But the PUBLISHED projection shows the ledger's canonical remaining
    // (8), not the freshly-authored total (10) — the 2 already-sold units
    // stay sold through the republish.
    const [, storedShop] = redis.set.mock.calls[0];
    const parsed = JSON.parse(storedShop as string);
    expect(parsed.items[0].remainingQuantity).toBe(8);
    expect(parsed.items[0].priceCopper).toBe(150);
  });

  it('rejects an out-of-bounds ledger seed before anything is written to Redis', async () => {
    seedShopLedger.mockRejectedValue(new Error(INVALID_SHOP_LEDGER_SEED_ERROR));
    const response = await PUT(
      request({ dmId: 'dm-1', npc: makeNpc(), entityIds: ['entity-1'] }),
      params
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: INVALID_SHOP_LEDGER_SEED_ERROR,
    });
    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('rejects a too-large ledger seed with its own distinguishable message, before anything is written', async () => {
    seedShopLedger.mockRejectedValue(
      new Error(SHOP_LEDGER_SEED_TOO_LARGE_ERROR)
    );
    const response = await PUT(
      request({ dmId: 'dm-1', npc: makeNpc(), entityIds: ['entity-1'] }),
      params
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: SHOP_LEDGER_SEED_TOO_LARGE_ERROR,
    });
    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  // Important fix: only the two known validation messages map to 400.
  // Anything else (a Redis outage, the exact serialization bug this review
  // caught — mismatched client producing a SyntaxError, etc.) must fall
  // through to the outer 500 handler rather than being reported as "your
  // shop data is invalid".
  it('maps an unrecognized seedShopLedger failure to 500, not 400', async () => {
    seedShopLedger.mockRejectedValue(
      new SyntaxError('Unexpected token o in JSON at position 1')
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const response = await PUT(
      request({ dmId: 'dm-1', npc: makeNpc(), entityIds: ['entity-1'] }),
      params
    );
    expect(response.status).toBe(500);
    expect(redis.set).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe('shop publish route — closing a shop', () => {
  it('deletes both the projection and ledger keys, and never seeds', async () => {
    const npc = makeNpc({
      shop: { open: false, updatedAt: '2026-01-01T00:00:00.000Z' },
    });
    const response = await PUT(
      request({ dmId: 'dm-1', npc, entityIds: ['entity-1'] }),
      params
    );
    expect(response.status).toBe(200);
    expect(seedShopLedger).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith('shop:ABC:npc-1');
    expect(redis.del).toHaveBeenCalledWith('shop-ledger:ABC:npc-1');
    const body = await response.json();
    expect(body).toEqual({ success: true, shop: null });
  });

  it('treats an NPC with no shop field at all the same as closed', async () => {
    const npc = makeNpc({ shop: undefined });
    const response = await PUT(
      request({ dmId: 'dm-1', npc, entityIds: [] }),
      params
    );
    expect(response.status).toBe(200);
    expect(redis.del).toHaveBeenCalledWith('shop:ABC:npc-1');
    expect(redis.del).toHaveBeenCalledWith('shop-ledger:ABC:npc-1');
  });
});

describe('shop publish route — request validation', () => {
  it('rejects a missing dmId', async () => {
    const response = await PUT(
      request({ npc: makeNpc(), entityIds: [] }),
      params
    );
    expect(response.status).toBe(400);
  });

  it('rejects an npc whose id does not match the route param', async () => {
    const response = await PUT(
      request({
        dmId: 'dm-1',
        npc: makeNpc({ id: 'someone-else' }),
        entityIds: [],
      }),
      params
    );
    expect(response.status).toBe(400);
  });

  it('rejects a non-array entityIds', async () => {
    const response = await PUT(
      request({ dmId: 'dm-1', npc: makeNpc(), entityIds: 'not-an-array' }),
      params
    );
    expect(response.status).toBe(400);
  });
});
