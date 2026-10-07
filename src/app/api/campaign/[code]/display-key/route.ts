import { NextRequest, NextResponse } from 'next/server';
import { rejectHybridGuestPrivilegeEscalation } from '@/lib/guestRouteResponses';
import { randomUUID } from 'crypto';
import {
  getRedis,
  campaignDisplayKeyKey,
  SLIDING_TTL_SECONDS,
} from '@/lib/redis';
import { authorizeTableDm } from '@/lib/tableServer/auth';
import { isTableProtocolRequired } from '@/lib/tableServer/control';
import { readBoundedJson } from '@/lib/tableServer/validation';

/**
 * Legacy (Table v1 off) map-pinned display key. Under Table v1 the campaign
 * display capability replaces it (PR05 E3): this route answers 426 and never
 * mints a plaintext key.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (isTableProtocolRequired()) {
    return NextResponse.json(
      { error: 'Use Open display from a Table scene or the campaign page' },
      { status: 426 }
    );
  }
  const guestDenied = rejectHybridGuestPrivilegeEscalation(request);
  if (guestDenied) return guestDenied;
  try {
    const { code } = await params;
    if (!process.env.BATTLEMAP_RELAY_SECRET) {
      return NextResponse.json(
        { error: 'Live battle map relay is not configured' },
        { status: 503 }
      );
    }
    let body: unknown;
    try {
      body = await readBoundedJson(request);
    } catch {
      return NextResponse.json(
        { error: 'Invalid or oversized JSON body' },
        { status: 400 }
      );
    }
    const dmId =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).dmId
        : undefined;
    if (!dmId) {
      return NextResponse.json({ error: 'dmId is required' }, { status: 400 });
    }
    // PR05 E3: account owner/DM membership + existing DM authority +
    // origin/CSRF; legacy membership mode keeps `verifyDmAuthority` inside.
    const auth = await authorizeTableDm(request, code, dmId, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    // Re-minting rotates the key: old display URLs stop working (one table monitor).
    const displayKey = randomUUID();
    await getRedis().set(campaignDisplayKeyKey(code), displayKey, {
      ex: SLIDING_TTL_SECONDS,
    });
    return NextResponse.json(
      { displayKey },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        },
      }
    );
  } catch (error) {
    console.error(
      'Error minting display key:',
      error instanceof Error ? error.message : 'unknown'
    );
    return NextResponse.json(
      { error: 'Failed to mint display key' },
      { status: 500 }
    );
  }
}
