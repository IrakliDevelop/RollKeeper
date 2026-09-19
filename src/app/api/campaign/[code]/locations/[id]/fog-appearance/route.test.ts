import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRedisStore,
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
import { GET as battleMapGET } from '../../../battlemaps/[id]/fog-appearance/route';

const CODE = 'FOGLOC';
const LOCATION_ID = 'loc-1';
const params = { params: Promise.resolve({ code: CODE, id: LOCATION_ID }) };
const projectionKey = `campaign:${CODE}:fog-appearance:${LOCATION_ID}`;

function getRequest(query: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/campaign/${CODE}/locations/${LOCATION_ID}/fog-appearance?${query}`
  );
}

function putRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    `http://localhost/api/campaign/${CODE}/locations/${LOCATION_ID}/fog-appearance`,
    {
      method: 'PUT',
      headers: {
        Origin: 'http://localhost',
        'Content-Type': 'application/json',
        'x-rollkeeper-csrf': '1',
      },
      body: JSON.stringify(body),
    }
  );
}

beforeEach(() => {
  resetRedis();
  vi.clearAllMocks();
  authorizeCampaignMembershipRoute.mockResolvedValue({ mode: 'legacy' });
  seedRedis(`campaign:${CODE}`, { dmId: 'dm-1', campaignName: 'Fog Loc' });
  seedRedisSet(`campaign:${CODE}:players`, ['player-1']);
});

describe('locations fog-appearance route', () => {
  it('serves the projection to an authorized player', async () => {
    seedRedis(projectionKey, {
      v: 1,
      appearance: 'cloudy',
      updatedAt: '2026-09-19T00:00:00.000Z',
    });
    const response = await GET(
      getRequest('role=player&playerId=player-1'),
      params
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      fogAppearance: 'cloudy',
      updatedAt: '2026-09-19T00:00:00.000Z',
    });
  });

  it('rejects a player who is not in the campaign', async () => {
    const response = await GET(
      getRequest('role=player&playerId=stranger'),
      params
    );
    expect(response.status).toBe(403);
  });

  it('falls back to solid when nothing was projected', async () => {
    const response = await GET(
      getRequest('role=player&playerId=player-1'),
      params
    );
    expect(await response.json()).toEqual({
      fogAppearance: 'solid',
      updatedAt: null,
    });
  });

  it('writes the id-generic key, pokes the location room, and rejects non-DMs', async () => {
    const denied = await PUT(
      putRequest({ dmId: 'someone-else', appearance: 'cloudy' }),
      params
    );
    expect(denied.status).toBe(403);
    expect(getRedisStore().has(projectionKey)).toBe(false);

    const ok = await PUT(
      putRequest({ dmId: 'dm-1', appearance: 'cloudy' }),
      params
    );
    expect(ok.status).toBe(200);
    expect(getRedisStore().has(projectionKey)).toBe(true);
    expect(sendBattleMapPokeToRoom).toHaveBeenCalledWith(
      CODE,
      LOCATION_ID,
      'fog-appearance'
    );
  });

  it('shares its projection with the battlemaps route and the token mint (same Redis key)', async () => {
    await PUT(putRequest({ dmId: 'dm-1', appearance: 'cloudy' }), params);
    const viaBattleMaps = await battleMapGET(
      new NextRequest(
        `http://localhost/api/campaign/${CODE}/battlemaps/${LOCATION_ID}/fog-appearance?role=player&playerId=player-1`
      ),
      params
    );
    expect((await viaBattleMaps.json()).fogAppearance).toBe('cloudy');
  });

  it('rejects an overlong id before reading Redis', async () => {
    const response = await GET(getRequest('role=player&playerId=player-1'), {
      params: Promise.resolve({ code: CODE, id: 'x'.repeat(201) }),
    });
    expect(response.status).toBe(400);
  });
});
