import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CharacterCloudRow } from '@/lib/supabase/characterCloudCodec';

import {
  IndexedDbAutomaticCharacterSyncRepository,
  type AutomaticCharacterMutation,
} from '../automaticCharacterSyncRepository';
import {
  AutomaticCharacterConflictService,
  type AutomaticConflictResolution,
} from '../automaticCharacterConflictService';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '../localDatabase';

const NAMESPACE = 'user:account-a' as const;

function mutation(): AutomaticCharacterMutation {
  return {
    namespace: NAMESPACE,
    legacyId: 'character-a',
    cloudId: 'cloud-a',
    operation: 'replace',
    payload: { id: 'character-a', name: 'Local candidate', revision: 2 },
    schemaVersion: 1,
    localRevision: 2,
    baseServerVersion: 1,
    contentFingerprint: 'local-fingerprint',
    syncPolicy: 'on',
    updatedAt: '2026-02-01T00:00:00.000Z',
  };
}

function cloudRow(schemaVersion = 1): CharacterCloudRow {
  return {
    id: 'cloud-a',
    legacy_client_id: 'character-a',
    name: 'Cloud candidate',
    payload: { id: 'character-a', name: 'Cloud candidate', revision: 3 },
    schema_version: schemaVersion,
    client_revision: 3,
    server_version: 2,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
  };
}

