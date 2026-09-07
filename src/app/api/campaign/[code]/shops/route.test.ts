import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Manual mocks, mirroring `shops/[npcId]/route.test.ts` and
// `battlemaps/[id]/markers/route.test.ts`'s convention for this route
// family. `pipeline()` returns a tiny recording double: `get` pushes the
// requested key and returns `this` (chainable, matching the real client),
// `exec` resolves to whatever the test queues via `pipelineExec`.
const { redis, authorizeHybridGuestRoute, sanitizePublicShop } = vi.hoisted(
  () => {
    const pipelineGetKeys: string[] = [];
    const pipelineExec = vi.fn();
    return {
      redis: {
        smembers: vi.fn(),
        srem: vi.fn(),
        pipeline: vi.fn(() => ({
          get: (key: string) => {
            pipelineGetKeys.push(key);
          },
          exec: pipelineExec,
        })),
        // Exposed so tests can both queue results and assert on the exact
        // keys the pipeline was built with.
        __pipelineGetKeys: pipelineGetKeys,
        __pipelineExec: pipelineExec,
      },
      authorizeHybridGuestRoute: vi.fn(),
      sanitizePublicShop: vi.fn(),
    };
  }
);

vi.mock('@/lib/redis', () => ({
  getRedis: () => redis,
  campaignShopKey: (code: string, npcId: string) => `shop:${code}:${npcId}`,
  campaignShopsIndexKey: (code: string) => `shops-index:${code}`,
}));
vi.mock('@/lib/supabase/guestSessionServer', () => ({
  authorizeHybridGuestRoute,
}));
vi.mock('@/lib/shopProjection', () => ({ sanitizePublicShop }));

import { GET } from './route';

const params = { params: Promise.resolve({ code: 'ABC' }) };

function getRequest() {
  return new NextRequest('http://localhost/api', { method: 'GET' });
}

function makeShop(overrides: Record<string, unknown> = {}) {
  return {
    npcId: 'npc-1',
    merchantName: 'Old Tam',
    entityIds: ['entity-1'],
    items: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  redis.__pipelineGetKeys.length = 0;
  authorizeHybridGuestRoute.mockResolvedValue({ mode: 'legacy' });
  redis.srem.mockResolvedValue(0);
  // Default: sanitizePublicShop is an identity pass-through unless a test
  // overrides it to simulate a corrupted/stale stored value.
  sanitizePublicShop.mockImplementation(value => value);
});

describe('shop index route — auth', () => {
  it('rejects a denied caller before touching redis', async () => {
    authorizeHybridGuestRoute.mockResolvedValue({
      mode: 'denied',
      status: 403,
      clearCookie: false,
    });
    const response = await GET(getRequest(), params);
    expect(response.status).toBe(403);
    expect(redis.smembers).not.toHaveBeenCalled();
  });
});

describe('shop index route — empty index', () => {
  it('returns an empty list without touching the pipeline when the index has no members', async () => {
    redis.smembers.mockResolvedValue([]);
    const response = await GET(getRequest(), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ shops: [] });
    expect(redis.pipeline).not.toHaveBeenCalled();
  });
});

describe('shop index route — listing open shops', () => {
  it('reads the index set, fetches each shop key via a pipeline, and returns the minimal per-shop fields', async () => {
    redis.smembers.mockResolvedValue(['npc-1', 'npc-2']);
    redis.__pipelineExec.mockResolvedValue([
      JSON.stringify(makeShop({ npcId: 'npc-1', merchantName: 'Old Tam' })),
      JSON.stringify(
        makeShop({
          npcId: 'npc-2',
          merchantName: 'Brenn',
          entityIds: ['entity-2', 'entity-3'],
        })
      ),
    ]);

    const response = await GET(getRequest(), params);
    expect(response.status).toBe(200);
    expect(redis.__pipelineGetKeys).toEqual([
      'shop:ABC:npc-1',
      'shop:ABC:npc-2',
    ]);

    const body = await response.json();
    expect(body.shops).toEqual([
      { npcId: 'npc-1', merchantName: 'Old Tam', entityIds: ['entity-1'] },
      {
        npcId: 'npc-2',
        merchantName: 'Brenn',
        entityIds: ['entity-2', 'entity-3'],
      },
    ]);
    // Never leaks items — the index is deliberately minimal.
    expect(JSON.stringify(body)).not.toContain('"items"');
    expect(redis.srem).not.toHaveBeenCalled();
  });

  it('drops a stale entry (missing/invalid shop key) from the response and lazily self-heals the index', async () => {
    redis.smembers.mockResolvedValue(['npc-1', 'npc-stale']);
    redis.__pipelineExec.mockResolvedValue([
      JSON.stringify(makeShop()),
      null, // npc-stale's projection key has expired
    ]);

    const response = await GET(getRequest(), params);
    const body = await response.json();
    expect(body.shops).toEqual([
      { npcId: 'npc-1', merchantName: 'Old Tam', entityIds: ['entity-1'] },
    ]);
    expect(redis.srem).toHaveBeenCalledWith('shops-index:ABC', 'npc-stale');
  });

  it('drops an entry that fails sanitizePublicShop (well-formed JSON, invalid shape)', async () => {
    redis.smembers.mockResolvedValue(['npc-1']);
    redis.__pipelineExec.mockResolvedValue([
      JSON.stringify({ not: 'a valid shop shape' }),
    ]);
    sanitizePublicShop.mockReturnValue(null);

    const response = await GET(getRequest(), params);
    const body = await response.json();
    expect(body.shops).toEqual([]);
    expect(redis.srem).toHaveBeenCalledWith('shops-index:ABC', 'npc-1');
  });

  it('a srem cleanup failure never turns a good response into an error', async () => {
    redis.smembers.mockResolvedValue(['npc-1', 'npc-stale']);
    redis.__pipelineExec.mockResolvedValue([JSON.stringify(makeShop()), null]);
    redis.srem.mockRejectedValue(new Error('redis outage'));

    const response = await GET(getRequest(), params);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.shops).toHaveLength(1);
  });

  it('handles an already-object pipeline result (default client auto-deserialization) the same as a raw string', async () => {
    redis.smembers.mockResolvedValue(['npc-1']);
    redis.__pipelineExec.mockResolvedValue([makeShop()]);

    const response = await GET(getRequest(), params);
    const body = await response.json();
    expect(body.shops).toEqual([
      { npcId: 'npc-1', merchantName: 'Old Tam', entityIds: ['entity-1'] },
    ]);
  });
});

describe('shop index route — errors', () => {
  it('maps an unexpected failure to 500', async () => {
    redis.smembers.mockRejectedValue(new Error('redis outage'));
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const response = await GET(getRequest(), params);
    expect(response.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });
});
