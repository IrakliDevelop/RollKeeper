import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GUEST_SESSION_COOKIE,
  guestSessionCookieOptions,
  isHybridGuestServerEnabled,
  validateGuestMutationRequest,
} from './guestSessionSecurity';

describe('hybrid guest server gate and request security', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is default-off and is independent from the client visibility flag', () => {
    expect(isHybridGuestServerEnabled()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_HYBRID_GUEST_UI_ENABLED', 'true');
    expect(isHybridGuestServerEnabled()).toBe(false);
    vi.stubEnv('SUPABASE_HYBRID_GUEST_ENABLED', 'true');
    expect(isHybridGuestServerEnabled()).toBe(true);
  });

  it('uses an HttpOnly, host-only, strict, narrowly scoped cookie', () => {
    expect(GUEST_SESSION_COOKIE).toBe('rk_guest_session');
    expect(guestSessionCookieOptions('production')).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/campaign',
    });
    expect(guestSessionCookieOptions('development')).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/api/campaign',
    });
    expect(guestSessionCookieOptions('production')).not.toHaveProperty(
      'domain'
    );
  });

  it('requires exact Origin, JSON, and an explicit CSRF header for mutations', () => {
    const valid = new NextRequest('https://rk-pr-a.localhost/api/campaign/X', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://rk-pr-a.localhost',
        'x-rollkeeper-csrf': '1',
      },
    });
    expect(validateGuestMutationRequest(valid)).toEqual({ ok: true });

    for (const headers of [
      { 'content-type': 'application/json', 'x-rollkeeper-csrf': '1' },
      {
        'content-type': 'application/json',
        origin: 'https://evil.localhost',
        'x-rollkeeper-csrf': '1',
      },
      {
        'content-type': 'text/plain',
        origin: 'https://rk-pr-a.localhost',
        'x-rollkeeper-csrf': '1',
      },
      {
        'content-type': 'application/json',
        origin: 'https://rk-pr-a.localhost',
      },
    ]) {
      const request = new NextRequest(
        'https://rk-pr-a.localhost/api/campaign/X',
        { method: 'POST', headers: headers as HeadersInit }
      );
      expect(validateGuestMutationRequest(request)).toMatchObject({
        ok: false,
        status: 403,
      });
    }
  });
});
