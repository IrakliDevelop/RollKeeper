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

import { AccountControls } from './AccountControls';

const LEGACY_VALUE = '{"state":{"characters":[{"id":"legacy"}]}}';

describe('AccountControls', () => {
  afterEach(cleanup);
  it('shows the verified account email', () => {
    render(
      <AccountControls
        email="player@example.com"
        auth={{ signOut: vi.fn() }}
        onSessionChanged={vi.fn()}
      />
    );

    expect(screen.getByText('player@example.com')).toBeInTheDocument();
  });

  it.each(['Sign out', 'Switch account'])(
    '%s preserves legacy storage bytes',
    async action => {
      localStorage.setItem('rollkeeper-player-data', LEGACY_VALUE);
      const signOut = vi.fn().mockResolvedValue({ error: null });
      const onSessionChanged = vi.fn();

      render(
        <AccountControls
          email="player@example.com"
          auth={{ signOut }}
          onSessionChanged={onSessionChanged}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: action }));

      await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
      expect(localStorage.getItem('rollkeeper-player-data')).toBe(LEGACY_VALUE);
      expect(onSessionChanged).toHaveBeenCalledWith(
        action === 'Switch account' ? '/account' : '/'
      );
    }
  );
});
