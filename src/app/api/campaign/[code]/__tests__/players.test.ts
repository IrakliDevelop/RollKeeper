import { describe, it, expect, beforeEach } from 'vitest';
import { resetRedis, seedRedis, seedRedisSet } from '@/test/mocks/redis';
import {
  createNextRequest,
  createRouteParams,
  createMockCampaignData,
  createMockPlayerData,
} from '@/test/helpers';
import { GET } from '../players/route';
import { NextRequest } from 'next/server';

describe('GET /api/campaign/[code]/players', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('returns campaign info and player list', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['__init__', 'player-1']);
    seedRedis(
      'campaign:ABC123:player:player-1',
      createMockPlayerData({ playerName: 'Alice' })
    );

    const req = createNextRequest('/api/campaign/ABC123/players');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.campaign).not.toBeNull();
    expect(data.campaign.name).toBe('Test Campaign');
    expect(data.players).toHaveLength(1);
    expect(data.players[0].playerName).toBe('Alice');
  });

  it('returns campaign: null when campaign key is missing', async () => {
    const req = createNextRequest('/api/campaign/XXXXXX/players');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'XXXXXX' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.campaign).toBeNull();
    expect(data.players).toEqual([]);
  });

  it('returns players even when campaign key is missing but player data exists', async () => {
    seedRedisSet('campaign:ABC123:players', ['__init__', 'player-1']);
    seedRedis(
      'campaign:ABC123:player:player-1',
      createMockPlayerData({ playerName: 'Bob' })
    );

    const req = createNextRequest('/api/campaign/ABC123/players');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.campaign).toBeNull();
    expect(data.players).toHaveLength(1);
    expect(data.players[0].playerName).toBe('Bob');
  });

  it('filters out __init__ from player results', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['__init__']);

    const req = createNextRequest('/api/campaign/ABC123/players');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(data.players).toEqual([]);
  });
});
