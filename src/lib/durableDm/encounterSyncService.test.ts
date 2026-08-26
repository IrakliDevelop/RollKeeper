import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
} from '@/lib/indexeddb/localDatabase';
import {
  IndexedDbEncounterRepository,
  type EncounterOutboxEntry,
} from '@/lib/indexeddb/encounterRepository';

import { changedOnAnotherBrowserMessage } from './familyConflictMessage';
import type { EncounterPayload } from './encounterFamily';
import { EncounterHttpGateway } from './encounterHttpGateway';
import { EncounterSyncService } from './encounterSyncService';

const payload: EncounterPayload = {
  name: 'Goblin Ambush',
  entities: [],
  currentTurn: 0,
  round: 1,
  isActive: false,
  sortOrder: 'initiative',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mutation = {
  namespace: 'user:account-a' as const,
  campaignId: 'campaign-a',
  legacyId: 'encounter-1',
  cutoverEpoch: 1,
  operation: 'replace' as const,
  payload,
  schemaVersion: 2,
  localRevision: 1,
  baseServerVersion: 1,
  contentFingerprint: 'a'.repeat(64),
  updatedAt: 'now',
};

describe('EncounterSyncService', () => {
  afterEach(() => deleteRollkeeperDatabaseForTests(indexedDB));

  it('does zero repository or network work while disabled', async () => {
    const repository = { commit: vi.fn() };
    const gateway = { put: vi.fn() };
    const service = new EncounterSyncService({
      enabled: false,
      repository: repository as never,
      gateway,
    });
    await expect(service.commit(mutation)).resolves.toEqual({
      status: 'disabled',
    });
    expect(repository.commit).not.toHaveBeenCalled();
    expect(gateway.put).not.toHaveBeenCalled();
    await expect(
      service.flush('user:account-a', 'campaign-a')
    ).resolves.toEqual({
      status: 'disabled',
    });
  });

  it('reports local failures, missing outbox rows, and an idle queue without network work', async () => {
    const gateway = { put: vi.fn() };
    const failed = new EncounterSyncService({
      enabled: true,
      repository: {
        commit: vi
          .fn()
          .mockResolvedValue({ saved: false, reason: 'tombstoned' }),
      } as never,
      gateway,
    });
    await expect(failed.commit(mutation)).resolves.toEqual({
      status: 'local-failed',
      reason: 'tombstoned',
    });

    const missing = new EncounterSyncService({
      enabled: true,
      repository: {
        commit: vi
          .fn()
          .mockResolvedValue({ saved: true, mutationId: 'missing' }),
        listOutbox: vi.fn().mockResolvedValue([]),
        nextRunnable: vi.fn().mockResolvedValue(null),
      } as never,
      gateway,
    });
    await expect(missing.commit(mutation)).resolves.toEqual({
      status: 'local-failed',
      reason: 'failed',
    });
    await expect(
      missing.flush('user:account-a', 'campaign-a')
    ).resolves.toEqual({
      status: 'idle',
    });
    expect(gateway.put).not.toHaveBeenCalled();
  });

  it('reports cloud saved with a not-applicable player view', async () => {
    const database = await openRollkeeperDatabase();
    const repository = new IndexedDbEncounterRepository(database, {
      randomId: () => 'mutation',
    });
    const service = new EncounterSyncService({
      enabled: true,
      repository,
      gateway: {
        put: vi.fn().mockResolvedValue({
          serverVersion: 2,
          cutoverEpoch: 1,
          payloadFingerprint: 'a'.repeat(64),
          cloudSaved: true,
          playerView: 'not-applicable',
        }),
      },
    });
    await expect(service.commit(mutation)).resolves.toEqual({
      status: 'cloud-saved',
      playerView: 'not-applicable',
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
    const repository = new IndexedDbEncounterRepository(database, {
      randomId: () => `mutation-${++mutationId}`,
    });
    const offline = new EncounterSyncService({
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
    const conflict = new EncounterSyncService({
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

  it('retains unauthorized work as auth-required for explicit retry', async () => {
    const database = await openRollkeeperDatabase();
    const repository = new IndexedDbEncounterRepository(database, {
      randomId: () => 'auth-mutation',
    });
    const error = Object.assign(new Error('expired'), { status: 401 });
    const service = new EncounterSyncService({
      enabled: true,
      repository,
      gateway: { put: vi.fn().mockRejectedValue(error) },
    });
    await expect(service.commit(mutation)).resolves.toEqual({
      status: 'queued',
      reason: 'auth-required',
    });
    await expect(
      repository.listOutbox('user:account-a', 'campaign-a')
    ).resolves.toEqual([
      expect.objectContaining({
        state: 'auth-required',
        lastError: 'auth-required',
      }),
    ]);
    database.close();
  });
});

describe('EncounterHttpGateway', () => {
  const entry: EncounterOutboxEntry = {
    ...mutation,
    family: 'encounter_definition',
    mutationId: 'mutation-1',
    state: 'inflight',
    attemptCount: 1,
    nextAttemptAt: 0,
    inflightAt: null,
    lastError: null,
  };

  afterEach(() => vi.unstubAllGlobals());

  it('posts the outbox entry to the encounter sync route', async () => {
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

    await expect(new EncounterHttpGateway().put(entry)).resolves.toEqual(
      acknowledgement
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/encounter-sync');
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
      legacyId: 'encounter-1',
      operation: 'replace',
      expectedServerVersion: 1,
      schemaVersion: 2,
      payload,
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
    await expect(new EncounterHttpGateway().put(entry)).rejects.toMatchObject({
      message: changedOnAnotherBrowserMessage('Encounters'),
      status: 409,
    });

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    );
    await expect(new EncounterHttpGateway().put(entry)).rejects.toMatchObject({
      message: 'Encounter cloud request failed.',
      status: 503,
    });
  });
});
