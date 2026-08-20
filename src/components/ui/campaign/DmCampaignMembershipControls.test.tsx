import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';

import { DmCampaignMembershipControls } from './DmCampaignMembershipControls';

const workspace: DmWorkspaceDocument = {
  namespace: 'user:owner-a',
  localId: 'local-a',
  legacyId: 'local-a',
  name: 'Synthetic membership',
  creationKind: 'new_workspace',
  sourceFingerprint: null,
  createdAt: '2026-08-20T00:00:00.000Z',
  family: 'workspace_identity',
  cloudId: 'campaign-a',
  displayCode: 'A1B2C3D4E5F6',
  membershipAuthority: 'legacy',
  familyAuthorities: 'legacy',
  liveRuntimeAuthority: 'redis_relay',
  acknowledgedAt: '2026-08-20T00:00:01.000Z',
};

function enable() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_CAMPAIGN_MEMBERSHIP_UI_ENABLED', 'true');
}

describe('DmCampaignMembershipControls', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders nothing and touches no network or storage while default-off', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { container } = render(
      <DmCampaignMembershipControls workspaces={[workspace]} />
    );
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('generates the raw secret only in memory and sends only its hash with stable replay input', async () => {
    enable();
    vi.stubGlobal('crypto', {
      getRandomValues: (value: Uint8Array) => value.fill(1),
      randomUUID: () => 'mutation-a',
      subtle: { digest: async () => new Uint8Array(32).fill(2).buffer },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        acceptancePath: '/membership',
        invitation: { invitationId: 'invite-a' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<DmCampaignMembershipControls workspaces={[workspace]} />);
    fireEvent.change(screen.getByLabelText('Invited account ID'), {
      target: { value: 'account-a' },
    });
    fireEvent.change(screen.getByLabelText('Intended legacy player ID'), {
      target: { value: 'legacy-a' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Issue account invitation' })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({
      mutationId: 'mutation-a',
      tokenHash: '02'.repeat(32),
    });
    expect(JSON.stringify(body)).not.toContain('01'.repeat(32));
    expect(
      (screen.getByLabelText(/one-time invitation secret/i) as HTMLInputElement)
        .value
    ).toBe('01'.repeat(32));
    expect(
      (screen.getByLabelText(/contains no secret/i) as HTMLInputElement).value
    ).toBe('http://localhost:3000/membership');
    expect(localStorage.length).toBe(0);
  });

  it('shows every readiness category and requires the exact current fingerprint', async () => {
    enable();
    const fingerprint = 'a'.repeat(64);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ shadow: {}, entries: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          version: 3,
          fingerprint,
          blockerCount: 0,
          manifest: {
            legacyRoster: [
              {
                kind: 'legacy_roster',
                sourceId: 'legacy-a',
                label: 'Legacy A',
              },
            ],
            guestSubjects: [
              {
                kind: 'guest_subject',
                sourceId: 'guest-a',
                label: 'Guest A',
              },
            ],
            invitations: [{ invitationId: 'invite-a', status: 'accepted' }],
            acceptedMembers: [{ accountId: 'account-a' }],
            characterLinks: [{ characterId: 'character-a' }],
            classifications: [
              { sourceId: 'old-a', classification: 'abandoned' },
            ],
            removals: [{ accountId: 'removed-a', status: 'removed' }],
            blockers: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authority: 'postgres', epoch: 1 }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<DmCampaignMembershipControls workspaces={[workspace]} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh exact readiness manifest' })
    );
    await screen.findByText('Legacy A');
    for (const label of [
      'Guest subjects',
      'Invitations',
      'Accepted members',
      'Character links',
      'Classifications',
      'Removals and tombstones',
      'Blockers',
    ]) {
      expect(screen.getByRole('region', { name: label })).toBeVisible();
    }
    expect(
      screen.getAllByRole('button', { name: 'Classify abandoned' })
    ).toHaveLength(2);
    const cutover = screen.getByRole('button', {
      name: 'Confirm atomic membership cutover',
    });
    expect(cutover).toBeDisabled();
    fireEvent.change(
      screen.getByLabelText('Confirm exact manifest fingerprint'),
      { target: { value: fingerprint } }
    );
    expect(cutover).toBeEnabled();
    fireEvent.click(cutover);
    await screen.findByText(/Postgres at epoch 1/i);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1].body))).toMatchObject({
      action: 'cutover',
      fingerprint,
      version: 3,
    });
  });

  it('uses invitation IDs as readiness row keys when one account has multiple invitations', async () => {
    enable();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          version: 1,
          fingerprint: 'b'.repeat(64),
          blockerCount: 1,
          manifest: {
            legacyRoster: [],
            guestSubjects: [],
            invitations: [
              {
                invitationId: 'invite-a',
                accountId: 'account-a',
                status: 'revoked',
              },
              {
                invitationId: 'invite-b',
                accountId: 'account-a',
                status: 'pending',
              },
            ],
            acceptedMembers: [],
            characterLinks: [],
            classifications: [],
            removals: [],
            blockers: [{ kind: 'pending_invitation' }],
          },
        }),
      })
    );
    render(<DmCampaignMembershipControls workspaces={[workspace]} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh exact readiness manifest' })
    );
    await screen.findByText('Invitations (2)');
    expect(
      consoleError.mock.calls.some(call =>
        call.some(value => String(value).includes('same key'))
      )
    ).toBe(false);
  });
});
