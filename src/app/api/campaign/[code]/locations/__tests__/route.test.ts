import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { createNextRequest, createRouteParams } from '@/test/helpers';
import { mockRedis, resetRedis, seedRedis } from '@/test/mocks/redis';
import { GET as getLocations } from '../route';
import { GET as getLocation, POST as postLocation } from '../[id]/route';

import type { SyncedLocation } from '@/types/location';

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

/**
 * `portal`, `dmNotes`, and unknown future private keys must never leak
 * through the location route, on ingestion (POST) OR read-back (GET) of an
 * old stored record — the location route reuses the same sanitizer the
 * battle-map marker route does, so this is a second independent proof of
 * the same boundary at a different entry point.
 */
describe('location marker sanitization — private fields never survive', () => {
  const CODE = 'FNLRC6';
  const LOCATION_ID = 'location-1';

  const smuggledMarker = {
    id: 'marker-1',
    title: 'Old Door',
    body: 'A rotted wooden door.',
    status: 'closed',
    portal: { v: 1, kind: 'battlemap', id: 'SMUGGLED-PORTAL-TARGET' },
    dmNotes: 'SECRET-DM-NOTES-PAYLOAD',
    unknownFutureField: 'SMUGGLED-UNKNOWN-PAYLOAD',
  };

  function buildLocation(markers: unknown) {
    return {
      id: LOCATION_ID,
      name: 'Barovia',
      mapImageUrl: 'https://maps.example/barovia.webp',
      mapImageSize: { w: 100, h: 100 },
      canvasState: '',
      gridEnabled: false,
      markers,
      updatedAt: '2026-09-03T00:00:00.000Z',
    };
  }

  beforeEach(() => {
    resetRedis();
    seedRedis(`campaign:${CODE}`, { dmId: 'dm-1', campaignName: 'Test' });
  });

  it('strips portal, dmNotes, and unknown fields on POST ingestion before storing to Redis', async () => {
    const request = createNextRequest(
      `/api/campaign/${CODE}/locations/${LOCATION_ID}`,
      {
        method: 'POST',
        body: {
          dmId: 'dm-1',
          location: buildLocation([smuggledMarker]),
        },
      }
    );

    const response = await postLocation(
      request as NextRequest,
      createRouteParams({ code: CODE, id: LOCATION_ID })
    );
    expect(response.status).toBe(200);

    const stored = await mockRedis.get(
      `campaign:${CODE}:location:${LOCATION_ID}`
    );
    const storedLocation = JSON.parse(stored as string) as SyncedLocation;

    expect(storedLocation.markers).toEqual([
      {
        id: 'marker-1',
        title: 'Old Door',
        body: 'A rotted wooden door.',
        status: 'closed',
      },
    ]);
    const serialized = JSON.stringify(storedLocation);
    expect(serialized).not.toContain('SMUGGLED-PORTAL-TARGET');
    expect(serialized).not.toContain('SECRET-DM-NOTES-PAYLOAD');
    expect(serialized).not.toContain('SMUGGLED-UNKNOWN-PAYLOAD');
    expect(serialized).not.toContain('portal');
    expect(serialized).not.toContain('dmNotes');
  });

  it('strips smuggled fields on GET read-back of an old stored record written before this boundary existed', async () => {
    // Simulate a record written by an older or compromised path directly,
    // bypassing POST sanitization entirely.
    seedRedis(
      `campaign:${CODE}:location:${LOCATION_ID}`,
      buildLocation([smuggledMarker])
    );

    const request = createNextRequest(
      `/api/campaign/${CODE}/locations/${LOCATION_ID}`
    );
    const response = await getLocation(
      request as NextRequest,
      createRouteParams({ code: CODE, id: LOCATION_ID })
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.location.markers).toEqual([
      {
        id: 'marker-1',
        title: 'Old Door',
        body: 'A rotted wooden door.',
        status: 'closed',
      },
    ]);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('SMUGGLED-PORTAL-TARGET');
    expect(serialized).not.toContain('SECRET-DM-NOTES-PAYLOAD');
    expect(serialized).not.toContain('SMUGGLED-UNKNOWN-PAYLOAD');
    expect(serialized).not.toContain('portal');
    expect(serialized).not.toContain('dmNotes');
  });

  it('proves the full POST → Redis → GET round-trip strips private fields at both ends', async () => {
    const postRequest = createNextRequest(
      `/api/campaign/${CODE}/locations/${LOCATION_ID}`,
      {
        method: 'POST',
        body: {
          dmId: 'dm-1',
          location: buildLocation([smuggledMarker]),
        },
      }
    );
    const postResponse = await postLocation(
      postRequest as NextRequest,
      createRouteParams({ code: CODE, id: LOCATION_ID })
    );
    expect(postResponse.status).toBe(200);

    const getRequest = createNextRequest(
      `/api/campaign/${CODE}/locations/${LOCATION_ID}`
    );
    const getResponse = await getLocation(
      getRequest as NextRequest,
      createRouteParams({ code: CODE, id: LOCATION_ID })
    );
    expect(getResponse.status).toBe(200);
    const body = await getResponse.json();

    expect(body.location.markers).toEqual([
      {
        id: 'marker-1',
        title: 'Old Door',
        body: 'A rotted wooden door.',
        status: 'closed',
      },
    ]);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('SMUGGLED-PORTAL-TARGET');
    expect(serialized).not.toContain('SECRET-DM-NOTES-PAYLOAD');
    expect(serialized).not.toContain('SMUGGLED-UNKNOWN-PAYLOAD');
  });

  it('omits markers entirely (never stores null) when the marker payload is invalid', async () => {
    const request = createNextRequest(
      `/api/campaign/${CODE}/locations/${LOCATION_ID}`,
      {
        method: 'POST',
        body: {
          dmId: 'dm-1',
          location: buildLocation([{ id: 'no-title-or-body' }]),
        },
      }
    );
    const response = await postLocation(
      request as NextRequest,
      createRouteParams({ code: CODE, id: LOCATION_ID })
    );
    expect(response.status).toBe(200);

    const stored = await mockRedis.get(
      `campaign:${CODE}:location:${LOCATION_ID}`
    );
    const storedLocation = JSON.parse(stored as string) as SyncedLocation;
    expect(storedLocation.markers).toBeUndefined();
    expect(JSON.stringify(storedLocation)).not.toContain('null');
  });
});
