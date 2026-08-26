import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { resolveHybridGuestRequest } from './guestRouteAuthorization';

function request(options: {
  cookie?: string;
  method?: string;
  origin?: string;
  csrf?: string;
}) {
  const headers = new Headers();
  if (options.cookie)
    headers.set('cookie', `rk_guest_session=${options.cookie}`);
  if (options.origin) headers.set('origin', options.origin);
  if (options.csrf) headers.set('x-rollkeeper-csrf', options.csrf);
  if (options.method !== 'GET') headers.set('content-type', 'application/json');
  return new NextRequest(
    'https://rk-pr-a.localhost/api/campaign/A1B2C3D4E5F6/sync',
    { method: options.method ?? 'GET', headers }
  );
}

describe('hybrid guest route authorization', () => {
  it('preserves the exact legacy path with zero guest calls while disabled or cookieless', async () => {
    const authorize = vi.fn();
    const recordInvalid = vi.fn();

    await expect(
      resolveHybridGuestRequest(request({ cookie: 'token', method: 'GET' }), {
        enabled: false,
        displayCode: 'A1B2C3D4E5F6',
        requiredScope: 'player:read',
        authorize,
        recordInvalid,
      })
    ).resolves.toEqual({ mode: 'legacy' });
    await expect(
      resolveHybridGuestRequest(request({ method: 'GET' }), {
        enabled: true,
        displayCode: 'A1B2C3D4E5F6',
        requiredScope: 'player:read',
        authorize,
        recordInvalid,
      })
    ).resolves.toEqual({ mode: 'legacy' });
    expect(authorize).not.toHaveBeenCalled();
    expect(recordInvalid).not.toHaveBeenCalled();
  });

  it('returns the immutable server binding and ignores no caller-selected ID', async () => {
    const authorize = vi.fn().mockResolvedValue({
      sessionId: 'session-a',
      campaignId: 'campaign-a',
      subjectId: 'subject-a',
      legacyPlayerId: 'bound-player-a',
      scopes: ['player:sync'],
      expiresAt: '2026-08-19T04:00:00.000Z',
    });
    const result = await resolveHybridGuestRequest(
      request({
        cookie: 'a'.repeat(64),
        method: 'POST',
        origin: 'https://rk-pr-a.localhost',
        csrf: '1',
      }),
      {
        enabled: true,
        displayCode: 'A1B2C3D4E5F6',
        requiredScope: 'player:sync',
        mutation: true,
        authorize,
        recordInvalid: vi.fn(),
      }
    );

    expect(result).toMatchObject({
      mode: 'guest',
      principal: { legacyPlayerId: 'bound-player-a' },
    });
  });

  it('denies fabricated, wrong-campaign, wrong-scope, expired, and revoked cookies and records failure', async () => {
    const authorize = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('denied'), { category: 'denied' })
      );
    const recordInvalid = vi.fn().mockResolvedValue(true);
    const result = await resolveHybridGuestRequest(
      request({ cookie: 'fabricated', method: 'GET' }),
      {
        enabled: true,
        displayCode: 'BAD0BAD0BAD0',
        requiredScope: 'dm:read',
        authorize,
        recordInvalid,
      }
    );

    expect(result).toMatchObject({ mode: 'denied', status: 401 });
    expect(recordInvalid).toHaveBeenCalledOnce();
  });

  it('returns 429 after the failed-validation bucket is exhausted', async () => {
    const result = await resolveHybridGuestRequest(
      request({ cookie: 'fabricated', method: 'GET' }),
      {
        enabled: true,
        displayCode: 'A1B2C3D4E5F6',
        requiredScope: 'player:read',
        authorize: vi.fn().mockRejectedValue(new Error('denied')),
        recordInvalid: vi.fn().mockResolvedValue(false),
      }
    );
    expect(result).toMatchObject({ mode: 'denied', status: 429 });
  });

  it('rejects mutation requests before database authorization when Origin or CSRF is invalid', async () => {
    const authorize = vi.fn();
    const result = await resolveHybridGuestRequest(
      request({
        cookie: 'a'.repeat(64),
        method: 'POST',
        origin: 'https://evil.localhost',
      }),
      {
        enabled: true,
        displayCode: 'A1B2C3D4E5F6',
        requiredScope: 'player:sync',
        mutation: true,
        authorize,
        recordInvalid: vi.fn(),
      }
    );
    expect(result).toMatchObject({ mode: 'denied', status: 403 });
    expect(authorize).not.toHaveBeenCalled();
  });
});
