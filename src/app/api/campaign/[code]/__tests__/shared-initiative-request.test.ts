import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { resetRedis, getRedisStore } from '@/test/mocks/redis';
import {
  createNextRequest,
  createRouteParams,
  createGetRequest,
} from '@/test/helpers';
import { GET, POST } from '../shared/route';

async function postFeature(data: unknown) {
  const req = createNextRequest('/api/campaign/ABC123/shared', {
    method: 'POST',
    body: { feature: 'initiativeRequest', data, dmId: 'dm-1' },
  });
  return POST(req as NextRequest, createRouteParams({ code: 'ABC123' }));
}

describe('shared route — initiativeRequest feature', () => {
  beforeEach(() => {
    resetRedis();
    getRedisStore().set(
      'campaign:ABC123',
      JSON.stringify({ dmId: 'dm-1', campaignName: 'Test' })
    );
  });

  it('rejects the legacy initiativeRequest writer, including a null clear (426)', async () => {
    for (const data of [
      {
        requestId: 'req-1',
        encounterId: 'enc-1',
        encounterName: 'Goblin Ambush',
        requestedAt: 1234,
      },
      null,
    ]) {
      expect((await postFeature(data)).status).toBe(426);
    }
  });

  it('envelope has initiativeRequest: null when never set', async () => {
    const get = await GET(
      createGetRequest(
        '/api/campaign/ABC123/shared?role=player&playerId=char-1'
      ),
      createRouteParams({ code: 'ABC123' })
    );
    expect((await get.json()).initiativeRequest).toBeNull();
  });

  it('still rejects data: null for other features with 400', async () => {
    const req = createNextRequest('/api/campaign/ABC123/shared', {
      method: 'POST',
      body: { feature: 'message', data: null, dmId: 'dm-1' },
    });
    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    expect(res.status).toBe(400);
  });
});
