import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  IndexedDbAutomaticCharacterSyncRepository,
  type AutomaticCharacterMutation,
} from '@/lib/indexeddb/automaticCharacterSyncRepository';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
} from '@/lib/indexeddb/localDatabase';
import { PlayerBackupLockUnavailableError } from '@/lib/playerBackup/playerBackupRunFence';

import { CharacterCloudGatewayError } from './characterCloudGateway';
import { fingerprintCharacterPayload } from './characterCloudCodec';
import {
  AutomaticCharacterSyncWorker,
  type AutomaticCharacterSyncGateway,
  type AutomaticSyncDispatchGuard,
} from './automaticCharacterSyncWorker';

const NAMESPACE = 'user:account-a' as const;

function mutation(
  legacyId: string,
  overrides: Partial<AutomaticCharacterMutation> = {}
): AutomaticCharacterMutation {
  return {
    namespace: NAMESPACE,
    legacyId,
    cloudId: `cloud-${legacyId}`,
    operation: 'replace',
    payload: { id: legacyId, name: legacyId, fingerprint: `fp-${legacyId}` },
    schemaVersion: 1,
    localRevision: 1,
    baseServerVersion: 0,
    contentFingerprint: `fp-${legacyId}`,
    syncPolicy: 'on',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

function row(legacyId: string, serverVersion = 1) {
  return {
    id: `cloud-${legacyId}`,
    legacy_client_id: legacyId,
    name: legacyId,
    payload: { id: legacyId, name: legacyId, fingerprint: `fp-${legacyId}` },
    schema_version: 1,
    client_revision: 1,
    server_version: serverVersion,
    deleted_at: null,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
  };
}

function gateway(): AutomaticCharacterSyncGateway {
  return {
    put: vi.fn(async request => ({
      status: 'success' as const,
      characterId: request.cloudId,
      serverVersion: 1,
    })),
    archive: vi.fn(),
    fetch: vi.fn(async cloudId => row(cloudId.replace('cloud-', ''))),
    list: vi.fn(async () => []),
  };
}

describe('AutomaticCharacterSyncWorker', () => {
  let database: IDBDatabase;
  let repository: IndexedDbAutomaticCharacterSyncRepository;
  let sequence: number;

  beforeEach(async () => {
    database = await openRollkeeperDatabase();
    sequence = 0;
    repository = new IndexedDbAutomaticCharacterSyncRepository(database, {
      randomId: () => `mutation-${++sequence}`,
    });
  });

  afterEach(async () => {
    database.close();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  const worker = (
    cloud: AutomaticCharacterSyncGateway,
    featureEnabled = true,
    dispatchGuard?: AutomaticSyncDispatchGuard
  ) =>
    new AutomaticCharacterSyncWorker({
      namespace: NAMESPACE,
      featureEnabled,
      repository,
      gateway: cloud,
      ...(dispatchGuard ? { dispatchGuard } : {}),
      now: () => 10_000,
      random: () => 0,
      fingerprint: async payload =>
        String((payload as { fingerprint?: string }).fingerprint),
    });

  it('makes zero automatic cloud calls when the deployment flag is disabled or nothing is selected', async () => {
    const cloud = gateway();
    await repository.commit(mutation('selected'));

    await expect(worker(cloud, false).runOnce()).resolves.toBe('disabled');
    expect(cloud.put).not.toHaveBeenCalled();

    const otherDatabase = await openRollkeeperDatabase();
    const emptyRepository = new IndexedDbAutomaticCharacterSyncRepository(
      otherDatabase
    );
    const emptyWorker = new AutomaticCharacterSyncWorker({
      namespace: 'user:account-b',
      featureEnabled: true,
      repository: emptyRepository,
      gateway: cloud,
    });
    await expect(emptyWorker.runOnce()).resolves.toBe('idle');
    expect(cloud.put).not.toHaveBeenCalled();
  });

  it('retries a committed response loss with the same mutation id and validates the refetched row', async () => {
    const cloud = gateway();
    vi.mocked(cloud.put)
      .mockRejectedValueOnce(
        new CharacterCloudGatewayError('response lost', 'offline')
      )
      .mockResolvedValueOnce({
        status: 'success',
        characterId: 'cloud-response-loss',
        serverVersion: 1,
      });
    await repository.commit(mutation('response-loss'));
    const sync = worker(cloud);

    await expect(sync.runOnce()).resolves.toBe('offline');
    const retained = await repository.listOutbox(NAMESPACE);
    expect(retained).toEqual([
      expect.objectContaining({ mutationId: 'mutation-1', state: 'offline' }),
    ]);

    await sync.retryNow('response-loss');
    await expect(sync.runOnce()).resolves.toBe('synced');
    expect(cloud.put).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ mutationId: 'mutation-1' })
    );
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([]);
  });

  it('reclaims an intact inflight mutation on worker restart without replacing its identity', async () => {
    const cloud = gateway();
    await repository.commit(mutation('crashed-writer'));
    await repository.markInflight('mutation-1');

    await expect(worker(cloud).runOnce()).resolves.toBe('synced');
    expect(cloud.put).toHaveBeenCalledWith(
      expect.objectContaining({ mutationId: 'mutation-1' })
    );
  });

  it('durably pauses on auth expiry and resumes after reauthentication', async () => {
    const cloud = gateway();
    vi.mocked(cloud.put).mockRejectedValueOnce(
      new CharacterCloudGatewayError('expired', 'auth-required')
    );
    await repository.commit(mutation('auth'));
    const sync = worker(cloud);

    await expect(sync.runOnce()).resolves.toBe('auth-required');
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ state: 'auth-required' }),
    ]);

    await sync.resumeAfterAuthentication();
    await expect(sync.runOnce()).resolves.toBe('synced');
  });

  it('uses bounded retry timing and supports manual retry', async () => {
    const cloud = gateway();
    vi.mocked(cloud.put).mockRejectedValue(new Error('server unavailable'));
    await repository.commit(mutation('retry'));
    const sync = worker(cloud);

    await expect(sync.runOnce()).resolves.toBe('failed');
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({
        state: 'retry',
        attemptCount: 1,
        nextAttemptAt: 12_000,
      }),
    ]);
    await sync.retryNow('retry');
    await expect(
      repository.nextRunnable(NAMESPACE, 10_000)
    ).resolves.not.toBeNull();
  });

  it('pauses only the conflicted character and keeps unrelated work syncing', async () => {
    const cloud = gateway();
    vi.mocked(cloud.put).mockImplementation(async request =>
      request.legacyId === 'conflict'
        ? {
            status: 'conflict',
            characterId: request.cloudId,
            serverVersion: 2,
          }
        : {
            status: 'success',
            characterId: request.cloudId,
            serverVersion: 1,
          }
    );
    vi.mocked(cloud.fetch).mockImplementation(async cloudId =>
      cloudId === 'cloud-conflict'
        ? {
            ...row('conflict', 2),
            payload: {
              id: 'conflict',
              name: 'remote candidate',
              fingerprint: 'remote-fp',
            },
          }
        : row('other')
    );
    await repository.commit(mutation('conflict'));
    await repository.commit(mutation('other'));
    const sync = worker(cloud);

    await expect(sync.runOnce()).resolves.toBe('conflict');
    await expect(sync.runOnce()).resolves.toBe('synced');
    await expect(repository.listConflicts(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({
        legacyId: 'conflict',
        resolutionState: 'unresolved',
      }),
    ]);
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ legacyId: 'conflict', state: 'conflict' }),
    ]);
  });

  it('propagates deletes as tombstones and rejects identity or fingerprint mismatches', async () => {
    const cloud = gateway();
    vi.mocked(cloud.archive).mockResolvedValue({
      status: 'success',
      characterId: 'cloud-deleted',
      serverVersion: 2,
    });
    vi.mocked(cloud.fetch).mockResolvedValue({
      ...row('deleted', 2),
      deleted_at: '2026-02-01T00:01:00.000Z',
    });
    await repository.commit(mutation('deleted'));
    await repository.commit(
      mutation('deleted', {
        operation: 'delete',
        payload: null,
        localRevision: 2,
        baseServerVersion: 1,
        contentFingerprint: 'deleted',
      })
    );

    await expect(worker(cloud).runOnce()).resolves.toBe('synced');
    expect(cloud.archive).toHaveBeenCalledWith(
      expect.objectContaining({ mutationId: 'mutation-2' })
    );
  });

  it('adopts the authenticated owner+legacy canonical cloud id on another device first upload', async () => {
    const cloud = gateway();
    vi.mocked(cloud.put).mockResolvedValue({
      status: 'success',
      characterId: 'canonical-cloud-id',
      serverVersion: 1,
    });
    vi.mocked(cloud.fetch).mockResolvedValue({
      ...row('same-character'),
      id: 'canonical-cloud-id',
    });
    await repository.commit(mutation('same-character'));

    await expect(worker(cloud).runOnce()).resolves.toBe('synced');
    await expect(
      repository.getDocument(NAMESPACE, 'same-character')
    ).resolves.toMatchObject({
      cloudId: 'canonical-cloud-id',
      baseServerVersion: 1,
    });
  });

  it('preserves a resolvable canonical identity for a first-upload conflict on another device', async () => {
    const cloud = gateway();
    vi.mocked(cloud.put).mockResolvedValue({
      status: 'conflict',
      characterId: 'canonical-cloud-id',
      serverVersion: 2,
    });
    vi.mocked(cloud.fetch).mockResolvedValue({
      ...row('same-character', 2),
      id: 'canonical-cloud-id',
      payload: {
        id: 'same-character',
        name: 'remote candidate',
        fingerprint: 'remote-fp',
      },
    });
    await repository.commit(
      mutation('same-character', { cloudId: 'provisional-device-id' })
    );

    await expect(worker(cloud).runOnce()).resolves.toBe('conflict');
    await expect(repository.listConflicts(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({
        localCandidate: expect.objectContaining({
          cloudId: 'canonical-cloud-id',
          baseServerVersion: 0,
        }),
      }),
    ]);
  });

  it('never runs automatic cloud work in the guest namespace', async () => {
    const cloud = gateway();
    const guestWorker = new AutomaticCharacterSyncWorker({
      namespace: 'guest',
      featureEnabled: true,
      repository,
      gateway: cloud,
    });
    await expect(guestWorker.runOnce()).resolves.toBe('idle');
    expect(cloud.put).not.toHaveBeenCalled();
  });

  it('durably fails malformed work and missing refetched acknowledgements', async () => {
    const cloud = gateway();
    await repository.commit(mutation('no-cloud', { cloudId: undefined }));
    await expect(worker(cloud).runOnce()).resolves.toBe('failed');

    await repository.commit(mutation('no-payload', { payload: null }));
    await expect(worker(cloud).runOnce()).resolves.toBe('failed');

    await repository.commit(mutation('missing-refetch'));
    vi.mocked(cloud.fetch).mockResolvedValueOnce(null);
    await expect(worker(cloud).runOnce()).resolves.toBe('failed');
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          legacyId: 'missing-refetch',
          state: 'retry',
        }),
      ])
    );
  });

  it('rejects invalid acknowledgement identity, version, tombstone, and fingerprint metadata', async () => {
    const cases = [
      {
        id: 'identity',
        remote: { ...row('identity'), legacy_client_id: 'other' },
      },
      {
        id: 'version',
        remote: { ...row('version'), server_version: 0 },
      },
      {
        id: 'unexpected-tombstone',
        remote: {
          ...row('unexpected-tombstone'),
          deleted_at: '2026-02-02T00:00:00.000Z',
        },
      },
      {
        id: 'fingerprint',
        remote: {
          ...row('fingerprint'),
          payload: { id: 'fingerprint', name: 'changed', fingerprint: 'other' },
        },
      },
      {
        id: 'schema',
        remote: { ...row('schema'), schema_version: 2 },
      },
      {
        id: 'client-revision',
        remote: { ...row('client-revision'), client_revision: 2 },
      },
    ];
    for (const candidate of cases) {
      const cloud = gateway();
      await repository.commit(mutation(candidate.id));
      vi.mocked(cloud.fetch).mockResolvedValue(candidate.remote);
      if (candidate.id === 'version') {
        vi.mocked(cloud.put).mockResolvedValue({
          status: 'success',
          characterId: 'cloud-version',
          serverVersion: 0,
        });
      }
      await expect(worker(cloud).runOnce()).resolves.toBe('failed');
    }
  });

  it('rejects a delete acknowledgement that does not contain a cloud tombstone', async () => {
    const cloud = gateway();
    vi.mocked(cloud.archive).mockResolvedValue({
      status: 'success',
      characterId: 'cloud-delete-invalid',
      serverVersion: 2,
    });
    vi.mocked(cloud.fetch).mockResolvedValue(row('delete-invalid', 2));
    await repository.commit(
      mutation('delete-invalid', {
        operation: 'delete',
        payload: null,
        baseServerVersion: 1,
      })
    );
    await expect(worker(cloud).runOnce()).resolves.toBe('failed');
  });

  it('holds and pauses work when the dispatch guard refuses, without any gateway call', async () => {
    const cloud = gateway();
    await repository.commit(mutation('refused'));
    const guard: AutomaticSyncDispatchGuard = {
      around: (_entry, task) => task(),
      authorize: async () => ({ hold: 'preference-off' }),
    };

    await expect(worker(cloud, true, guard).runOnce()).resolves.toBe('held');

    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({
        legacyId: 'refused',
        state: 'paused',
        pausedFromState: 'queued',
      }),
    ]);
    expect(cloud.put).not.toHaveBeenCalled();
    expect(cloud.fetch).not.toHaveBeenCalled();
  });

  it('pauses a reclaimed inflight mutation the dispatch guard refuses', async () => {
    const cloud = gateway();
    await repository.commit(mutation('reclaimed'));
    await repository.markInflight('mutation-1');
    const guard: AutomaticSyncDispatchGuard = {
      around: (_entry, task) => task(),
      authorize: async () => ({ hold: 'preference-off' }),
    };
    const sync = worker(cloud, true, guard);

    await expect(sync.runOnce()).resolves.toBe('held');

    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({
        legacyId: 'reclaimed',
        state: 'paused',
        inflightAt: null,
      }),
    ]);
    // Held work must stop being runnable, or the coordinator drain spins.
    await expect(sync.runOnce()).resolves.toBe('idle');
    expect(cloud.put).not.toHaveBeenCalled();
    expect(cloud.fetch).not.toHaveBeenCalled();
  });

  it('pauses only stale-origin work and keeps current work of the same character runnable', async () => {
    const cloud = gateway();
    await repository.commit(
      mutation('resumed', { originPlayerBackupRunId: 'run-old' })
    );
    await repository.updateWork('mutation-1', {
      state: 'retry',
      nextAttemptAt: 0,
      lastError: 'stale attempt',
    });
    await repository.commit(
      mutation('resumed', { originPlayerBackupRunId: 'run-new' })
    );
    const guard: AutomaticSyncDispatchGuard = {
      around: (_entry, task) => task(),
      authorize: async entry =>
        entry.originPlayerBackupRunId === 'run-new'
          ? 'dispatch'
          : { hold: 'stale-origin' },
    };
    const sync = worker(cloud, true, guard);

    await expect(sync.runOnce()).resolves.toBe('held');

    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ mutationId: 'mutation-1', state: 'paused' }),
      expect.objectContaining({ mutationId: 'mutation-2', state: 'queued' }),
    ]);
    expect(cloud.put).not.toHaveBeenCalled();

    await expect(sync.runOnce()).resolves.toBe('synced');

    expect(cloud.put).toHaveBeenCalledWith(
      expect.objectContaining({ mutationId: 'mutation-2' })
    );
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ mutationId: 'mutation-1', state: 'paused' }),
    ]);
  });

  it('runs put, refetch and acknowledgement inside the guard boundary', async () => {
    const events: string[] = [];
    const cloud = gateway();
    vi.mocked(cloud.put).mockImplementation(async request => {
      events.push('put');
      return {
        status: 'success' as const,
        characterId: request.cloudId,
        serverVersion: 1,
      };
    });
    vi.mocked(cloud.fetch).mockImplementation(async cloudId => {
      events.push('fetch');
      return row(cloudId.replace('cloud-', ''));
    });
    await repository.commit(mutation('guarded'));
    const guard: AutomaticSyncDispatchGuard = {
      around: async (_entry, task) => {
        events.push('enter');
        try {
          return await task();
        } finally {
          const retained = await repository.listOutbox(NAMESPACE);
          events.push(retained.length === 0 ? 'acknowledged' : 'retained');
          events.push('exit');
        }
      },
      authorize: async () => {
        events.push('authorize');
        return 'dispatch';
      },
    };

    await expect(worker(cloud, true, guard).runOnce()).resolves.toBe('synced');

    expect(events).toEqual([
      'enter',
      'authorize',
      'put',
      'fetch',
      'acknowledged',
      'exit',
    ]);
  });

  it('turns a guard failure into retained retry work', async () => {
    const cloud = gateway();
    await repository.commit(mutation('lock-lost'));
    const guard: AutomaticSyncDispatchGuard = {
      around: async () => {
        throw new PlayerBackupLockUnavailableError();
      },
      authorize: async () => 'dispatch',
    };

    await expect(worker(cloud, true, guard).runOnce()).resolves.toBe('failed');

    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({
        legacyId: 'lock-lost',
        state: 'retry',
        attemptCount: 1,
        lastError: 'The exclusive player backup lock is unavailable',
      }),
    ]);
    expect(cloud.put).not.toHaveBeenCalled();
  });

  it('never holds work without a dispatch guard', async () => {
    const cloud = gateway();
    await repository.commit(mutation('unguarded'));
    const sync = worker(cloud);

    const results = [await sync.runOnce(), await sync.runOnce()];

    expect(results).toEqual(['synced', 'idle']);
    expect(results).not.toContain('held');
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([]);
  });

  it('uses safe default clocks, jitter, fingerprinting, and payload-name fallback', async () => {
    const cloud = gateway();
    const payload = { id: 'defaults', fingerprint: 'not-used-as-the-digest' };
    const contentFingerprint = await fingerprintCharacterPayload(payload);
    await repository.commit(
      mutation('defaults', { payload, contentFingerprint })
    );
    vi.mocked(cloud.fetch).mockResolvedValue({
      ...row('defaults'),
      name: 'defaults',
      payload,
    });
    const defaults = new AutomaticCharacterSyncWorker({
      namespace: NAMESPACE,
      featureEnabled: true,
      repository,
      gateway: cloud,
    });
    await expect(defaults.runOnce()).resolves.toBe('synced');
    expect(cloud.put).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'defaults' })
    );
  });
});
