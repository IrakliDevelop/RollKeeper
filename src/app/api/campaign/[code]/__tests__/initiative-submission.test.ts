import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { resetRedis } from '@/test/mocks/redis';
import {
  createNextRequest,
  createRouteParams,
  createGetRequest,
} from '@/test/helpers';
import { DELETE, GET, POST } from '../initiative-submission/route';

const post = (body: Record<string, unknown>) =>
  POST(
    createNextRequest('/api/campaign/ABC123/initiative-submission', {
      method: 'POST',
      body,
    }) as NextRequest,
    createRouteParams({ code: 'ABC123' })
  );

const getSubs = async () => {
  const res = await GET(
    createGetRequest('/api/campaign/ABC123/initiative-submission'),
    createRouteParams({ code: 'ABC123' })
  );
  return (await res.json()).submissions as Record<string, unknown>;
};

describe('initiative-submission route', () => {
  beforeEach(() => resetRedis());

  it('rejects missing fields', async () => {
    const res = await post({ requestId: 'r', playerId: 'p' }); // no value
    expect(res.status).toBe(400);
  });

  it('stores per-player and overwrites on resubmit', async () => {
    await post({ requestId: 'r1', playerId: 'char-1', value: 12 });
    await post({ requestId: 'r1', playerId: 'char-2', value: 8 });
    await post({ requestId: 'r1', playerId: 'char-1', value: 15 });
    const subs = await getSubs();
    expect(Object.keys(subs).sort()).toEqual(['char-1', 'char-2']);
    expect((subs['char-1'] as { value: number }).value).toBe(15);
  });

  it('DELETE ?playerId removes one; bare DELETE removes all', async () => {
    await post({ requestId: 'r1', playerId: 'char-1', value: 12 });
    await post({ requestId: 'r1', playerId: 'char-2', value: 8 });
    await DELETE(
      createGetRequest(
        '/api/campaign/ABC123/initiative-submission?playerId=char-1'
      ),
      createRouteParams({ code: 'ABC123' })
    );
    expect(Object.keys(await getSubs())).toEqual(['char-2']);
    await DELETE(
      createGetRequest('/api/campaign/ABC123/initiative-submission'),
      createRouteParams({ code: 'ABC123' })
    );
    expect(await getSubs()).toEqual({});
  });
});
