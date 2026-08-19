import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';

import { DmGuestInvitationControls } from './DmGuestInvitationControls';

const workspace: DmWorkspaceDocument = {
  namespace: 'user:account-a',
  localId: 'local-a',
  legacyId: 'local-a',
  name: 'Northwatch',
  creationKind: 'new_workspace',
  sourceFingerprint: null,
  createdAt: '2026-08-19T00:00:00.000Z',
  family: 'workspace_identity',
  cloudId: 'campaign-a',
  displayCode: 'A1B2C3D4E5F6',
  membershipAuthority: 'legacy',
  familyAuthorities: 'legacy',
  liveRuntimeAuthority: 'redis_relay',
  acknowledgedAt: '2026-08-19T00:00:01.000Z',
};

describe('DmGuestInvitationControls', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders nothing and makes zero requests while the client visibility gate is off', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(
      <DmGuestInvitationControls workspaces={[workspace]} />
    );
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('issues a narrow bound invitation only after an explicit owner action', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_HYBRID_GUEST_UI_ENABLED', 'true');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        invitation: {
          invitationId: 'invitation-a',
          displayCode: 'A1B2C3D4E5F6',
          legacyPlayerId: 'player-a',
          expiresAt: '2026-08-19T00:30:00.000Z',
          maxUses: 1,
          useCount: 0,
          scopes: ['player:sync'],
        },
        redemptionPath: `/guest#invite=${'a'.repeat(64)}`,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<DmGuestInvitationControls workspaces={[workspace]} />);

    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Bound legacy player ID'), {
      target: { value: 'player-a' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Issue guest invitation' })
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/campaign/guest-invitations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-rollkeeper-csrf': '1',
        }),
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      campaignId: 'campaign-a',
      legacyPlayerId: 'player-a',
      expiresInMinutes: 30,
      maxUses: 1,
    });
    expect(
      (screen.getByLabelText('One-time guest link') as HTMLInputElement).value
    ).toContain(`/guest#invite=${'a'.repeat(64)}`);
  });

  it('adopts the first eligible workspace when durable records load asynchronously', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_HYBRID_GUEST_UI_ENABLED', 'true');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        redemptionPath: `/guest#invite=${'a'.repeat(64)}`,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<DmGuestInvitationControls workspaces={[]} />);

    rerender(<DmGuestInvitationControls workspaces={[workspace]} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Issue guest invitation' })
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      campaignId: 'campaign-a',
    });
  });

  it('loads safe session metadata and revokes by opaque ID without exposing secrets', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_HYBRID_GUEST_UI_ENABLED', 'true');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          invitations: [],
          sessions: [
            {
              sessionId: 'session-a',
              legacyPlayerId: 'player-a',
              expiresAt: '2026-08-19T04:00:00.000Z',
              revokedAt: null,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) });
    vi.stubGlobal('fetch', fetchMock);
    render(<DmGuestInvitationControls workspaces={[workspace]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load guest access' }));
    expect(await screen.findByText(/player-a/u)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke session' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/campaign/guest-sessions/session-a'
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(
      /session-token|invitation-token/u
    );
  });
});
