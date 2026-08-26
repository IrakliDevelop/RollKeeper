import { NextRequest, NextResponse } from 'next/server';

import {
  GUEST_SESSION_COOKIE,
  guestSessionCookieOptions,
} from '@/lib/guestSessionSecurity';
import { authorizeHybridGuestRoute } from '@/lib/supabase/guestSessionServer';

export async function GET(request: NextRequest) {
  const displayCode = request.nextUrl.searchParams.get('code');
  if (!displayCode) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }
  const resolution = await authorizeHybridGuestRoute(
    request,
    displayCode,
    'campaign:read'
  );
  if (resolution.mode !== 'guest') {
    const response = NextResponse.json(
      { error: 'Guest session is not authorized' },
      { status: resolution.mode === 'denied' ? resolution.status : 401 }
    );
    if (resolution.mode === 'denied' && resolution.clearCookie) {
      response.cookies.set(GUEST_SESSION_COOKIE, '', {
        ...guestSessionCookieOptions(),
        maxAge: 0,
      });
    }
    return response;
  }
  return NextResponse.json(
    { session: resolution.principal },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
