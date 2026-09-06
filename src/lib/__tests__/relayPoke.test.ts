import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendInitiativePoke,
  sendBattleMapPoke,
  sendBattleMapPokeToRoom,
  sendBattleMapPokeToLiveRooms,
  relayHttpUrl,
} from '@/lib/relayPoke';
import { verifyBattleMapToken } from '@/lib/battlemapToken';

const CODE = 'CAMP1';
const SECRET = 'test-secret';

/**
 * Satisfies both `RedisReader` (for the activeBattleMapId fallback) and
 * `LiveMapRoomsReader` (for the live-room registry read) — every wrapper in
 * relayPoke.ts now needs both, since `sendBattleMapPoke` and
 * `sendInitiativePoke` delegate through `sendBattleMapPokeToLiveRooms`.
 */
interface MockRedis {
  get<T = unknown>(key: string): Promise<T | null>;
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;
  zrange(
    key: string,
    min: number,
    max: number,
    opts?: { rev?: boolean }
  ): Promise<unknown[]>;
}

/** `liveRooms` defaults to empty so callers exercise the active-map fallback. */
function redisWith(
  battlemapValue: unknown,
  liveRooms: string[] = []
): MockRedis {
  return {
    get: vi.fn(async (key: string) =>
      key.includes('battlemap') ? battlemapValue : null
    ) as <T = unknown>(key: string) => Promise<T | null>,
    zremrangebyscore: vi.fn(async () => 0),
    zrange: vi.fn(async () => liveRooms),
  };
}

type MockLiveRoomsRedis = MockRedis;

/**
 * A combined fake satisfying both `RedisReader` (for the activeBattleMapId
 * fallback) and `LiveMapRoomsReader` (for the live-room registry read).
 * `liveRooms` is what `zrange` returns; `battlemapValue` is what `get`
 * returns for the shared battlemap key, used only on fallback.
 */
function liveRoomsRedisWith(
  liveRooms: string[],
  battlemapValue: unknown = null
): MockLiveRoomsRedis {
  return redisWith(battlemapValue, liveRooms);
}

describe('relayHttpUrl', () => {
  it('converts ws(s) scheme to http(s) and strips trailing slash', () => {
    expect(relayHttpUrl('wss://relay.example.com')).toBe(
      'https://relay.example.com'
    );
    expect(relayHttpUrl('ws://localhost:8787')).toBe('http://localhost:8787');
    expect(relayHttpUrl('wss://relay.example.com/')).toBe(
      'https://relay.example.com'
    );
  });
});

