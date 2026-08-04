import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { createNextRequest, createRouteParams } from '@/test/helpers';
import { mockRedis, resetRedis, seedRedis } from '@/test/mocks/redis';
import { GET as getLocations } from '../route';
import { GET as getLocation } from '../[id]/route';

const metadata = {
  id: 'location-1',
  name: 'Barovia',
  mapImageUrl: 'https://maps.example/barovia.webp',
  updatedAt: '2026-05-17T11:38:32.869Z',
};

describe('location TTL consistency', () => {
  beforeEach(() => {
    resetRedis();
    mockRedis.expire.mockClear();
  });

  it('refreshes each detail key when the location list is fetched', async () => {
    seedRedis('campaign:FNLRC6:locations', [metadata]);
    const request = createNextRequest('/api/campaign/FNLRC6/locations');

    const response = await getLocations(
      request as NextRequest,
      createRouteParams({ code: 'FNLRC6' })
    );

    expect(response.status).toBe(200);
    expect(mockRedis.expire).toHaveBeenCalledWith(
      'campaign:FNLRC6:location:location-1',
      60 * 24 * 60 * 60
    );
  });

  it('falls back to metadata when an old detail key has expired', async () => {
    seedRedis('campaign:FNLRC6:locations', [metadata]);
    const request = createNextRequest(
      '/api/campaign/FNLRC6/locations/location-1'
    );

    const response = await getLocation(
      request as NextRequest,
      createRouteParams({ code: 'FNLRC6', id: 'location-1' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.location).toMatchObject({
      ...metadata,
      canvasState: '',
      gridEnabled: false,
    });
  });

  it('still returns 404 when neither detail nor metadata exists', async () => {
    const request = createNextRequest('/api/campaign/FNLRC6/locations/missing');

    const response = await getLocation(
      request as NextRequest,
      createRouteParams({ code: 'FNLRC6', id: 'missing' })
    );

    expect(response.status).toBe(404);
  });
});