describe('AutomaticCharacterConflictService', () => {
  let database: IDBDatabase;
  let repository: IndexedDbAutomaticCharacterSyncRepository;
  let service: AutomaticCharacterConflictService;
  let sequence: number;

  beforeEach(async () => {
    database = await openRollkeeperDatabase();
    sequence = 0;
    repository = new IndexedDbAutomaticCharacterSyncRepository(database, {
      randomId: () => `mutation-${++sequence}`,
    });
    service = new AutomaticCharacterConflictService(database, {
      randomId: () => `resolution-${++sequence}`,
      now: () => '2026-02-02T00:00:00.000Z',
    });
  });

  afterEach(async () => {
    database.close();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  async function seedConflict(remote = cloudRow()) {
    await repository.commit(mutation());
    const [work] = await repository.listOutbox(NAMESPACE);
    await repository.preserveConflict(work, remote, '2026-02-01T00:01:00.000Z');
    return `automatic-sync:${work.mutationId}`;
  }

  it.each<AutomaticConflictResolution>(['keep-mine', 'use-cloud'])(
    'snapshots the discarded candidate before %s',
    async resolution => {
      const conflictId = await seedConflict();
      await service.resolve(conflictId, resolution);

      await expect(service.listSnapshots(conflictId)).resolves.toHaveLength(1);
      await expect(service.getConflict(conflictId)).resolves.toMatchObject({
        resolutionState: 'resolved',
        resolution,
      });
      const document = await repository.getDocument(NAMESPACE, 'character-a');
      expect(document?.payload).toMatchObject({
        name:
          resolution === 'keep-mine' ? 'Local candidate' : 'Cloud candidate',
      });
    }
  );

  it('keeps both by retaining local active, creating an unsynced cloud copy, and resuming local push', async () => {
    const conflictId = await seedConflict();
    await service.resolve(conflictId, 'keep-both', {
      copyLegacyId: 'character-cloud-copy',
    });

    await expect(
      repository.getDocument(NAMESPACE, 'character-a')
    ).resolves.toMatchObject({
      payload: expect.objectContaining({ name: 'Local candidate' }),
    });
    const copy = await repository.getDocument(
      NAMESPACE,
      'character-cloud-copy'
    );
    expect(copy).toMatchObject({
      syncPolicy: 'off',
      payload: expect.objectContaining({ name: 'Cloud candidate' }),
    });
    expect(copy?.cloudId).toBeUndefined();
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ legacyId: 'character-a', state: 'queued' }),
    ]);
  });

  it('quarantines and exports malformed or future-schema cloud candidates without activation', async () => {
    const conflictId = await seedConflict(cloudRow(99));
    await expect(service.resolve(conflictId, 'use-cloud')).resolves.toBe(
      'quarantined'
    );

    await expect(
      repository.getDocument(NAMESPACE, 'character-a')
    ).resolves.toMatchObject({
      payload: expect.objectContaining({ name: 'Local candidate' }),
    });
    const exported = await service.exportQuarantine(conflictId);
    expect(exported).toMatchObject({
      format: 'rollkeeper-automatic-sync-quarantine',
      formatVersion: 1,
      reason: expect.stringMatching(/future schema/i),
    });
  });

  it('rejects missing, unsafe, and incomplete conflict resolutions without discarding candidates', async () => {
    await expect(service.resolve('missing', 'keep-mine')).rejects.toThrow(
      /not found/i
    );
    await expect(service.exportQuarantine('missing')).rejects.toThrow(
      /not found/i
    );

    const conflictId = await seedConflict({ ...cloudRow(), id: 'cloud-other' });
    await expect(service.resolve(conflictId, 'keep-mine')).rejects.toThrow(
      /identity is unsafe/i
    );
    await expect(service.listSnapshots(conflictId)).resolves.toEqual([]);
  });

  it('requires an explicit new ID for Keep both and leaves the unresolved work intact on abort', async () => {
    const conflictId = await seedConflict();
    await expect(service.resolve(conflictId, 'keep-both')).rejects.toThrow(
      /new local character ID/i
    );
    await expect(service.getConflict(conflictId)).resolves.toMatchObject({
      resolutionState: 'unresolved',
    });
    await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
      expect.objectContaining({ state: 'conflict' }),
    ]);
  });

  it('is idempotent after resolution and supports default recovery metadata factories', async () => {
    const conflictId = await seedConflict();
    const defaults = new AutomaticCharacterConflictService(database);
    await expect(defaults.resolve(conflictId, 'keep-mine')).resolves.toBe(
      'resolved'
    );
    await expect(defaults.resolve(conflictId, 'use-cloud')).resolves.toBe(
      'resolved'
    );
  });

  it('copies nested character identity when Keep both preserves the cloud candidate', async () => {
    const nested = cloudRow();
    nested.payload = {
      id: 'character-a',
      name: 'Cloud candidate',
      characterData: { id: 'character-a', revision: 3 },
    };
    const conflictId = await seedConflict(nested);
    await service.resolve(conflictId, 'keep-both', {
      copyLegacyId: 'character-cloud-copy',
    });
    await expect(
      repository.getDocument(NAMESPACE, 'character-cloud-copy')
    ).resolves.toMatchObject({
      payload: {
        id: 'character-cloud-copy',
        characterData: { id: 'character-cloud-copy' },
      },
    });
  });

  it('quarantines a cloud candidate whose payload identity differs from the aggregate', async () => {
    const unsafe = cloudRow();
    unsafe.payload = {
      id: 'character-other',
      name: 'Other',
      characterData: { id: 'character-other', revision: 3 },
    };
    const conflictId = await seedConflict(unsafe);
    await expect(service.resolve(conflictId, 'use-cloud')).resolves.toBe(
      'quarantined'
    );
    await expect(
      repository.getDocument(NAMESPACE, 'character-a')
    ).resolves.toMatchObject({
      payload: expect.objectContaining({ name: 'Local candidate' }),
    });
  });

  describe('resolution hook and origin', () => {
    it('runs the hook inside the transaction with the planned mutation id and stamps the origin', async () => {
      const conflictId = await seedConflict();
      const fenced = new AutomaticCharacterConflictService(database, {
        randomId: () => 'mutation-2',
        now: () => '2026-01-02T00:00:00.000Z',
      });
      const observed: Array<{
        hasMeta: boolean;
        conflictId: string;
        enqueuedMutationId: string | null;
      }> = [];

      await expect(
        fenced.resolve(conflictId, 'keep-mine', {
          originPlayerBackupRunId: 'run-a',
          transactionHook: {
            run: async (transaction, conflict, plan) => {
              observed.push({
                hasMeta: transaction.objectStoreNames.contains('meta'),
                conflictId: conflict.conflictId,
                enqueuedMutationId: plan.enqueuedMutationId,
              });
              transaction.objectStore('meta').put({ key: 'hook-marker' });
            },
          },
        })
      ).resolves.toBe('resolved');

      expect(observed).toEqual([
        { hasMeta: true, conflictId, enqueuedMutationId: 'mutation-2' },
      ]);
      await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
        expect.objectContaining({
          mutationId: 'mutation-2',
          originPlayerBackupRunId: 'run-a',
        }),
      ]);
      const read = database.transaction('meta', 'readonly');
      await expect(
        requestResult(read.objectStore('meta').get('hook-marker'))
      ).resolves.toEqual({ key: 'hook-marker' });
      await transactionComplete(read);
    });

    it('gives use-cloud a null planned mutation id', async () => {
      const conflictId = await seedConflict();
      const plans: Array<string | null> = [];

      await expect(
        service.resolve(conflictId, 'use-cloud', {
          transactionHook: {
            run: async (_transaction, _conflict, plan) => {
              plans.push(plan.enqueuedMutationId);
            },
          },
        })
      ).resolves.toBe('resolved');

      expect(plans).toEqual([null]);
      await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([]);
    });

    it('aborts everything when the hook throws', async () => {
      const conflictId = await seedConflict();

      await expect(
        service.resolve(conflictId, 'keep-mine', {
          transactionHook: {
            run: async () => {
              throw new Error('fence');
            },
          },
        })
      ).rejects.toThrow('fence');

      await expect(service.getConflict(conflictId)).resolves.toMatchObject({
        resolutionState: 'unresolved',
      });
      await expect(service.listSnapshots(conflictId)).resolves.toEqual([]);
      await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
        expect.objectContaining({ state: 'conflict' }),
      ]);
      await expect(
        repository.getDocument(NAMESPACE, 'character-a')
      ).resolves.toMatchObject({
        payload: expect.objectContaining({ name: 'Local candidate' }),
        updatedAt: '2026-02-01T00:00:00.000Z',
      });
    });

    it('writes no origin key without the option', async () => {
      const conflictId = await seedConflict();
      await service.resolve(conflictId, 'keep-both', {
        copyLegacyId: 'character-cloud-copy',
      });

      const [enqueued] = await repository.listOutbox(NAMESPACE);
      expect(Object.keys(enqueued)).not.toContain('originPlayerBackupRunId');
      expect(enqueued).toMatchObject({
        legacyId: 'character-a',
        operation: 'replace',
        state: 'queued',
        baseServerVersion: 2,
      });
    });

    it('returns resolved without writes when the in-transaction re-read is already resolved', async () => {
      const conflictId = await seedConflict();
      const seeded = await service.getConflict(conflictId);
      let hookRuns = 0;

      await expect(
        service.resolve(conflictId, 'keep-mine', {
          transactionHook: {
            run: async (transaction, conflict) => {
              hookRuns += 1;
              transaction
                .objectStore('conflicts')
                .put({ ...conflict, resolutionState: 'resolved' });
            },
          },
        })
      ).resolves.toBe('resolved');

      expect(hookRuns).toBe(1);
      // The service adds no resolution/resolvedAt of its own: the stored record
      // is exactly what the hook wrote.
      await expect(service.getConflict(conflictId)).resolves.toEqual({
        ...seeded,
        resolutionState: 'resolved',
      });
      await expect(service.listSnapshots(conflictId)).resolves.toEqual([]);
      await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
        expect.objectContaining({ state: 'conflict' }),
      ]);
      await expect(
        repository.getDocument(NAMESPACE, 'character-a')
      ).resolves.toMatchObject({
        payload: expect.objectContaining({ name: 'Local candidate' }),
      });
    });

    it('aborts instead of resurrecting a conflict the hook deleted', async () => {
      const conflictId = await seedConflict();

      await expect(
        service.resolve(conflictId, 'keep-mine', {
          transactionHook: {
            run: async transaction => {
              transaction.objectStore('conflicts').delete(conflictId);
            },
          },
        })
      ).rejects.toThrow('Automatic sync conflict was not found');

      await expect(service.getConflict(conflictId)).resolves.toMatchObject({
        resolutionState: 'unresolved',
      });
      await expect(service.listSnapshots(conflictId)).resolves.toEqual([]);
      await expect(repository.listOutbox(NAMESPACE)).resolves.toEqual([
        expect.objectContaining({ state: 'conflict' }),
      ]);
    });
  });
});
