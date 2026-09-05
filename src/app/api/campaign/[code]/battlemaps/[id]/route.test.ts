import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { getRedisStore, resetRedis, seedRedis } from '@/test/mocks/redis';
import { DELETE } from './route';

const CODE = 'DELETEFOG';
const MAP_ID = 'map-1';
const params = { params: Promise.resolve({ code: CODE, id: MAP_ID }) };

beforeEach(() => {
  resetRedis();
  seedRedis(`campaign:${CODE}`, {
    dmId: 'dm-1',
    campaignName: 'Delete Fog Test',
  });
  seedRedis(`campaign:${CODE}:battlemap:${MAP_ID}`, { id: MAP_ID });
  seedRedis(`campaign:${CODE}:fog-appearance:${MAP_ID}`, {
    v: 1,
    appearance: 'cloudy',
    updatedAt: '2026-09-05T00:00:00.000Z',
  });
});

describe('DELETE /api/campaign/[code]/battlemaps/[id]', () => {
  it('deletes the viewer fog projection with the map', async () => {
    const request = new NextRequest(
      `http://localhost/api/campaign/${CODE}/battlemaps/${MAP_ID}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dmId: 'dm-1' }),
      }
    );

    const response = await DELETE(request, params);

    expect(response.status).toBe(200);
    expect(getRedisStore().has(`campaign:${CODE}:battlemap:${MAP_ID}`)).toBe(
      false
    );
    expect(
      getRedisStore().has(`campaign:${CODE}:fog-appearance:${MAP_ID}`)
    ).toBe(false);
  });
});
