import { NextRequest, NextResponse } from 'next/server';

import {
  GUEST_SESSION_COOKIE,
  guestSessionCookieOptions,
} from '@/lib/guestSessionSecurity';
import {
  createGuestSessionServiceForRequest,
  getHybridGuestServerConfig,
  guestRequestRateKey,
  validateGuestMutationRequest,
} from '@/lib/supabase/guestSessionServer';

export async function POST(request: NextRequest) {
  if (!getHybridGuestServerConfig()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const security = validateGuestMutationRequest(request);
  if (!security.ok) {
    return NextResponse.json({ error: security.error }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    invitationToken?: string;
    mutationId?: string;
  } | null;
  if (!body?.invitationToken || !body.mutationId) {
    return NextResponse.json(
      { error: 'Invitation token and mutation ID are required' },
      { status: 400 }
    );
  }
  const context = await createGuestSessionServiceForRequest();
  if (!context) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const result = await context.service.redeem({
    invitationToken: body.invitationToken,
    mutationId: body.mutationId,
    rateKeyHash: guestRequestRateKey(request, context.pepper),
  });
  if (result.status === 'rate-limited') {
    return NextResponse.json({ error: 'Try again later' }, { status: 429 });
  }
  if (result.status !== 'redeemed') {
    const denied = NextResponse.json(
      { error: 'Invitation is invalid or expired' },
      { status: 401 }
    );
    denied.cookies.set(GUEST_SESSION_COOKIE, '', {
      ...guestSessionCookieOptions(),
      maxAge: 0,
    });
    return denied;
  }
  const response = NextResponse.json({
    session: {
      sessionId: result.sessionId,
      campaignId: result.campaignId,
      displayCode: result.displayCode,
      subjectId: result.subjectId,
      legacyPlayerId: result.legacyPlayerId,
      scopes: result.scopes,
      expiresAt: result.expiresAt,
    },
  });
  response.cookies.set(
    GUEST_SESSION_COOKIE,
    result.sessionToken,
    guestSessionCookieOptions()
  );
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
