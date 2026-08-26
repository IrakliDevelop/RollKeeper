import type { NextRequest } from 'next/server';

import type { GuestSessionPrincipal } from './supabase/guestSessionGateway';
import { hashGuestSecret } from './guestSessionCrypto';
import {
  GUEST_SESSION_COOKIE,
  validateGuestMutationRequest,
} from './guestSessionSecurity';

interface GuestRouteAuthorizationOptions {
  enabled: boolean;
  displayCode: string;
  requiredScope: string;
  mutation?: boolean;
  authorize(input: {
    sessionToken: string;
    displayCode: string;
    requiredScope: string;
  }): Promise<GuestSessionPrincipal>;
  recordInvalid(keyHash: string): Promise<boolean>;
}

export type HybridGuestResolution =
  | { mode: 'legacy' }
  | { mode: 'guest'; principal: GuestSessionPrincipal }
  | { mode: 'denied'; status: 401 | 403 | 429; clearCookie: boolean };

export async function resolveHybridGuestRequest(
  request: NextRequest,
  options: GuestRouteAuthorizationOptions
): Promise<HybridGuestResolution> {
  if (!options.enabled) return { mode: 'legacy' };
  const sessionToken = request.cookies.get(GUEST_SESSION_COOKIE)?.value;
  if (!sessionToken) return { mode: 'legacy' };

  if (options.mutation) {
    const validation = validateGuestMutationRequest(request);
    if (!validation.ok) {
      return { mode: 'denied', status: 403, clearCookie: false };
    }
  }

  try {
    const principal = await options.authorize({
      sessionToken,
      displayCode: options.displayCode,
      requiredScope: options.requiredScope,
    });
    return { mode: 'guest', principal };
  } catch {
    const allowed = await options.recordInvalid(hashGuestSecret(sessionToken));
    return {
      mode: 'denied',
      status: allowed ? 401 : 429,
      clearCookie: true,
    };
  }
}
