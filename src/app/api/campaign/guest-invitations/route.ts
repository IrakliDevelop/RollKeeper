import { NextRequest, NextResponse } from 'next/server';

import {
  createGuestSessionServiceForRequest,
  getHybridGuestServerConfig,
  validateGuestMutationRequest,
} from '@/lib/supabase/guestSessionServer';
import type { GuestRpcClient } from '@/lib/supabase/guestSessionGateway';

function unavailable() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request: NextRequest) {
  if (!getHybridGuestServerConfig()) return unavailable();
  const security = validateGuestMutationRequest(request);
  if (!security.ok) {
    return NextResponse.json({ error: security.error }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (
    !body ||
    typeof body.campaignId !== 'string' ||
    (body.legacyPlayerId !== null &&
      body.legacyPlayerId !== undefined &&
      (typeof body.legacyPlayerId !== 'string' ||
        body.legacyPlayerId.length < 1 ||
        body.legacyPlayerId.length > 200)) ||
    !Number.isInteger(body.expiresInMinutes) ||
    (body.expiresInMinutes as number) < 2 ||
    (body.expiresInMinutes as number) > 60 ||
    !Number.isInteger(body.maxUses) ||
    (body.maxUses as number) < 1 ||
    (body.maxUses as number) > 5
  ) {
    return NextResponse.json(
      { error: 'Invalid invitation request' },
      { status: 400 }
    );
  }
  const context = await createGuestSessionServiceForRequest();
  if (!context?.userClient) {
    return NextResponse.json(
      { error: 'Authentication is required' },
      { status: 401 }
    );
  }
  try {
    const result = await context.service.issue({
      campaignId: body.campaignId,
      legacyPlayerId:
        typeof body.legacyPlayerId === 'string' ? body.legacyPlayerId : null,
      expiresInMinutes: body.expiresInMinutes as number,
      maxUses: body.maxUses as number,
    });
    if (result.status !== 'issued') return unavailable();
    const response = NextResponse.json({
      invitation: result.invitation,
      // Keep the one-time secret in the URL fragment so it is never sent in
      // the initial HTTP request or captured by request/access logs.
      redemptionPath: `/guest#invite=${result.invitationToken}`,
    });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch {
    return NextResponse.json(
      { error: 'Invitation could not be issued' },
      { status: 403 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!getHybridGuestServerConfig()) return unavailable();
  const campaignId = request.nextUrl.searchParams.get('campaignId');
  if (!campaignId) {
    return NextResponse.json(
      { error: 'campaignId is required' },
      { status: 400 }
    );
  }
  const context = await createGuestSessionServiceForRequest();
  if (!context?.userClient) {
    return NextResponse.json(
      { error: 'Authentication is required' },
      { status: 401 }
    );
  }
  const { data, error } = await (
    context.userClient as unknown as GuestRpcClient
  ).rpc('list_campaign_guest_access', { p_campaign_id: campaignId });
  if (error) {
    return NextResponse.json({ error: 'Access list denied' }, { status: 403 });
  }
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
