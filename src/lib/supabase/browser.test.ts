import { afterEach, describe, expect, it, vi } from 'vitest';

const createBrowserClient = vi.fn(() => ({ auth: {} }));

vi.mock('@supabase/ssr', () => ({ createBrowserClient }));

describe('createSupabaseBrowserClient', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    createBrowserClient.mockClear();
  });

  it('makes zero Supabase calls when auth is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');

    const { createSupabaseBrowserClient } = await import('./browser');

    expect(createSupabaseBrowserClient()).toBeNull();
    expect(createBrowserClient).not.toHaveBeenCalled();
  });

  it('creates a cookie-backed browser client when auth is enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');

    const { createSupabaseBrowserClient } = await import('./browser');

    expect(createSupabaseBrowserClient()).toEqual({ auth: {} });
    expect(createBrowserClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'sb_publishable_test'
    );
  });
});
