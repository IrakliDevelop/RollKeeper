import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendInitiativePoke, relayHttpUrl } from '@/lib/relayPoke';
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
});
