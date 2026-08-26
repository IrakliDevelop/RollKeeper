import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockRedis, resetRedis, seedRedis } from '@/test/mocks/redis';
import {
  createNextRequest,
  createRouteParams,
  createMockCampaignData,
} from '@/test/helpers';
import { POST, GET, DELETE } from '../route';
import { NextRequest } from 'next/server';

vi.mock('@upstash/redis', () => ({ Redis: vi.fn(() => mockRedis) }));

const reqBody = {
  encounterId: 'enc-1',
  round: 2,
  entityId: 'a',
  playerId: 'char-a',
  requestedAt: '2026-01-01T00:00:00.000Z',
};

describe('turn-request route', () => {
  beforeEach(() => resetRedis());

  it('stores a turn-end request via POST', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    const req = createNextRequest('/api/campaign/ABC123/turn-request', {
      method: 'POST',
      body: reqBody,
    });
    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    expect(res.status).toBe(200);

    const getReq = createNextRequest('/api/campaign/ABC123/turn-request');
    const getRes = await GET(
      getReq as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await getRes.json();
    expect(data.request.entityId).toBe('a');
    expect(data.request.round).toBe(2);
  });

  it('returns null request when none stored', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    const getReq = createNextRequest('/api/campaign/ABC123/turn-request');
    const getRes = await GET(
      getReq as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await getRes.json();
    expect(data.request).toBeNull();
  });

  it('clears the request via DELETE', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedis('campaign:ABC123:shared:turnRequest', reqBody);

    const delReq = createNextRequest('/api/campaign/ABC123/turn-request', {
      method: 'DELETE',
    });
    const delRes = await DELETE(
      delReq as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    expect(delRes.status).toBe(200);

    const getReq = createNextRequest('/api/campaign/ABC123/turn-request');
    const getRes = await GET(
      getReq as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await getRes.json();
    expect(data.request).toBeNull();
  });
});
