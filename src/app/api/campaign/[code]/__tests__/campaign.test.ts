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
} from '@/test/helpers';
import { GET, PUT, DELETE } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/campaign/[code]', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('returns campaign when it exists', async () => {
    const campaign = createMockCampaignData();
    seedRedis('campaign:ABC123', campaign);

    const req = createNextRequest('/api/campaign/ABC123');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.code).toBe('ABC123');
    expect(data.campaign.campaignName).toBe('Test Campaign');
  });

  it('returns 404 when campaign is missing', async () => {
    const req = createNextRequest('/api/campaign/XXXXXX');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'XXXXXX' })
    );

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/campaign/[code]', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('upserts campaign data', async () => {
    const req = createNextRequest('/api/campaign/ABC123', {
      method: 'PUT',
      body: {
        dmId: 'dm-1',
        campaignName: 'Restored Campaign',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    });

    const res = await PUT(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.code).toBe('ABC123');
    expect(data.campaign.campaignName).toBe('Restored Campaign');

    const stored = getRedisStore().get('campaign:ABC123');
    expect(stored).toBeDefined();
  });

  it('overwrites existing campaign', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());

    const req = createNextRequest('/api/campaign/ABC123', {
      method: 'PUT',
      body: { dmId: 'dm-1', campaignName: 'Updated Name' },
    });

    const res = await PUT(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(data.campaign.campaignName).toBe('Updated Name');
  });

  it('returns 400 when dmId is missing', async () => {
    const req = createNextRequest('/api/campaign/ABC123', {
      method: 'PUT',
      body: { campaignName: 'Test' },
    });

    const res = await PUT(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when campaignName is missing', async () => {
    const req = createNextRequest('/api/campaign/ABC123', {
      method: 'PUT',
      body: { dmId: 'dm-1' },
    });

    const res = await PUT(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    expect(res.status).toBe(400);
  });

  it('initialises the players set', async () => {
    const req = createNextRequest('/api/campaign/ABC123', {
      method: 'PUT',
      body: { dmId: 'dm-1', campaignName: 'Test' },
    });

    await PUT(req as NextRequest, createRouteParams({ code: 'ABC123' }));

    const playerSet = getRedisSet('campaign:ABC123:players');
    expect(playerSet.has('__init__')).toBe(true);
  });
});

describe('DELETE /api/campaign/[code]', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('deletes campaign and all player data', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['__init__', 'player-1']);
    seedRedis('campaign:ABC123:player:player-1', { playerId: 'player-1' });

    const req = createNextRequest('/api/campaign/ABC123', { method: 'DELETE' });
    const res = await DELETE(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );

    expect(res.status).toBe(200);
    expect(getRedisStore().has('campaign:ABC123')).toBe(false);
    expect(getRedisStore().has('campaign:ABC123:player:player-1')).toBe(false);
  });

  it('returns 404 when campaign does not exist', async () => {
    const req = createNextRequest('/api/campaign/XXXXXX', { method: 'DELETE' });
    const res = await DELETE(
      req as NextRequest,
      createRouteParams({ code: 'XXXXXX' })
    );

    expect(res.status).toBe(404);
  });
});
