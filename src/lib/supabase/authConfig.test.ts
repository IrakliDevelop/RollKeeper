import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPublicAuthConfig } from './authConfig';

describe('getPublicAuthConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when auth is disabled even if public credentials exist', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');

    expect(getPublicAuthConfig()).toBeNull();
  });

  it('fails closed when enabled without complete public credentials', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');

    expect(getPublicAuthConfig()).toBeNull();
  });

  it('returns only public auth configuration when enabled and complete', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'turnstile_public_test');

    expect(getPublicAuthConfig()).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_test',
      turnstileSiteKey: 'turnstile_public_test',
    });
  });
});
