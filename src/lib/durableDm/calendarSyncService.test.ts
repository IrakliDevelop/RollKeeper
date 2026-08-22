import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { IndexedDbCalendarRepository } from '@/lib/indexeddb/calendarRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
} from '@/lib/indexeddb/localDatabase';

import { CalendarSyncService } from './calendarSyncService';

const mutation = {
  namespace: 'user:account-a' as const,
  campaignId: 'campaign-a',
  legacyId: 'AAA111',
  cutoverEpoch: 1,
  operation: 'replace' as const,
  payload: { config: {} as never, currentTime: 0, startTime: 0, events: [] },
  schemaVersion: 1,
  localRevision: 1,
  baseServerVersion: 1,
  contentFingerprint: 'a'.repeat(64),
  updatedAt: 'now',
};

describe('CalendarSyncService', () => {
  afterEach(() => deleteRollkeeperDatabaseForTests(indexedDB));

  it('does zero repository or network work while disabled', async () => {
    const repository = { commit: vi.fn() };
    const gateway = { put: vi.fn() };
    const service = new CalendarSyncService({
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
    const failed = new CalendarSyncService({
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

    const missing = new CalendarSyncService({
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

  it('reports cloud saved separately from player-view pending', async () => {
    const database = await openRollkeeperDatabase();
    const repository = new IndexedDbCalendarRepository(database, {
      randomId: () => 'mutation',
    });
    const service = new CalendarSyncService({
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
    const repository = new IndexedDbCalendarRepository(database, {
      randomId: () => `mutation-${++mutationId}`,
    });
    const offline = new CalendarSyncService({
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
    const conflict = new CalendarSyncService({
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
    const repository = new IndexedDbCalendarRepository(database, {
      randomId: () => 'auth-mutation',
    });
    const error = Object.assign(new Error('expired'), { status: 401 });
    const service = new CalendarSyncService({
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
