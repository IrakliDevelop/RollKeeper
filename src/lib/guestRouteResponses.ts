import { NextResponse } from 'next/server';

import type { HybridGuestResolution } from './guestRouteAuthorization';
import {
  GUEST_SESSION_COOKIE,
  guestSessionCookieOptions,
  isHybridGuestServerEnabled,
} from './guestSessionSecurity';
import type { NextRequest } from 'next/server';

export function guestDeniedResponse(
  resolution: Extract<HybridGuestResolution, { mode: 'denied' }>
) {
  const response = NextResponse.json(
    { error: 'Guest session is not authorized' },
    { status: resolution.status }
  );
  if (resolution.clearCookie) {
    response.cookies.set(GUEST_SESSION_COOKIE, '', {
      ...guestSessionCookieOptions(),
      maxAge: 0,
    });
  }
  return response;
}

export function requireGuestPlayerBinding(
  resolution: Extract<HybridGuestResolution, { mode: 'guest' }>,
  assertedIds: readonly unknown[]
): string | null {
  const bound = resolution.principal.legacyPlayerId;
  if (!bound) return null;
  return assertedIds.every(
    value => value === undefined || value === null || value === bound
  )
    ? bound
    : null;
}

export function rejectHybridGuestPrivilegeEscalation(request: NextRequest) {
  if (
    isHybridGuestServerEnabled() &&
    request.cookies.has(GUEST_SESSION_COOKIE)
  ) {
    return NextResponse.json(
      { error: 'Guest sessions cannot perform DM or owner operations' },
      { status: 403 }
    );
  }
  return null;
}
