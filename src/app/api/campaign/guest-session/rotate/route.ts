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
  const token = request.cookies.get(GUEST_SESSION_COOKIE)?.value;
  const body = (await request.json().catch(() => null)) as {
    displayCode?: string;
    mutationId?: string;
  } | null;
  if (!token || !body?.displayCode || !body.mutationId) {
    return NextResponse.json(
      { error: 'Guest session is not authorized' },
      { status: 401 }
    );
  }
  const context = await createGuestSessionServiceForRequest();
  if (!context) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const result = await context.service.rotate({
    currentSessionToken: token,
    displayCode: body.displayCode,
    mutationId: body.mutationId,
    rateKeyHash: guestRequestRateKey(request, context.pepper),
  });
  if (result.status === 'rate-limited') {
    return NextResponse.json({ error: 'Try again later' }, { status: 429 });
  }
  if (result.status !== 'rotated') {
    const denied = NextResponse.json(
      { error: 'Guest session is not authorized' },
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
  return response;
}
