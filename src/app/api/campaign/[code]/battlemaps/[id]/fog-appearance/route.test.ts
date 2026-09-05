import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRedisStore,
  mockRedis,
  resetRedis,
  seedRedis,
  seedRedisSet,
} from '@/test/mocks/redis';

const { authorizeCampaignMembershipRoute, sendBattleMapPokeToRoom } =
  vi.hoisted(() => ({
    authorizeCampaignMembershipRoute: vi.fn(),
    sendBattleMapPokeToRoom: vi.fn(async () => {}),
  }));

vi.mock('@/lib/supabase/campaignMembershipServer', () => ({
  authorizeCampaignMembershipRoute,
}));
vi.mock('@/lib/relayPoke', () => ({ sendBattleMapPokeToRoom }));

import { GET, PUT } from './route';

const CODE = 'FOGTEST';
const MAP_ID = 'map-1';
const params = { params: Promise.resolve({ code: CODE, id: MAP_ID }) };
const projectionKey = `campaign:${CODE}:fog-appearance:${MAP_ID}`;

function getRequest(query: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/campaign/${CODE}/battlemaps/${MAP_ID}/fog-appearance?${query}`
  );
}

function putRequest(body: Record<string, unknown>, secure = true): NextRequest {
  return new NextRequest(
    `http://localhost/api/campaign/${CODE}/battlemaps/${MAP_ID}/fog-appearance`,
    {
      method: 'PUT',
      headers: secure
        ? {
            Origin: 'http://localhost',
            'Content-Type': 'application/json',
            'x-rollkeeper-csrf': '1',
          }
        : { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

beforeEach(() => {
  resetRedis();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED = 'true';
  authorizeCampaignMembershipRoute.mockResolvedValue({ mode: 'legacy' });
  seedRedis(`campaign:${CODE}`, {
    dmId: 'dm-1',
    campaignName: 'Fog Test',
  });
  seedRedisSet(`campaign:${CODE}:players`, ['player-1']);
  seedRedis(`campaign:${CODE}:displaykey`, 'display-1');
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED;
});

describe('fog appearance rollout gate', () => {
  it('keeps both metadata reads and writes absent while disabled', async () => {
    delete process.env.NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED;

    expect(
      (await GET(getRequest('role=player&playerId=player-1'), params)).status
    ).toBe(404);
    expect(
      (await PUT(putRequest({ dmId: 'dm-1', appearance: 'cloudy' }), params))
        .status
    ).toBe(404);
    expect(getRedisStore().has(projectionKey)).toBe(false);
  });
});

describe('GET fog appearance projection', () => {
  it('returns the authorized player projection without mutation CSRF checks', async () => {
    authorizeCampaignMembershipRoute.mockResolvedValue({
      mode: 'account',
      principal: {
        role: 'player',
        legacyPlayerId: 'player-1',
      },
    });
    seedRedis(projectionKey, {
      v: 1,
      appearance: 'cloudy',
      updatedAt: '2026-09-05T00:00:00.000Z',
    });

    const response = await GET(
      getRequest('role=player&playerId=player-1'),
      params
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      fogAppearance: 'cloudy',
      updatedAt: '2026-09-05T00:00:00.000Z',
    });
  });

  it('authorizes display reads through the display key', async () => {
    const response = await GET(
      getRequest('role=display&displayKey=display-1'),
      params
    );
    expect(response.status).toBe(200);
    expect(authorizeCampaignMembershipRoute).not.toHaveBeenCalled();
  });

  it('falls back to solid for missing, malformed, or future projections', async () => {
    for (const raw of [
      undefined,
      { v: 2, appearance: 'cloudy', updatedAt: 'later' },
      { v: 1, appearance: 'misty', updatedAt: 'later' },
    ]) {
      resetRedis();
      seedRedisSet(`campaign:${CODE}:players`, ['player-1']);
      if (raw !== undefined) seedRedis(projectionKey, raw);
      const response = await GET(
        getRequest('role=player&playerId=player-1'),
        params
      );
      expect(await response.json()).toEqual({
        fogAppearance: 'solid',
        updatedAt: null,
      });
    }
  });

  it('rejects an overlong map id before reading Redis', async () => {
    const id = 'x'.repeat(201);
    const response = await GET(getRequest('role=player&playerId=player-1'), {
      params: Promise.resolve({ code: CODE, id }),
    });
    expect(response.status).toBe(400);
    expect(mockRedis.get).not.toHaveBeenCalled();
  });
});

describe('PUT fog appearance projection', () => {
  it('strictly rejects unknown appearances without replacing the projection', async () => {
    seedRedis(projectionKey, {
      v: 1,
      appearance: 'cloudy',
      updatedAt: '2026-09-05T00:00:00.000Z',
    });

    const response = await PUT(
      putRequest({ dmId: 'dm-1', appearance: 'misty' }),
      params
    );

    expect(response.status).toBe(400);
    expect(JSON.parse(getRedisStore().get(projectionKey)!).appearance).toBe(
      'cloudy'
    );
    expect(sendBattleMapPokeToRoom).not.toHaveBeenCalled();
  });

  it('requires mutation CSRF for account-authorized DMs', async () => {
    authorizeCampaignMembershipRoute.mockResolvedValue({
      mode: 'account',
      principal: { role: 'owner' },
    });
    const response = await PUT(
      putRequest({ dmId: 'dm-1', appearance: 'cloudy' }, false),
      params
    );
    expect(response.status).toBe(403);
    expect(getRedisStore().has(projectionKey)).toBe(false);
  });

  it('rejects callers without DM authority', async () => {
    const response = await PUT(
      putRequest({ dmId: 'not-the-dm', appearance: 'cloudy' }),
      params
    );
    expect(response.status).toBe(403);
    expect(getRedisStore().has(projectionKey)).toBe(false);
  });

  it('writes without a legacy battle-map document and awaits the room poke', async () => {
    let releasePoke!: () => void;
    sendBattleMapPokeToRoom.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          releasePoke = resolve;
        })
    );
    let settled = false;
    const pending = PUT(
      putRequest({ dmId: 'dm-1', appearance: 'cloudy' }),
      params
    ).then(response => {
      settled = true;
      return response;
    });
    await vi.waitFor(() => {
      expect(sendBattleMapPokeToRoom).toHaveBeenCalledWith(
        CODE,
        MAP_ID,
        'fog-appearance'
      );
    });
    expect(settled).toBe(false);
    releasePoke();

    const response = await pending;
    expect(response.status).toBe(200);
    const stored = JSON.parse(getRedisStore().get(projectionKey)!);
    expect(stored).toEqual({
      v: 1,
      appearance: 'cloudy',
      updatedAt: expect.any(String),
    });
    expect(mockRedis.set).toHaveBeenCalledWith(
      projectionKey,
      expect.objectContaining({ appearance: 'cloudy' }),
      { ex: 60 * 24 * 60 * 60 }
    );
  });
});
