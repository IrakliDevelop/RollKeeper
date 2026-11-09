import { afterEach, describe, expect, it, vi } from 'vitest';

const { createSupabaseBrowserClient } = vi.hoisted(() => ({
  createSupabaseBrowserClient: vi.fn(),
}));
vi.mock('@/lib/supabase/browser', () => ({ createSupabaseBrowserClient }));

import { currentTableAccount } from './tableShopLinks';

afterEach(() => vi.clearAllMocks());

const client = (getSession: () => Promise<unknown>) => ({
  auth: { getSession, getUser: vi.fn() },
});

describe('currentTableAccount (repair 09 LL2)', () => {
  it('uses the local session user, never a network getUser', async () => {
    const supabase = client(async () => ({
      data: { session: { user: { id: 'account-1' } } },
    }));
    createSupabaseBrowserClient.mockReturnValue(supabase);
    await expect(currentTableAccount()).resolves.toEqual({
      kind: 'authenticated',
      accountId: 'account-1',
    });
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it.each([
    ['no Supabase client', null],
    ['no session', client(async () => ({ data: { session: null } }))],
    [
      'a failing session read',
      client(async () => {
        throw new Error('storage blocked');
      }),
    ],
  ])('falls back to the guest Table with %s', async (_label, supabase) => {
    createSupabaseBrowserClient.mockReturnValue(supabase);
    await expect(currentTableAccount()).resolves.toEqual({ kind: 'guest' });
  });
});
