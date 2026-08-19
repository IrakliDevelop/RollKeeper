import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GuestRedemptionPage } from './GuestRedemptionPage';

describe('GuestRedemptionPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('scrubs the raw invitation from the URL before redeeming and stores no token', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_HYBRID_GUEST_UI_ENABLED', 'true');
    const token = 'a'.repeat(64);
    window.history.replaceState(null, '', `/guest#invite=${token}`);
    const order: string[] = [];
    const replace = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation((_state, _unused, url) => {
        order.push(`replace:${String(url)}`);
      });
    const fetchMock = vi.fn().mockImplementation(async () => {
      order.push('fetch');
      return {
        ok: true,
        json: async () => ({
          session: {
            sessionId: 'session-a',
            displayCode: 'A1B2C3D4E5F6',
            legacyPlayerId: 'player-a',
            scopes: ['player:read', 'player:sync'],
            expiresAt: '2026-08-19T04:00:00.000Z',
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<GuestRedemptionPage />);

    await screen.findByText(/guest session is active/i);
    expect(order[0]).toBe('replace:/guest');
    expect(order[1]).toBe('fetch');
    expect(replace).toHaveBeenCalledWith(null, '', '/guest');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.body.textContent).not.toContain(token);
  });

  it('visibly rotates and refreshes only the bound safe player projection', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_HYBRID_GUEST_UI_ENABLED', 'true');
    window.history.replaceState(null, '', `/guest#invite=${'a'.repeat(64)}`);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          session: {
            sessionId: 'session-a',
            displayCode: 'A1B2C3D4E5F6',
            legacyPlayerId: 'player-a',
            scopes: ['player:read'],
            expiresAt: '2026-08-19T04:00:00.000Z',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          player: { characterName: 'Mira Vale', character: { revision: 7 } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          session: {
            sessionId: 'session-b',
            displayCode: 'A1B2C3D4E5F6',
            legacyPlayerId: 'player-a',
            scopes: ['player:read'],
            expiresAt: '2026-08-19T05:00:00.000Z',
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<GuestRedemptionPage />);
    await screen.findByText(/guest session is active/i);

    fireEvent.click(
      screen.getByRole('button', { name: 'View safe player state' })
    );
    expect(await screen.findByText(/Mira Vale/u)).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Rotate guest session' })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.getByText(/session rotated/i)).toBeVisible();
  });

  it('shows replay, expiry, revocation, and invalid-token failures without retaining input', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_HYBRID_GUEST_UI_ENABLED', 'true');
    const token = 'b'.repeat(64);
    window.history.replaceState(null, '', `/guest#invite=${token}`);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: vi
          .fn()
          .mockResolvedValue({ error: 'Invitation is invalid or expired' }),
      })
    );
    render(<GuestRedemptionPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /invalid, expired, used, or revoked/i
    );
    expect(document.body.textContent).not.toContain(token);
    expect(window.location.search).toBe('');
  });
});
