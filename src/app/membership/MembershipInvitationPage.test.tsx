import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MembershipInvitationPage } from './MembershipInvitationPage';

describe('MembershipInvitationPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('renders and calls nothing while the independent client gate is disabled', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<MembershipInvitationPage />);
    expect(document.body).toHaveTextContent('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts a pasted secret without placing it in URL or storage', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_CAMPAIGN_MEMBERSHIP_UI_ENABLED', 'true');
    const token = 'a'.repeat(64);
    const fetchMock = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({ status: 'active', campaignId: 'campaign-a' }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MembershipInvitationPage />);

    fireEvent.change(screen.getByLabelText('Invitation secret'), {
      target: { value: token },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept membership' }));
    await screen.findByText(/membership accepted/i);
    expect(window.location.href).not.toContain(token);
    expect(document.body.textContent).not.toContain(token);
    expect(localStorage.length).toBe(0);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(
      /characterData|payload/iu
    );
  });

  it('requires a separate explicit cloud-character link after acceptance', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_CAMPAIGN_MEMBERSHIP_UI_ENABLED', 'true');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ memberships: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'active', campaignId: 'campaign-a' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'active' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<MembershipInvitationPage />);
    fireEvent.change(screen.getByLabelText('Invitation secret'), {
      target: { value: 'b'.repeat(64) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept membership' }));
    await screen.findByText(/membership accepted/i);
    fireEvent.change(screen.getByLabelText('Cloud character ID'), {
      target: { value: 'cloud-character-a' },
    });
    fireEvent.change(screen.getByLabelText('Legacy player ID'), {
      target: { value: 'legacy-player-a' },
    });
    fireEvent.change(screen.getByLabelText('Legacy character ID'), {
      target: { value: 'legacy-character-a' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Link this cloud character' })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const body = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(body).toMatchObject({
      characterId: 'cloud-character-a',
      campaignId: 'campaign-a',
    });
    expect(body).not.toHaveProperty('characterData');
    expect(body).not.toHaveProperty('payload');
  });

  it('restores the accepted campaign from an account-scoped DTO after reload', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_CAMPAIGN_MEMBERSHIP_UI_ENABLED', 'true');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        memberships: [
          {
            campaignId: 'campaign-a',
            role: 'player',
            status: 'active',
            epoch: 0,
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<MembershipInvitationPage />);

    expect(await screen.findByLabelText('Cloud character ID')).toBeVisible();
    expect(screen.getByText(/accepted campaign campaign-a/iu)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith('/api/campaign/membership-links', {
      cache: 'no-store',
    });
  });
});