describe('sendInitiativePoke', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', 'wss://relay.example.com');
    vi.stubEnv('BATTLEMAP_RELAY_SECRET', SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('POSTs a valid dm token for the active map room', async () => {
    const fetchFn = vi.fn(async () => new Response('{"sent":1}'));
    const redis = redisWith(
      JSON.stringify({ activeBattleMapId: 'map-42', activatedAt: 'x' })
    );

    await sendInitiativePoke(CODE, redis, { fetchFn, now: 1_000_000 });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const call = fetchFn.mock.calls[0];
    if (!call || call.length < 2) {
      throw new Error('fetchFn not called with expected arguments');
    }
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe('https://relay.example.com/poke');
    const body = JSON.parse(init.body as string);
    expect(body.room).toBe('CAMP1:map-42');
    expect(body.feature).toBe('initiative');
    const payload = verifyBattleMapToken(body.token, SECRET, 1_000_000);
    expect(payload).toMatchObject({ role: 'dm', room: 'CAMP1:map-42' });
  });

  it('does nothing when no battle map is active', async () => {
    const fetchFn = vi.fn();
    await sendInitiativePoke(CODE, redisWith(null), { fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();

    await sendInitiativePoke(
      CODE,
      redisWith(JSON.stringify({ activeBattleMapId: null })),
      { fetchFn }
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('does nothing when env vars are missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    vi.stubEnv('BATTLEMAP_RELAY_SECRET', '');
    const fetchFn = vi.fn();
    await sendInitiativePoke(CODE, redisWith('{"activeBattleMapId":"m"}'), {
      fetchFn,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('swallows fetch failures (poll remains the fallback)', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('relay down');
    });
    const redis = redisWith(JSON.stringify({ activeBattleMapId: 'map-42' }));
    await expect(
      sendInitiativePoke(CODE, redis, { fetchFn })
    ).resolves.toBeUndefined();
  });

  it('tolerates an already-parsed battlemap object (Upstash may return objects)', async () => {
    const fetchFn = vi.fn(async () => new Response('{"sent":0}'));
    const redis = redisWith({ activeBattleMapId: 'map-42' });
    await sendInitiativePoke(CODE, redis, { fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sendBattleMapPoke posts the given feature to the relay poke endpoint', async () => {
    const fetchFn = vi.fn(async () => new Response('{"sent":1}'));
    const redis = redisWith(
      JSON.stringify({ activeBattleMapId: 'map-42', activatedAt: 'x' })
    );

    await sendBattleMapPoke(CODE, redis, 'players', {
      fetchFn,
      now: 1_000_000,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const call = fetchFn.mock.calls[0];
    if (!call || call.length < 2) {
      throw new Error('fetchFn not called with expected arguments');
    }
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe('https://relay.example.com/poke');
    const body = JSON.parse(init.body as string);
    expect(body.room).toBe('CAMP1:map-42');
    expect(body.feature).toBe('players');
  });

  it('sendInitiativePoke still posts feature "initiative" (wrapper)', async () => {
    const fetchFn = vi.fn(async () => new Response('{"sent":1}'));
    const redis = redisWith(
      JSON.stringify({ activeBattleMapId: 'map-42', activatedAt: 'x' })
    );

    await sendInitiativePoke(CODE, redis, { fetchFn, now: 1_000_000 });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const call = fetchFn.mock.calls[0];
    if (!call || call.length < 2) {
      throw new Error('fetchFn not called with expected arguments');
    }
    const [, init] = call as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.feature).toBe('initiative');
  });

  it('fans out to multiple live rooms', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const redis = liveRoomsRedisWith(['map-1', 'map-2']);

    await sendInitiativePoke(CODE, redis, { fetchFn, now: 1_000_000 });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const rooms = fetchFn.mock.calls.map(call => {
      const [, init] = call as unknown as [string, RequestInit];
      return JSON.parse(init.body as string).room;
    });
    expect(rooms.sort()).toEqual(['CAMP1:map-1', 'CAMP1:map-2']);
    for (const call of fetchFn.mock.calls) {
      const [, init] = call as unknown as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.feature).toBe('initiative');
    }
  });
});

describe('sendBattleMapPokeToRoom', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', 'wss://relay.example.com');
    vi.stubEnv('BATTLEMAP_RELAY_SECRET', SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('targets the addressed room directly without reading Redis', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    await sendBattleMapPokeToRoom(CODE, 'map-7', 'fog-appearance', { fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://relay.example.com/poke');
    const body = JSON.parse(init.body as string);
    expect(body.room).toBe(`${CODE}:map-7`);
    expect(body.feature).toBe('fog-appearance');
  });

  it('does nothing when relay URL is not configured', async () => {
    delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    const fetchFn = vi.fn();
    await sendBattleMapPokeToRoom(CODE, 'map-1', 'fog-appearance', { fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('does not throw on network failure', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network');
    });
    await expect(
      sendBattleMapPokeToRoom(CODE, 'map-1', 'fog-appearance', { fetchFn })
    ).resolves.toBeUndefined();
  });

  it('mints a valid token for the addressed room', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const now = 1700000000000;
    await sendBattleMapPokeToRoom(CODE, 'map-X', 'fog-appearance', {
      fetchFn,
      now,
    });
    const body = JSON.parse(
      (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string
    );
    const payload = verifyBattleMapToken(body.token, SECRET, now);
    expect(payload).not.toBeNull();
    expect(payload!.room).toBe(`${CODE}:map-X`);
    expect(payload!.role).toBe('dm');
  });
});

describe('sendBattleMapPokeToLiveRooms', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', 'wss://relay.example.com');
    vi.stubEnv('BATTLEMAP_RELAY_SECRET', SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('pokes every live room, each with its own room in body and token', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const redis = liveRoomsRedisWith(['map-1', 'map-2', 'map-3']);

    await sendBattleMapPokeToLiveRooms(CODE, redis, 'markers', {
      fetchFn,
      now: 1_000_000,
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    const expectedRooms = ['CAMP1:map-1', 'CAMP1:map-2', 'CAMP1:map-3'];
    const actualRooms = fetchFn.mock.calls.map(call => {
      const [, init] = call as unknown as [string, RequestInit];
      return JSON.parse(init.body as string).room;
    });
    expect(actualRooms.sort()).toEqual(expectedRooms.sort());

    for (const call of fetchFn.mock.calls) {
      const [url, init] = call as unknown as [string, RequestInit];
      expect(url).toBe('https://relay.example.com/poke');
      const body = JSON.parse(init.body as string);
      expect(body.feature).toBe('markers');
      const payload = verifyBattleMapToken(body.token, SECRET, 1_000_000);
      expect(payload).toMatchObject({ role: 'dm', room: body.room });
    }
  });

  it('falls back to the active-map room when the registry is empty', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const redis = liveRoomsRedisWith(
      [],
      JSON.stringify({ activeBattleMapId: 'map-42' })
    );

    await sendBattleMapPokeToLiveRooms(CODE, redis, 'players', {
      fetchFn,
      now: 1_000_000,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.room).toBe('CAMP1:map-42');
    expect(body.feature).toBe('players');
  });

  it('sends nothing when the registry is empty and there is no active map', async () => {
    const fetchFn = vi.fn();
    const redis = liveRoomsRedisWith([], null);

    await expect(
      sendBattleMapPokeToLiveRooms(CODE, redis, 'players', { fetchFn })
    ).resolves.toBeUndefined();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('one room failing does not prevent the others from being poked, and does not throw', async () => {
    const perRoomFetch = vi.fn(async (...args: Parameters<typeof fetch>) => {
      const init = args[1];
      const body = JSON.parse(init?.body as string);
      if (body.room === 'CAMP1:map-2') {
        throw new Error('relay down for map-2');
      }
      return new Response(null, { status: 200 });
    });
    const redis = liveRoomsRedisWith(['map-1', 'map-2', 'map-3']);

    await expect(
      sendBattleMapPokeToLiveRooms(CODE, redis, 'markers', {
        fetchFn: perRoomFetch,
      })
    ).resolves.toBeUndefined();

    expect(perRoomFetch).toHaveBeenCalledTimes(3);
    const rooms = perRoomFetch.mock.calls.map(
      call => JSON.parse((call[1] as RequestInit).body as string).room
    );
    expect(rooms.sort()).toEqual(['CAMP1:map-1', 'CAMP1:map-2', 'CAMP1:map-3']);
  });

  it('does nothing when relay env vars are missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    vi.stubEnv('BATTLEMAP_RELAY_SECRET', '');
    const fetchFn = vi.fn();
    const redis = liveRoomsRedisWith(['map-1', 'map-2']);

    await expect(
      sendBattleMapPokeToLiveRooms(CODE, redis, 'markers', { fetchFn })
    ).resolves.toBeUndefined();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('never reads the live-room registry when the relay is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', '');
    vi.stubEnv('BATTLEMAP_RELAY_SECRET', '');
    const fetchFn = vi.fn();
    const redis = liveRoomsRedisWith(['map-1', 'map-2']);

    await sendBattleMapPokeToLiveRooms(CODE, redis, 'markers', { fetchFn });

    expect(redis.zrange).not.toHaveBeenCalled();
    expect(redis.zremrangebyscore).not.toHaveBeenCalled();
    expect(redis.get).not.toHaveBeenCalled();
  });
});

describe('poke failure log distinction (room vs active-map)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BATTLEMAP_RELAY_URL', 'wss://relay.example.com');
    vi.stubEnv('BATTLEMAP_RELAY_SECRET', SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('logs an active-map poke failure without the word "room"', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchFn = vi.fn(async () => {
      throw new Error('relay down');
    });
    const redis = redisWith(JSON.stringify({ activeBattleMapId: 'map-42' }));

    await sendBattleMapPoke(CODE, redis, 'players', { fetchFn });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] as [string, unknown];
    expect(message).not.toMatch(/room/i);
    warnSpy.mockRestore();
  });

  it('logs a directed-room poke failure containing "room" (sendBattleMapPokeToRoom)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchFn = vi.fn(async () => {
      throw new Error('relay down');
    });

    await sendBattleMapPokeToRoom(CODE, 'map-7', 'fog-appearance', {
      fetchFn,
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] as [string, unknown];
    expect(message).toMatch(/room/i);
    warnSpy.mockRestore();
  });

  it('logs a directed-room poke failure containing "room" (live-room fan-out)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchFn = vi.fn(async () => {
      throw new Error('relay down');
    });
    const redis = liveRoomsRedisWith(['map-1']);

    await sendBattleMapPokeToLiveRooms(CODE, redis, 'markers', { fetchFn });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] as [string, unknown];
    expect(message).toMatch(/room/i);
    warnSpy.mockRestore();
  });
});
