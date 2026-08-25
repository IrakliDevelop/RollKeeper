import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  IndexedDbCampaignSettingsRepository,
  type CampaignSettingsOutboxEntry,
} from '@/lib/indexeddb/campaignSettingsRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
} from '@/lib/indexeddb/localDatabase';

import { changedOnAnotherBrowserMessage } from './familyConflictMessage';
import { CampaignSettingsHttpGateway } from './campaignSettingsHttpGateway';
import { CampaignSettingsSyncService } from './campaignSettingsSyncService';

const mutation = {
  namespace: 'user:account-a' as const,
  campaignId: 'campaign-a',
  legacyId: 'AAA111',
  cutoverEpoch: 1,
  operation: 'replace' as const,
  payload: { stackableInspiration: true },
  schemaVersion: 1,
  localRevision: 1,
  baseServerVersion: 1,
  contentFingerprint: 'a'.repeat(64),
  updatedAt: 'now',
};

describe('CampaignSettingsSyncService', () => {
  afterEach(() => deleteRollkeeperDatabaseForTests(indexedDB));

  it('does zero repository or network work while disabled', async () => {
    const repository = { commit: vi.fn() };
    const gateway = { put: vi.fn() };
    const service = new CampaignSettingsSyncService({
      enabled: false,
      repository: repository as never,
      gateway,
    });
    await expect(service.commit(mutation)).resolves.toEqual({
      status: 'disabled',
    });
    expect(repository.commit).not.toHaveBeenCalled();
    expect(gateway.put).not.toHaveBeenCalled();
  });

  it('reports cloud saved separately from player-view pending', async () => {
    const database = await openRollkeeperDatabase();
    const repository = new IndexedDbCampaignSettingsRepository(database, {
      randomId: () => 'mutation',
    });
    const service = new CampaignSettingsSyncService({
      enabled: true,
      repository,
      gateway: {
        put: vi.fn().mockResolvedValue({
          serverVersion: 2,
          cutoverEpoch: 1,
          payloadFingerprint: 'a'.repeat(64),
          cloudSaved: true,
          playerView: 'pending',
        }),
      },
    });
    await expect(service.commit(mutation)).resolves.toEqual({
      status: 'cloud-saved',
      playerView: 'pending',
      serverVersion: 2,
    });
    await expect(
      repository.listOutbox('user:account-a', 'campaign-a')
    ).resolves.toEqual([
      expect.objectContaining({
        mutationId: 'mutation',
        state: 'acknowledged',
      }),
    ]);
    database.close();
  });

  it('keeps response-loss/offline work durable and marks CAS conflicts without choosing a winner', async () => {
    const database = await openRollkeeperDatabase();
    let mutationId = 0;
    const repository = new IndexedDbCampaignSettingsRepository(database, {
      randomId: () => `mutation-${++mutationId}`,
    });
    const offline = new CampaignSettingsSyncService({
      enabled: true,
      repository,
      gateway: { put: vi.fn().mockRejectedValue(new Error('response lost')) },
    });
    await expect(offline.commit(mutation)).resolves.toEqual({
      status: 'queued',
      reason: 'offline',
    });
    expect(await repository.listOutbox('user:account-a', 'campaign-a')).toEqual(
      [expect.objectContaining({ mutationId: 'mutation-1', state: 'retry' })]
    );

    await repository.updateWork('mutation-1', {
      state: 'queued',
      nextAttemptAt: 0,
    });
    const conflictError = Object.assign(new Error('conflict'), { status: 409 });
    const conflict = new CampaignSettingsSyncService({
      enabled: true,
      repository,
      gateway: { put: vi.fn().mockRejectedValue(conflictError) },
    });
    await expect(
      conflict.flush('user:account-a', 'campaign-a')
    ).resolves.toEqual({ status: 'conflict' });
    expect(await repository.listOutbox('user:account-a', 'campaign-a')).toEqual(
      [expect.objectContaining({ mutationId: 'mutation-1', state: 'conflict' })]
    );
    database.close();
  });
});

describe('CampaignSettingsHttpGateway', () => {
  const entry: CampaignSettingsOutboxEntry = {
    ...mutation,
    family: 'campaign_settings',
    mutationId: 'mutation-1',
    state: 'inflight',
    attemptCount: 1,
    nextAttemptAt: 0,
    inflightAt: null,
    lastError: null,
  };

  afterEach(() => vi.unstubAllGlobals());

  it('posts the outbox entry to the campaign settings sync route', async () => {
    const acknowledgement = {
      serverVersion: 3,
      cutoverEpoch: 1,
      payloadFingerprint: 'a'.repeat(64),
      cloudSaved: true,
      playerView: 'not-applicable',
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => acknowledgement,
    });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(new CampaignSettingsHttpGateway().put(entry)).resolves.toEqual(
      acknowledgement
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/campaign-settings');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'x-rollkeeper-csrf': '1',
    });
    expect(JSON.parse(init.body)).toEqual({
      action: 'put',
      mutationId: 'mutation-1',
      campaignId: 'campaign-a',
      expectedEpoch: 1,
      legacyId: 'AAA111',
      operation: 'replace',
      expectedServerVersion: 1,
      schemaVersion: 1,
      payload: mutation.payload,
      payloadFingerprint: 'a'.repeat(64),
    });
  });

  it('surfaces conflict and failure statuses on the thrown error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 409, json: async () => ({}) })
    );
    await expect(
      new CampaignSettingsHttpGateway().put(entry)
    ).rejects.toMatchObject({
      message: changedOnAnotherBrowserMessage('Campaign settings'),
      status: 409,
    });

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    );
    await expect(
      new CampaignSettingsHttpGateway().put(entry)
    ).rejects.toMatchObject({
      message: 'Campaign settings cloud request failed.',
      status: 503,
    });
  });
});
