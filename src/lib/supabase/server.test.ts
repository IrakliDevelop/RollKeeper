import { afterEach, describe, expect, it, vi } from 'vitest';

const { cookies, createServerClient, getClaims } = vi.hoisted(() => {
  const hoistedGetClaims = vi.fn().mockResolvedValue({
    data: { claims: { email: 'player@example.com', sub: 'user-a' } },
    error: null,
  });
  return {
    cookies: vi
      .fn()
      .mockResolvedValue({ getAll: vi.fn(() => []), set: vi.fn() }),
    createServerClient: vi.fn(() => ({
      auth: { getClaims: hoistedGetClaims },
    })),
    getClaims: hoistedGetClaims,
  };
});

vi.mock('next/headers', () => ({ cookies }));
vi.mock('@supabase/ssr', () => ({ createServerClient }));

describe('server Supabase auth client', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    cookies.mockClear();
    createServerClient.mockClear();
    getClaims.mockClear();
  });

  it('does not access cookies or Supabase while auth is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'false');
    const { getServerAuthClaims } = await import('./server');

    expect(await getServerAuthClaims()).toBeNull();
    expect(cookies).not.toHaveBeenCalled();
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('validates enabled server identity with getClaims', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    const { getServerAuthClaims } = await import('./server');

    await expect(getServerAuthClaims()).resolves.toMatchObject({
      email: 'player@example.com',
      sub: 'user-a',
    });
    expect(getClaims).toHaveBeenCalledTimes(1);
  });
});
