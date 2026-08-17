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

import type { AutomaticCharacterSyncGateway } from './automaticCharacterSyncWorker';
import { AutomaticCharacterSyncPuller } from './automaticCharacterSyncPuller';

const NAMESPACE = 'user:account-a' as const;

function mutation(legacyId = 'character-a'): AutomaticCharacterMutation {
  return {
    namespace: NAMESPACE,
    legacyId,
    cloudId: `cloud-${legacyId}`,
    operation: 'replace',
    payload: { id: legacyId, name: 'Local', revision: 1 },
    schemaVersion: 1,
    localRevision: 1,
    baseServerVersion: 1,
    contentFingerprint: 'local-fingerprint',
    syncPolicy: 'on',
    updatedAt: '2026-02-01T00:00:00.000Z',
  };
}

function remote(schemaVersion = 1, deletedAt: string | null = null) {
  return {
    id: 'cloud-character-a',
    legacy_client_id: 'character-a',
    name: 'Cloud',
    payload: { id: 'character-a', name: 'Cloud', revision: 2 },
    schema_version: schemaVersion,
    client_revision: 2,
    server_version: 2,
    deleted_at: deletedAt,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-02-02T00:00:00.000Z',
  };
}

describe('AutomaticCharacterSyncPuller', () => {
  let database: IDBDatabase;
  let repository: IndexedDbAutomaticCharacterSyncRepository;
  let gateway: AutomaticCharacterSyncGateway;

  beforeEach(async () => {
    database = await openRollkeeperDatabase();
    repository = new IndexedDbAutomaticCharacterSyncRepository(database, {
      randomId: () => 'mutation-a',
    });
    gateway = {
      put: vi.fn(),
      archive: vi.fn(),
      fetch: vi.fn(),
      list: vi.fn(async () => []),
    };
  });

  afterEach(async () => {
    database.close();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  it('makes zero cloud calls for an account with no participating documents', async () => {
    const puller = new AutomaticCharacterSyncPuller({
      namespace: NAMESPACE,
      repository,
      gateway,
    });
    await expect(puller.pull()).resolves.toBe('idle');
    expect(gateway.list).not.toHaveBeenCalled();
  });

  it('never pulls automatic character data for the guest namespace', async () => {
    const puller = new AutomaticCharacterSyncPuller({
      namespace: 'guest',
      repository,
      gateway,
    });
    await expect(puller.pull()).resolves.toBe('idle');
    expect(gateway.list).not.toHaveBeenCalled();
  });

  it('adopts a validated uncontested newer cloud version', async () => {
    await repository.commit(mutation());
    const [queued] = await repository.listOutbox(NAMESPACE);
    await repository.acknowledge(queued, 'cloud-character-a', 1);
    vi.mocked(gateway.list).mockResolvedValue([remote()]);

    const puller = new AutomaticCharacterSyncPuller({
      namespace: NAMESPACE,
      repository,
      gateway,
    });
    await expect(puller.pull()).resolves.toBe('updated');
    await expect(
      repository.getDocument(NAMESPACE, 'character-a')
    ).resolves.toMatchObject({
      payload: expect.objectContaining({ name: 'Cloud' }),
      baseServerVersion: 2,
    });
  });

  it('preserves independent-device divergence and keeps local active', async () => {
    await repository.commit(mutation());
    vi.mocked(gateway.list).mockResolvedValue([remote()]);
    const puller = new AutomaticCharacterSyncPuller({
      namespace: NAMESPACE,
      repository,
      gateway,
    });

    await expect(puller.pull()).resolves.toBe('conflict');
    await expect(
      repository.getDocument(NAMESPACE, 'character-a')
    ).resolves.toMatchObject({
      payload: expect.objectContaining({ name: 'Local' }),
    });
    await expect(repository.listConflicts(NAMESPACE)).resolves.toHaveLength(1);
  });

  it('quarantines future schema and propagates a validated cloud tombstone', async () => {
    await repository.commit(mutation());
    const [queued] = await repository.listOutbox(NAMESPACE);
    await repository.acknowledge(queued, 'cloud-character-a', 1);
    const puller = new AutomaticCharacterSyncPuller({
      namespace: NAMESPACE,
      repository,
      gateway,
    });

    vi.mocked(gateway.list).mockResolvedValue([remote(99)]);
    await expect(puller.pull()).resolves.toBe('quarantined');
    await expect(
      repository.getDocument(NAMESPACE, 'character-a')
    ).resolves.toMatchObject({
      payload: expect.objectContaining({ name: 'Local' }),
    });

    vi.mocked(gateway.list).mockResolvedValue([
      remote(1, '2026-02-02T00:01:00.000Z'),
    ]);
    await expect(puller.pull()).resolves.toBe('updated');
    await expect(
      repository.getTombstone(NAMESPACE, 'character-a')
    ).resolves.toMatchObject({
      beforeImage: expect.objectContaining({
        payload: expect.objectContaining({ name: 'Local' }),
      }),
    });
  });

  it('ignores absent and stale cloud rows and quarantines identity mismatches', async () => {
    await repository.commit(mutation());
    const [queued] = await repository.listOutbox(NAMESPACE);
    await repository.acknowledge(queued, 'cloud-character-a', 1);
    const puller = new AutomaticCharacterSyncPuller({
      namespace: NAMESPACE,
      repository,
      gateway,
      now: () => '2026-02-03T00:00:00.000Z',
    });

    vi.mocked(gateway.list).mockResolvedValue([]);
    await expect(puller.pull()).resolves.toBe('idle');
    vi.mocked(gateway.list).mockResolvedValue([
      { ...remote(), server_version: 1 },
    ]);
    await expect(puller.pull()).resolves.toBe('idle');
    vi.mocked(gateway.list).mockResolvedValue([
      { ...remote(), legacy_client_id: 'character-other' },
    ]);
    await expect(puller.pull()).resolves.toBe('quarantined');
    await expect(repository.listQuarantine(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({
        legacyId: 'character-a',
        reason: expect.stringMatching(/identity/i),
      }),
    ]);
  });

  it.each([
    {
      label: 'payload identity',
      candidate: {
        ...remote(),
        payload: {
          id: 'character-other',
          name: 'Unsafe',
          characterData: { id: 'character-other', revision: 2 },
        },
      },
    },
    {
      label: 'negative client revision',
      candidate: { ...remote(), client_revision: -1 },
    },
    {
      label: 'non-integer server version',
      candidate: { ...remote(), server_version: 2.5 },
    },
    {
      label: 'non-positive stale server version',
      candidate: { ...remote(), server_version: 0 },
    },
  ])(
    'quarantines unsafe $label metadata without activation',
    async ({ candidate }) => {
      await repository.commit(mutation());
      const [queued] = await repository.listOutbox(NAMESPACE);
      await repository.acknowledge(queued, 'cloud-character-a', 1);
      vi.mocked(gateway.list).mockResolvedValue([candidate]);
      const puller = new AutomaticCharacterSyncPuller({
        namespace: NAMESPACE,
        repository,
        gateway,
      });
      await expect(puller.pull()).resolves.toBe('quarantined');
      await expect(
        repository.getDocument(NAMESPACE, 'character-a')
      ).resolves.toMatchObject({
        payload: expect.objectContaining({ name: 'Local' }),
        baseServerVersion: 1,
      });
    }
  );

  it('quarantines an unparseable cloud payload instead of aborting every character pull', async () => {
    await repository.commit(mutation());
    const [queued] = await repository.listOutbox(NAMESPACE);
    await repository.acknowledge(queued, 'cloud-character-a', 1);
    const cyclic: Record<string, unknown> = { id: 'character-a' };
    cyclic.self = cyclic;
    vi.mocked(gateway.list).mockResolvedValue([
      { ...remote(), payload: cyclic },
    ]);
    const puller = new AutomaticCharacterSyncPuller({
      namespace: NAMESPACE,
      repository,
      gateway,
    });
    await expect(puller.pull()).resolves.toBe('quarantined');
    await expect(repository.listQuarantine(NAMESPACE)).resolves.toHaveLength(1);
  });
});
