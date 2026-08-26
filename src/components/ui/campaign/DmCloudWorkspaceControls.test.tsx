import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BrowserDmWorkspaceContext } from '@/lib/supabase/browserDmWorkspace';

import { expectCloudProductVocabulary } from '@/test/helpers';

import { DmCloudWorkspaceControls } from './DmCloudWorkspaceControls';

function enableWorkspaceCloud() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_DM_WORKSPACE_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
}

function context(): BrowserDmWorkspaceContext {
  return {
    accountId: 'account-a',
    accountLabel: 'owner@example.test',
    close: vi.fn(),
    discover: vi.fn().mockResolvedValue([]),
    remember: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([
      {
        namespace: 'user:account-a',
        localId: 'local-existing',
        legacyId: 'local-existing',
        name: 'Durable Northwatch',
        creationKind: 'new_workspace',
        sourceFingerprint: null,
        createdAt: '2026-08-17T00:00:00.000Z',
        family: 'workspace_identity',
        cloudId: 'cloud-existing',
        displayCode: 'C1C2C3D4E5F6',
        membershipAuthority: 'legacy',
        familyAuthorities: 'legacy',
        liveRuntimeAuthority: 'redis_relay',
        acknowledgedAt: '2026-08-17T00:00:01.000Z',
      },
    ]),
    create: vi.fn().mockResolvedValue({
      status: 'created',
      workspace: {
        campaignId: 'cloud-a',
        displayCode: 'A1B2C3D4E5F6',
        membershipAuthority: 'legacy',
        familyAuthorities: 'legacy',
        liveRuntimeAuthority: 'redis_relay',
      },
    }),
    forkLegacy: vi.fn().mockResolvedValue({
      status: 'created',
      workspace: {
        campaignId: 'cloud-b',
        displayCode: 'B1B2C3D4E5F6',
        membershipAuthority: 'legacy',
        familyAuthorities: 'legacy',
        liveRuntimeAuthority: 'redis_relay',
      },
    }),
  };
}

describe('DmCloudWorkspaceControls', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('renders nothing and makes no calls while the dedicated flag is disabled', () => {
    const cloud = context();
    const { container } = render(
      <DmCloudWorkspaceControls campaigns={[]} dmId="legacy-dm" cloud={cloud} />
    );

    expect(container).toBeEmptyDOMElement();
    expect(cloud.create).not.toHaveBeenCalled();
    expect(cloud.forkLegacy).not.toHaveBeenCalled();
  });

  it('creates an authenticated owner workspace and displays its new code without enabling other authorities', async () => {
    enableWorkspaceCloud();
    const cloud = context();
    const { container } = render(
      <DmCloudWorkspaceControls campaigns={[]} dmId="legacy-dm" cloud={cloud} />
    );

    fireEvent.change(screen.getByLabelText('Cloud workspace name'), {
      target: { value: 'Northwatch' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Create cloud workspace' })
    );

    await waitFor(() =>
      expect(cloud.create).toHaveBeenCalledWith('Northwatch')
    );
    expect(screen.getByText('A1B2C3D4E5F6')).toBeVisible();
    expect(screen.getByText(/membership remains legacy/i)).toBeVisible();
    expect(screen.getByText(/redis and relay remain unchanged/i)).toBeVisible();
    // Coordinator review round 1, Minor 4: both this state's status text and
    // the card's always-rendered description had copy changed with no
    // vocabulary guard.
    expectCloudProductVocabulary(container);
  });

  it('loads acknowledged codes from account-isolated local durability only after an explicit action', async () => {
    enableWorkspaceCloud();
    const cloud = context();
    render(
      <DmCloudWorkspaceControls campaigns={[]} dmId="legacy-dm" cloud={cloud} />
    );

    expect(cloud.list).not.toHaveBeenCalled();
    expect(screen.queryByText('C1C2C3D4E5F6')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Load local cloud workspaces' })
    );

    await waitFor(() => expect(cloud.list).toHaveBeenCalledOnce());
    expect(screen.getByText('Durable Northwatch')).toBeVisible();
    expect(screen.getByText('C1C2C3D4E5F6')).toBeVisible();
  });

  it('exposes the explicit local load action to keyboard users', async () => {
    enableWorkspaceCloud();
    const cloud = context();
    const user = userEvent.setup();
    render(
      <DmCloudWorkspaceControls campaigns={[]} dmId="legacy-dm" cloud={cloud} />
    );

    await user.tab();
    expect(screen.getByLabelText('Cloud workspace name')).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole('button', { name: 'Load local cloud workspaces' })
    ).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(cloud.list).toHaveBeenCalledOnce());
    expect(screen.getByText('C1C2C3D4E5F6')).toBeVisible();
  });

  it('forks into a new code and states that the legacy campaign was not changed', async () => {
    enableWorkspaceCloud();
    const cloud = context();
    render(
      <DmCloudWorkspaceControls
        campaigns={[
          {
            code: 'LEGACY',
            name: 'Old road',
            createdAt: '2026-08-17T00:00:00.000Z',
          },
        ]}
        dmId="legacy-dm"
        cloud={cloud}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Fork Old road to cloud' })
    );

    await waitFor(() =>
      expect(cloud.forkLegacy).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'LEGACY', name: 'Old road' }),
        'legacy-dm'
      )
    );
    expect(screen.getByText('B1B2C3D4E5F6')).toBeVisible();
    expect(
      screen.getByText(/legacy campaign LEGACY was not changed/i)
    ).toBeVisible();
    expect(
      screen.getByText(/invitations are not part of this slice/i)
    ).toBeVisible();
  });
});
