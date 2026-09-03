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
import {
  GUEST_SESSION_COOKIE,
  isHybridGuestServerEnabled,
} from '@/lib/guestSessionSecurity';
import { rejectHybridGuestPrivilegeEscalation } from '@/lib/guestRouteResponses';
import { sanitizePublicMarkers } from '@/lib/sanitizePublicMarkers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    if (
      isHybridGuestServerEnabled() &&
      request.cookies.has(GUEST_SESSION_COOKIE)
    ) {
      return NextResponse.json(
        { error: 'Guest location access is not enabled' },
        { status: 403 }
      );
    }
    const { code, id } = await params;
    const redis = getRedis();
    const rawValue = await redis.get<SyncedLocation | string>(
      campaignLocationKey(code, id)
    );
    await refreshCampaignTTL(redis, code);
    if (!rawValue) {
      // Older deployments refreshed only the list key, allowing a detail key
      // to expire while its metadata remained. Return the original map as a
      // degraded fallback until the DM republishes the full location.
      const metadataRaw = await redis.get<LocationMetadata[]>(
        campaignLocationsKey(code)
      );
      const locations: LocationMetadata[] = metadataRaw
        ? Array.isArray(metadataRaw)
          ? metadataRaw
          : (JSON.parse(metadataRaw as unknown as string) as LocationMetadata[])
        : [];
      const metadata = locations.find(location => location.id === id);

      if (metadata) {
        const fallback: SyncedLocation = {
          ...metadata,
          mapImageSize: { w: 0, h: 0 },
          canvasState: '',
          gridEnabled: false,
        };
        return NextResponse.json({ location: fallback });
      }

      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }
    // The Redis client normally auto-deserializes JSON, but a stored value
    // is not guaranteed to already be an object (client configuration,
    // legacy writes, or a raw REST proxy response can all hand back a
    // string) — parse defensively rather than assume, the same pattern used
    // elsewhere in this route for the metadata list.
    const raw: SyncedLocation =
      typeof rawValue === 'string'
        ? (JSON.parse(rawValue) as SyncedLocation)
        : rawValue;
    // Re-sanitize markers on read-back: an old stored record (written before
    // this boundary existed, or by a compromised/legacy client) could carry
    // smuggled private fields — `portal`, `dmNotes`, or anything else not in
    // the explicit public pick. Never trust what is already in Redis.
    const sanitizedLocation: SyncedLocation = raw.markers
      ? { ...raw, markers: sanitizePublicMarkers(raw.markers) ?? undefined }
      : raw;
    return NextResponse.json({ location: sanitizedLocation });
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
  const guestDenied = rejectHybridGuestPrivilegeEscalation(request);
  if (guestDenied) return guestDenied;
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
    if (dmAuth !== 'ok') {
      return NextResponse.json(
        { error: 'dmId is not authorized for this campaign' },
        { status: 403 }
      );
    }

    // Sanitize markers before they ever reach Redis. `location` is the DM
    // client's JSON body — an adversarial or stale client could include
    // `portal`, `dmNotes`, or other private fields on those marker objects,
    // and this is the last point before they would be persisted and synced
    // to players. Never store the caller's markers object directly.
    const sanitizedLocation: SyncedLocation = location.markers
      ? {
          ...location,
          markers: sanitizePublicMarkers(location.markers) ?? undefined,
        }
      : location;

    // Store the canvas state for this location
    await redis.set(campaignLocationKey(code, id), sanitizedLocation, {
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
  const guestDenied = rejectHybridGuestPrivilegeEscalation(request);
  if (guestDenied) return guestDenied;
  try {
    const { code, id } = await params;
    const body = await request.json();
    const { dmId } = body as { dmId: string };

    if (!dmId) {
      return NextResponse.json({ error: 'dmId is required' }, { status: 400 });
    }

    const redis = getRedis();

    const dmAuth = await verifyDmAuthority(redis, code, dmId);
    if (dmAuth !== 'ok') {
      return NextResponse.json(
        { error: 'dmId is not authorized for this campaign' },
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
