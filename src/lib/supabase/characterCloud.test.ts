import { afterEach, describe, expect, it, vi } from 'vitest';

const createSupabaseBrowserClient = vi.fn();

vi.mock('./browser', () => ({ createSupabaseBrowserClient }));

describe('manual character cloud factory', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    createSupabaseBrowserClient.mockReset();
  });

  it('creates no Supabase client and makes zero character calls when disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');

    const { createManualCharacterCloud } = await import('./characterCloud');

    expect(createManualCharacterCloud(localStorage)).toBeNull();
    expect(createSupabaseBrowserClient).not.toHaveBeenCalled();
  });

  it('creates the manual service only when auth and character backup are enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
    createSupabaseBrowserClient.mockReturnValue({
      auth: { getUser: vi.fn() },
      from: vi.fn(),
      rpc: vi.fn(),
    });

    const { createManualCharacterCloud } = await import('./characterCloud');
    const cloud = createManualCharacterCloud(localStorage);

    expect(cloud).not.toBeNull();
    expect(createSupabaseBrowserClient).toHaveBeenCalledTimes(1);
  });
});
