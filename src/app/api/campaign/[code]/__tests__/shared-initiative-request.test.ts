import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { resetRedis, getRedisStore } from '@/test/mocks/redis';
import { createNextRequest, createRouteParams } from '@/test/helpers';
import { GET, POST } from '../shared/route';

async function postFeature(data: unknown) {
  const req = createNextRequest('/api/campaign/ABC123/shared', {
    method: 'POST',
    body: { feature: 'initiativeRequest', data, dmId: 'dm-1' },
  });
  return POST(req as NextRequest, createRouteParams({ code: 'ABC123' }));
}

function createGetRequest(url: string) {
  const req = createNextRequest(url);
  const urlObj = new URL(req.url);

  // Manually add nextUrl property that NextRequest would have
  Object.defineProperty(req, 'nextUrl', {
    value: {
      searchParams: urlObj.searchParams,
      pathname: urlObj.pathname,
      href: urlObj.href,
    },
    writable: true,
    configurable: true,
  });

  return req as NextRequest;
}

describe('shared route — initiativeRequest feature', () => {
  beforeEach(() => {
    resetRedis();
    getRedisStore().set(
      'campaign:ABC123',
      JSON.stringify({ dmId: 'dm-1', campaignName: 'Test' })
    );
  });

  it('stores the request and returns it in the GET envelope', async () => {
    const request = {
      requestId: 'req-1',
      encounterId: 'enc-1',
      encounterName: 'Goblin Ambush',
      requestedAt: 1234,
    };
    const post = await postFeature(request);
    expect(post.status).toBe(200);

    const get = await GET(
      createGetRequest(
        '/api/campaign/ABC123/shared?role=player&playerId=char-1'
      ),
      createRouteParams({ code: 'ABC123' })
    );
    const state = await get.json();
    expect(state.initiativeRequest).toEqual(request);
  });

  it('accepts data: null to clear the request', async () => {
    await postFeature({
      requestId: 'req-1',
      encounterId: 'enc-1',
      encounterName: 'X',
      requestedAt: 1,
    });
    const post = await postFeature(null);
    expect(post.status).toBe(200);

    const get = await GET(
      createGetRequest(
        '/api/campaign/ABC123/shared?role=player&playerId=char-1'
      ),
      createRouteParams({ code: 'ABC123' })
    );
    const state = await get.json();
    expect(state.initiativeRequest).toBeNull();
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
