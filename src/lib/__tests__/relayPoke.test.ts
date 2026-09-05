import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendInitiativePoke,
  sendBattleMapPoke,
  sendBattleMapPokeToRoom,
  relayHttpUrl,
} from '@/lib/relayPoke';
import { verifyBattleMapToken } from '@/lib/battlemapToken';

const CODE = 'CAMP1';
const SECRET = 'test-secret';

interface MockRedis {
  get<T = unknown>(key: string): Promise<T | null>;
}

function redisWith(battlemapValue: unknown): MockRedis {
  return {
    get: vi.fn(async (key: string) =>
      key.includes('battlemap') ? battlemapValue : null
    ) as <T = unknown>(key: string) => Promise<T | null>,
  };
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
