import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  resetRedis,
  seedRedis,
  seedRedisList,
  seedRedisSet,
} from '@/test/mocks/redis';
import { createMockPlayerData, createRouteParams } from '@/test/helpers';
import { GET } from '../route';

const CODE = 'PROJECTED';
const PLAYER_ID = 'player-1';

beforeEach(() => {
  resetRedis();
  seedRedis(`campaign:${CODE}`, {
    dmId: 'dm-1',
    campaignName: 'Test campaign',
    createdAt: '2026-08-04T00:00:00.000Z',
  });
  seedRedisSet(`campaign:${CODE}:players`, [PLAYER_ID]);
  const player = createMockPlayerData({ playerId: PLAYER_ID });
  player.characterData.experience = 1200;
  seedRedis(`campaign:${CODE}:player:${PLAYER_ID}`, player);
});

describe('GET campaign players projected XP', () => {
  it('folds queued add and set awards over the synced snapshot', async () => {
    seedRedisList(`campaign:${CODE}:xp:${PLAYER_ID}`, [
      JSON.stringify({
        id: 'add-1',
        mode: 'add',
        amount: 300,
        awardedAt: '2026-08-04T00:00:00.000Z',
      }),
      JSON.stringify({
        id: 'set-1',
        mode: 'set',
        amount: 900,
        awardedAt: '2026-08-04T00:01:00.000Z',
      }),
      JSON.stringify({
        id: 'add-2',
        mode: 'add',
        amount: 50,
        awardedAt: '2026-08-04T00:02:00.000Z',
      }),
      // A retry may enqueue the same delivery twice after a lost response.
      JSON.stringify({
        id: 'add-2',
        mode: 'add',
        amount: 50,
        awardedAt: '2026-08-04T00:02:00.000Z',
      }),
    ]);

    const response = await GET(
      new NextRequest(`http://localhost/api/campaign/${CODE}/players`),
      createRouteParams({ code: CODE })
    );
    const body = await response.json();

    expect(body.players[0].characterData.experience).toBe(1200);
    expect(body.players[0].projectedExperience).toBe(950);
    expect(body.players[0].pendingXpAwardCount).toBe(3);
  });

  it('reports synced XP when no awards are pending', async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/campaign/${CODE}/players`),
      createRouteParams({ code: CODE })
    );
    const body = await response.json();

    expect(body.players[0].projectedExperience).toBe(1200);
    expect(body.players[0].pendingXpAwardCount).toBe(0);
  });
});
