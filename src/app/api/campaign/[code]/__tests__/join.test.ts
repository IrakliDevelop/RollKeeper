import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetRedis,
  seedRedis,
  seedRedisSet,
  getRedisStore,
  getRedisSet,
} from '@/test/mocks/redis';
import {
  createNextRequest,
  createRouteParams,
  createMockCampaignData,
  createMockCharacterState,
} from '@/test/helpers';
import { POST } from '../join/route';
import { NextRequest } from 'next/server';

describe('POST /api/campaign/[code]/join', () => {
  beforeEach(() => {
    resetRedis();
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['__init__']);
  });

  it('joins a campaign and stores player data', async () => {
    const charData = createMockCharacterState();
    const req = createNextRequest('/api/campaign/ABC123/join', {
      method: 'POST',
      body: {
        playerId: 'player-1',
        playerName: 'Alice',
        characterId: 'char-1',
        characterName: 'Thorn',
        characterData: charData,
      },
    });

    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.campaignName).toBe('Test Campaign');

    const playerSet = getRedisSet('campaign:ABC123:players');
    expect(playerSet.has('player-1')).toBe(true);

    const stored = getRedisStore().get('campaign:ABC123:player:player-1');
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed.playerName).toBe('Alice');
  });

  it('returns 404 when campaign does not exist', async () => {
    const req = createNextRequest('/api/campaign/XXXXXX/join', {
      method: 'POST',
      body: {
        playerId: 'player-1',
        playerName: 'Alice',
        characterId: 'char-1',
        characterData: createMockCharacterState(),
      },
    });

    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'XXXXXX' })
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when required fields are missing', async () => {
    const req = createNextRequest('/api/campaign/ABC123/join', {
      method: 'POST',
      body: { playerId: 'player-1' },
    });

    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    expect(res.status).toBe(400);
  });
});
