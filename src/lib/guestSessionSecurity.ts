import type { NextRequest } from 'next/server';

export const GUEST_SESSION_COOKIE = 'rk_guest_session';
export const GUEST_CSRF_HEADER = 'x-rollkeeper-csrf';
export const GUEST_SESSION_COOKIE_PATH = '/api/campaign';
export const GUEST_SESSION_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

export function isHybridGuestServerEnabled(): boolean {
  return process.env.SUPABASE_HYBRID_GUEST_ENABLED === 'true';
}

export function isHybridGuestUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SUPABASE_HYBRID_GUEST_UI_ENABLED === 'true';
}

export function guestSessionCookieOptions(
  environment: string | undefined = process.env.NODE_ENV
) {
  return {
    httpOnly: true,
    secure: environment === 'production',
    sameSite: 'strict' as const,
    path: GUEST_SESSION_COOKIE_PATH,
    maxAge: GUEST_SESSION_MAX_AGE_SECONDS,
    priority: 'high' as const,
  };
}

export type GuestMutationValidation =
  | { ok: true }
  | { ok: false; status: 403; error: string };

export function validateGuestMutationRequest(
  request: NextRequest
): GuestMutationValidation {
  const origin = request.headers.get('origin');
  const contentType = request.headers.get('content-type') ?? '';
  const csrf = request.headers.get(GUEST_CSRF_HEADER);
  const host = request.headers.get('host');
  const protocol = new URL(request.url).protocol;
  const requestOrigin = host
    ? `${protocol}//${host}`
    : new URL(request.url).origin;

  if (
    origin !== requestOrigin ||
    csrf !== '1' ||
    !/^application\/json(?:\s*;|$)/iu.test(contentType)
  ) {
    return {
      ok: false,
      status: 403,
      error: 'Request origin or CSRF validation failed',
    };
  }

  return { ok: true };
}
