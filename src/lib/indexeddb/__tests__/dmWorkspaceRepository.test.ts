import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
} from '../localDatabase';
import { IndexedDbDmWorkspaceRepository } from '../dmWorkspaceRepository';

const ACCOUNT_A = 'user:account-a' as const;
const ACCOUNT_B = 'user:account-b' as const;

describe('IndexedDbDmWorkspaceRepository', () => {
  let database: IDBDatabase;
  let nextId: number;

  beforeEach(async () => {
    database = await openRollkeeperDatabase();
    nextId = 0;
  });

  afterEach(async () => {
    database.close();
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  const repository = (beforeCommit?: () => void) =>
    new IndexedDbDmWorkspaceRepository(database, {
      randomId: () => `workspace-mutation-${++nextId}`,
      beforeCommit,
    });

  it('commits a workspace intent and its outbox entry in one transaction', async () => {
    const result = await repository().commitCreate({
      namespace: ACCOUNT_A,
      localId: 'local-workspace-a',
      name: 'Northwatch',
      creationKind: 'new_workspace',
      sourceFingerprint: null,
      createdAt: '2026-08-17T00:00:00.000Z',
    });

    expect(result).toEqual({
      saved: true,
      mutationId: 'workspace-mutation-1',
    });
    await expect(repository().listOutbox(ACCOUNT_A)).resolves.toEqual([
      expect.objectContaining({
        family: 'workspace_identity',
        state: 'queued',
        name: 'Northwatch',
      }),
    ]);
    await expect(
      repository().get(ACCOUNT_A, 'local-workspace-a')
    ).resolves.toMatchObject({ cloudId: null, displayCode: null });
    await expect(repository().list(ACCOUNT_A)).resolves.toHaveLength(1);
  });

  it('acknowledges the cloud identity and removes only its outbox entry atomically', async () => {
    const repo = repository();
    const a = await repo.commitCreate({
      namespace: ACCOUNT_A,
      localId: 'local-workspace-a',
      name: 'Northwatch',
      creationKind: 'new_workspace',
      sourceFingerprint: null,
      createdAt: '2026-08-17T00:00:00.000Z',
    });
    if (!a.saved) throw new Error('expected workspace A to be durable');
    await repo.commitCreate({
      namespace: ACCOUNT_B,
      localId: 'local-workspace-b',
      name: 'Southwatch',
      creationKind: 'new_workspace',
      sourceFingerprint: null,
      createdAt: '2026-08-17T00:00:00.000Z',
    });

    await repo.acknowledge(a.mutationId!, {
      campaignId: 'cloud-workspace-a',
      displayCode: 'A1B2C3D4E5F6',
      membershipAuthority: 'legacy',
      familyAuthorities: 'legacy',
      liveRuntimeAuthority: 'redis_relay',
    });

    await expect(
      repo.get(ACCOUNT_A, 'local-workspace-a')
    ).resolves.toMatchObject({
      cloudId: 'cloud-workspace-a',
      displayCode: 'A1B2C3D4E5F6',
      membershipAuthority: 'legacy',
    });
    await expect(repo.listOutbox(ACCOUNT_A)).resolves.toEqual([]);
    await expect(repo.listOutbox(ACCOUNT_B)).resolves.toHaveLength(1);
    await expect(
      repo.acknowledge('missing', {
        campaignId: 'missing',
        displayCode: 'C1B2C3D4E5F6',
        membershipAuthority: 'legacy',
        familyAuthorities: 'legacy',
        liveRuntimeAuthority: 'redis_relay',
      })
    ).resolves.toBeUndefined();
    await expect(
      repo.updateWork('missing', { state: 'failed', lastError: 'ignored' })
    ).resolves.toBeUndefined();
  });

  it('rolls back both records on local failure and retains queued work on failed acknowledgement', async () => {
    const failed = repository(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    await expect(
      failed.commitCreate({
        namespace: ACCOUNT_A,
        localId: 'local-workspace-a',
        name: 'Northwatch',
        creationKind: 'import_fork',
        sourceFingerprint: 'a'.repeat(64),
        createdAt: '2026-08-17T00:00:00.000Z',
      })
    ).resolves.toEqual({ saved: false, reason: 'failed' });
    await expect(failed.listOutbox(ACCOUNT_A)).resolves.toEqual([]);

    const repo = repository();
    const queued = await repo.commitCreate({
      namespace: ACCOUNT_A,
      localId: 'local-workspace-b',
      name: 'Northwatch fork',
      creationKind: 'import_fork',
      sourceFingerprint: 'b'.repeat(64),
      createdAt: '2026-08-17T00:00:00.000Z',
    });
    if (!queued.saved) throw new Error('expected workspace fork to be durable');
    await expect(
      repo.acknowledge(
        queued.mutationId!,
        {
          campaignId: 'cloud-workspace-b',
          displayCode: 'B1B2C3D4E5F6',
          membershipAuthority: 'legacy',
          familyAuthorities: 'legacy',
          liveRuntimeAuthority: 'redis_relay',
        },
        { abortTransaction: true }
      )
    ).rejects.toThrow();
    await expect(repo.listOutbox(ACCOUNT_A)).resolves.toHaveLength(1);
    await expect(
      repo.get(ACCOUNT_A, 'local-workspace-b')
    ).resolves.toMatchObject({ cloudId: null, displayCode: null });
  });

  it('rejects guest namespaces and keeps account reads isolated', async () => {
    const repo = repository();
    await expect(
      repo.commitCreate({
        namespace: 'guest',
        localId: 'guest-workspace',
        name: 'Guest',
        creationKind: 'new_workspace',
        sourceFingerprint: null,
        createdAt: '2026-08-17T00:00:00.000Z',
      })
    ).resolves.toEqual({ saved: false, reason: 'guest' });
    await expect(repo.list(ACCOUNT_A)).resolves.toEqual([]);
    await expect(repo.listOutbox(ACCOUNT_A)).resolves.toEqual([]);
  });
});
