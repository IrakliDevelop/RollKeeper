import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

const { createServerClient, getClaims } = vi.hoisted(() => {
  const hoistedGetClaims = vi
    .fn()
    .mockResolvedValue({ data: { claims: null } });
  return {
    getClaims: hoistedGetClaims,
    createServerClient: vi.fn(() => ({
      auth: { getClaims: hoistedGetClaims },
    })),
  };
});

vi.mock('@supabase/ssr', () => ({ createServerClient }));

describe('proxy auth refresh and dev-route gating', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 404 for a dev-only route in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await proxy(new NextRequest('http://localhost/dice-test'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nested dev-only path in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await proxy(
      new NextRequest('http://localhost/design-system/buttons')
    );
    expect(res.status).toBe(404);
  });

  it('allows dev-only routes outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const res = await proxy(new NextRequest('http://localhost/dice-test'));
    expect(res.status).toBe(200);
  });

  it('makes zero Supabase calls when auth is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'false');

    await proxy(new NextRequest('http://localhost/player'));

    expect(createServerClient).not.toHaveBeenCalled();
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('refreshes enabled sessions with getClaims rather than getSession', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');

    await proxy(new NextRequest('http://localhost/player'));

    expect(createServerClient).toHaveBeenCalledTimes(1);
    expect(getClaims).toHaveBeenCalledTimes(1);
  });
});
