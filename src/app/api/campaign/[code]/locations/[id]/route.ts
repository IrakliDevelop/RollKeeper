import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  campaignLocationsKey,
  campaignLocationKey,
  refreshCampaignTTL,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import { verifyDmAuthority } from '@/lib/dmAuth';
import type { LocationMetadata, SyncedLocation } from '@/types/location';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const { code, id } = await params;
    const redis = getRedis();
    const raw = await redis.get<SyncedLocation>(campaignLocationKey(code, id));
    await refreshCampaignTTL(redis, code);
    if (!raw) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ location: raw });
  } catch (error) {
    console.error('Failed to fetch location:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const { code, id } = await params;
    const body = await request.json();
    const { dmId, location } = body as {
      dmId: string;
      location: SyncedLocation;
    };

    if (!dmId || !location) {
      return NextResponse.json(
        { error: 'dmId and location are required' },
        { status: 400 }
      );
    }

    const redis = getRedis();

    const dmAuth = await verifyDmAuthority(redis, code, dmId);
    if (dmAuth === 'mismatch') {
      return NextResponse.json(
        { error: 'dmId does not match campaign owner' },
        { status: 403 }
      );
    }

    // Store the canvas state for this location
    await redis.set(campaignLocationKey(code, id), location, {
      ex: SLIDING_TTL_SECONDS,
    });

    // Upsert metadata in the locations list
    const existingRaw = await redis.get<LocationMetadata[]>(
      campaignLocationsKey(code)
    );
    const existing: LocationMetadata[] = existingRaw
      ? Array.isArray(existingRaw)
        ? existingRaw
        : (JSON.parse(existingRaw as unknown as string) as LocationMetadata[])
      : [];

    const metadata: LocationMetadata = {
      id: location.id,
      name: location.name,
      mapImageUrl: location.mapImageUrl,
      updatedAt: location.updatedAt,
    };

    const updated = existing.filter(l => l.id !== id);
    updated.push(metadata);

    await redis.set(campaignLocationsKey(code), updated, {
      ex: SLIDING_TTL_SECONDS,
    });

    await refreshCampaignTTL(redis, code);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save location:', error);
    return NextResponse.json(
      { error: 'Failed to save location' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const { code, id } = await params;
    const body = await request.json();
    const { dmId } = body as { dmId: string };

    if (!dmId) {
      return NextResponse.json({ error: 'dmId is required' }, { status: 400 });
    }

    const redis = getRedis();

    const dmAuth = await verifyDmAuthority(redis, code, dmId);
    if (dmAuth === 'mismatch') {
      return NextResponse.json(
        { error: 'dmId does not match campaign owner' },
        { status: 403 }
      );
    }

    // Delete the location canvas state
    await redis.del(campaignLocationKey(code, id));

    // Remove from metadata list
    const existingRaw = await redis.get<LocationMetadata[]>(
      campaignLocationsKey(code)
    );
    if (existingRaw) {
      const existing: LocationMetadata[] = Array.isArray(existingRaw)
        ? existingRaw
        : (JSON.parse(existingRaw as unknown as string) as LocationMetadata[]);

      const filtered = existing.filter(l => l.id !== id);

      if (filtered.length === 0) {
        await redis.del(campaignLocationsKey(code));
      } else {
        await redis.set(campaignLocationsKey(code), filtered, {
          ex: SLIDING_TTL_SECONDS,
        });
      }
    }

    await refreshCampaignTTL(redis, code);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete location:', error);
    return NextResponse.json(
      { error: 'Failed to delete location' },
      { status: 500 }
    );
  }
}
