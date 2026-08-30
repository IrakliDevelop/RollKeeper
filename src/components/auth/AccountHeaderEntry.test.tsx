import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/supabase/authConfig', () => ({
  getPublicAuthConfig: () => ({
    url: 'http://localhost:54321',
    publishableKey: 'test-key',
  }),
}));

const unsubscribe = vi.fn();
const signOut = vi.fn().mockResolvedValue({ error: null });
let authListener:
  | ((event: string, session: { user: { email: string } } | null) => void)
  | undefined;

vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      onAuthStateChange: (
        callback: (
          event: string,
          session: { user: { email: string } } | null
        ) => void
      ) => {
        authListener = callback;
        callback('INITIAL_SESSION', null);
        return { data: { subscription: { unsubscribe } } };
      },
      signOut,
    },
  }),
}));

import { AccountHeaderEntry, accountInitials } from './AccountHeaderEntry';

describe('AccountHeaderEntry', () => {
  afterEach(() => {
    cleanup();
    authListener = undefined;
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
  });

  it('derives initials from the local part of the email', () => {
    expect(accountInitials('lyra@example.com')).toBe('LY');
  });

  it('opens sign-in from the header chip and shows the signed-in menu', async () => {
    render(<AccountHeaderEntry />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByLabelText(/^Email address/)).toBeInTheDocument();

    authListener?.('SIGNED_IN', { user: { email: 'lyra@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('lyra@example.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /lyra@example.com/i }));
    expect(
      screen.getByRole('menuitem', { name: 'Switch account' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Sign out' })
    ).toBeInTheDocument();
  });

  it('signs out without clearing legacy storage', async () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      '{"state":{"characters":[]}}'
    );
    render(<AccountHeaderEntry />);
    authListener?.('SIGNED_IN', { user: { email: 'lyra@example.com' } });

    fireEvent.click(
      await screen.findByRole('button', { name: /lyra@example.com/i })
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('rollkeeper-player-data')).toBe(
      '{"state":{"characters":[]}}'
    );
  });

  it('shows an accessible sign-out confirmation error', async () => {
    signOut.mockResolvedValueOnce({
      error: { message: 'Network request failed' },
    });
    render(<AccountHeaderEntry />);
    authListener?.('SIGNED_IN', { user: { email: 'lyra@example.com' } });

    fireEvent.click(
      await screen.findByRole('button', { name: /lyra@example.com/i })
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(
      await screen.findByRole('alert', {
        name: 'RollKeeper could not confirm sign-out with the account service. Check your connection before continuing.',
      })
    ).toBeInTheDocument();
  });
});
