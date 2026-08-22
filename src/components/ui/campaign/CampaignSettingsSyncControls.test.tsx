import 'fake-indexeddb/auto';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as campaignSettingsFamily from '@/lib/durableDm/campaignSettingsFamily';
import { writeCampaignSettingsProjectionAuthority } from '@/lib/durableDm/campaignSettingsLegacyProjection';
import * as campaignSettingsAuthority from '@/lib/indexeddb/campaignSettingsAuthority';
import { IndexedDbCampaignSettingsRepository } from '@/lib/indexeddb/campaignSettingsRepository';
import * as localDatabase from '@/lib/indexeddb/localDatabase';
import * as browserDmWorkspace from '@/lib/supabase/browserDmWorkspace';
import * as supabaseBrowser from '@/lib/supabase/browser';
import { CampaignSettingsSyncControls } from './CampaignSettingsSyncControls';

describe('CampaignSettingsSyncControls default-off contract', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('renders nothing and performs no storage, IndexedDB, cookie, or network work', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cookieBefore = document.cookie;
    const { container } = render(
      <CampaignSettingsSyncControls
        campaign={{
          code: 'SYNTH1',
          name: 'Synthetic canary',
          createdAt: 'now',
        }}
      />
    );
    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByText(/campaign settings cloud canary/i)
    ).not.toBeInTheDocument();
    await Promise.resolve();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);
  });

  it('keeps an unselected discovered family out of IndexedDB', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    const workspace = {
      namespace: 'user:11111111-1111-4111-8111-111111111111' as const,
      localId: 'legacy:SYNTH1',
      legacyId: 'SYNTH1',
      name: 'Synthetic canary',
      creationKind: 'import_fork' as const,
      sourceFingerprint: 'source',
      createdAt: 'created',
      family: 'workspace_identity' as const,
      cloudId: '22222222-2222-4222-8222-222222222222',
      displayCode: 'A1B2C3D4E5F6',
      membershipAuthority: 'legacy' as const,
      familyAuthorities: 'legacy' as const,
      liveRuntimeAuthority: 'redis_relay' as const,
      acknowledgedAt: 'acknowledged',
    };
    vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockResolvedValue({
      accountId: '11111111-1111-4111-8111-111111111111',
      accountLabel: 'synthetic@example.test',
      list: vi.fn().mockResolvedValue([]),
      discover: vi.fn().mockResolvedValue([workspace]),
      remember: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      forkLegacy: vi.fn(),
      close: vi.fn(),
    });
    const open = vi
      .spyOn(localDatabase, 'openRollkeeperDatabase')
      .mockRejectedValue(
        new Error('unselected family must not open IndexedDB')
      );

    render(
      <CampaignSettingsSyncControls
        campaign={{
          code: 'SYNTH1',
          name: 'Synthetic canary',
          createdAt: 'now',
        }}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Find owner workspaces' })
    );
    await screen.findByRole('button', { name: /Select Synthetic canary/ });
    fireEvent.click(
      screen.getByRole('button', { name: /Select Synthetic canary/ })
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Preview exact manifest' })
      ).toBeVisible()
    );
    expect(open).not.toHaveBeenCalled();
  });

  it('restores an initialized Postgres workspace and its owner controls after reload', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    const accountId = '11111111-1111-4111-8111-111111111111';
    const campaignId = '22222222-2222-4222-8222-222222222222';
    writeCampaignSettingsProjectionAuthority(localStorage, 'SYNTH1', {
      version: 1,
      authority: 'postgres',
      epoch: 1,
      campaignId,
      namespace: `user:${accountId}`,
    });

    const close = vi.fn();
    const workspace = {
      namespace: `user:${accountId}` as const,
      localId: 'legacy:SYNTH1',
      name: 'Synthetic canary',
      creationKind: 'import_fork' as const,
      sourceFingerprint: 'source',
      createdAt: 'created',
      family: 'workspace_identity' as const,
      legacyId: 'SYNTH1',
      cloudId: campaignId,
      displayCode: 'SYNTHETIC',
      membershipAuthority: 'legacy' as const,
      familyAuthorities: 'legacy' as const,
      liveRuntimeAuthority: 'redis_relay' as const,
      acknowledgedAt: 'acknowledged',
    };
    const restoredContext = {
      accountId,
      accountLabel: 'synthetic@example.test',
      list: vi.fn().mockResolvedValue([workspace]),
      discover: vi.fn().mockResolvedValue([workspace]),
      remember: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      forkLegacy: vi.fn(),
      close,
    };
    vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockResolvedValue(
      restoredContext
    );
    vi.spyOn(supabaseBrowser, 'createSupabaseBrowserClient').mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: accountId } } },
        }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    } as never);
    vi.spyOn(localDatabase, 'openRollkeeperDatabase').mockResolvedValue({
      close: vi.fn(),
    } as never);
    vi.spyOn(
      campaignSettingsAuthority,
      'readCampaignSettingsAuthority'
    ).mockResolvedValue({
      authority: 'postgres',
      namespace: `user:${accountId}`,
      campaignId,
      family: 'campaign_settings',
      generation: 'generation-1',
      epoch: 1,
      committedAt: 'committed',
    });
    vi.spyOn(
      IndexedDbCampaignSettingsRepository.prototype,
      'getDocument'
    ).mockResolvedValue({
      namespace: `user:${accountId}`,
      campaignId,
      legacyId: 'SYNTH1',
      family: 'campaign_settings',
      cutoverEpoch: 1,
      operation: 'create',
      payload: { stackableInspiration: true },
      schemaVersion: 1,
      localRevision: 1,
      baseServerVersion: 1,
      contentFingerprint: 'fingerprint',
      updatedAt: 'updated',
      deletedAt: null,
    });
    vi.spyOn(
      campaignSettingsFamily,
      'fingerprintCampaignSettingsPayload'
    ).mockResolvedValue('fingerprint');

    render(
      <CampaignSettingsSyncControls
        campaign={{
          code: 'SYNTH1',
          name: 'Synthetic canary',
          createdAt: 'now',
        }}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Version history' })
      ).toBeVisible()
    );
    expect(
      screen.queryByRole('button', { name: 'Find owner workspaces' })
    ).not.toBeInTheDocument();
    expect(restoredContext.list).toHaveBeenCalledTimes(1);
  });

  it('offers an explicit exact-version hydration after an enrolled device previews newer cloud state', async () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    const accountId = '11111111-1111-4111-8111-111111111111';
    const campaignId = '22222222-2222-4222-8222-222222222222';
    const workspace = {
      namespace: `user:${accountId}` as const,
      localId: 'legacy:SYNTH1',
      legacyId: 'SYNTH1',
      name: 'Synthetic canary',
      creationKind: 'import_fork' as const,
      sourceFingerprint: 'source',
      createdAt: 'created',
      family: 'workspace_identity' as const,
      cloudId: campaignId,
      displayCode: 'A1B2C3D4E5F6',
      membershipAuthority: 'legacy' as const,
      familyAuthorities: 'legacy' as const,
      liveRuntimeAuthority: 'redis_relay' as const,
      acknowledgedAt: 'acknowledged',
    };
    writeCampaignSettingsProjectionAuthority(localStorage, 'SYNTH1', {
      version: 1,
      authority: 'postgres',
      epoch: 1,
      campaignId,
      namespace: `user:${accountId}`,
    });
    vi.spyOn(browserDmWorkspace, 'createBrowserDmWorkspace').mockResolvedValue({
      accountId,
      accountLabel: 'synthetic@example.test',
      list: vi.fn().mockResolvedValue([workspace]),
      discover: vi.fn().mockResolvedValue([workspace]),
      remember: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      forkLegacy: vi.fn(),
      close: vi.fn(),
    });
    vi.spyOn(supabaseBrowser, 'createSupabaseBrowserClient').mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: accountId } } },
        }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    } as never);
    vi.spyOn(
      campaignSettingsAuthority,
      'readCampaignSettingsAuthority'
    ).mockResolvedValue({
      authority: 'postgres',
      namespace: `user:${accountId}`,
      campaignId,
      family: 'campaign_settings',
      generation: 'generation-1',
      epoch: 1,
      committedAt: 'committed',
    });
    vi.spyOn(
      IndexedDbCampaignSettingsRepository.prototype,
      'getDocument'
    ).mockResolvedValue({
      namespace: `user:${accountId}`,
      campaignId,
      legacyId: 'SYNTH1',
      family: 'campaign_settings',
      cutoverEpoch: 1,
      operation: 'replace',
      payload: { stackableInspiration: true },
      schemaVersion: 1,
      localRevision: 1,
      baseServerVersion: 1,
      contentFingerprint: 'a'.repeat(64),
      updatedAt: 'updated',
      deletedAt: null,
    });
    vi.spyOn(
      campaignSettingsFamily,
      'fingerprintCampaignSettingsPayload'
    ).mockResolvedValue('a'.repeat(64));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          authority: 'postgres',
          epoch: 1,
          serverVersion: 2,
          schemaVersion: 1,
          payload: { stackableInspiration: false },
          payloadFingerprint: 'b'.repeat(64),
          previewFingerprint: 'c'.repeat(64),
          tombstoned: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    render(
      <CampaignSettingsSyncControls
        campaign={{
          code: 'SYNTH1',
          name: 'Synthetic canary',
          createdAt: 'now',
        }}
      />
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Preview cloud enrollment' })
      ).toBeVisible()
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview cloud enrollment' })
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Apply exact cloud version' })
      ).toBeVisible()
    );
  });
});
