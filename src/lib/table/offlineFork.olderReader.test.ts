import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  openTableDatabase,
  requestResult,
  transactionComplete,
} from './database';
import { TableRepository, type TableWorkspaceSelection } from './repository';
import type { TableSceneRecordV1 } from './schema';

/**
 * GG3 (accepted consequence): a build from before the offline changes slot
 * (f1eaf5ef) validates scene keys exactly and does not know `offlineFork`.
 * This file stands in for that build by making the scene validator refuse
 * the field the same way, then checks what that reader does: the whole Table
 * opens read-only, nothing is written or lost, and it reads normally again
 * once a newer build clears the slot.
 */
vi.mock('./schema', async importOriginal => {
  const actual = await importOriginal<typeof import('./schema')>();
  return {
    ...actual,
    validateSceneRecord: (value: unknown) =>
      value !== null && typeof value === 'object' && 'offlineFork' in value
        ? { ok: false, reason: 'invalid-record' }
        : actual.validateSceneRecord(value),
  };
});

const selection: TableWorkspaceSelection = {
  account: { kind: 'guest' },
  workspace: { localWorkspaceId: 'older-reader' },
};
const repositories: TableRepository[] = [];
afterEach(() => {
  repositories.splice(0).forEach(repository => repository.dispose());
});

const scene = (workspaceKey: string): TableSceneRecordV1 => ({
  schemaVersion: 1,
  workspaceKey,
  sceneId: 'scene-1',
  originalMapId: null,
  map: {
    name: 'Crypt',
    mapImageUrl: '/map.webp',
    mapImageSize: { w: 10, h: 10 },
    gridEnabled: false,
    gridSettings: null,
    markers: [],
    dmOnlyElements: {},
  },
  canvasCheckpoint: null,
  members: [],
  arrivalPoint: null,
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
});

async function writeRaw(factory: IDBFactory, record: unknown) {
  const database = await openTableDatabase({ factory });
  const transaction = database.transaction('scenes', 'readwrite');
  transaction.objectStore('scenes').put(record);
  await transactionComplete(transaction);
  database.close();
}

async function readRaw(factory: IDBFactory, key: [string, string]) {
  const database = await openTableDatabase({ factory });
  const value = await requestResult(
    database.transaction('scenes').objectStore('scenes').get(key)
  );
  database.close();
  return value as Record<string, unknown> | undefined;
}

describe('an older build reading a scene with the offline changes slot', () => {
  it('opens the Table read-only, writes nothing, and recovers once the slot is cleared', async () => {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection });
    repositories.push(repository);
    await repository.start();
    const base = scene(repository.workspaceIdentity);
    await repository.putSceneForTest(base, 0);
    const withSlot = {
      ...base,
      offlineFork: {
        savedAt: '2026-10-15T10:01:00.000Z',
        replacedEarlier: false,
        draft: {
          protocolVersion: 1,
          generation: 'authority-1',
          revision: 1,
          capturedAt: '2026-10-15T10:00:00.000Z',
          state: { elements: [{ id: 'offline' }] },
        },
      },
    };
    // A newer build wrote the slot.
    await writeRaw(factory, withSlot);

    const loaded = await repository.reload();
    expect(loaded).toMatchObject({
      status: 'read-only',
      reason: 'invalid-schema',
    });
    if (loaded.status !== 'read-only') throw new Error('expected read-only');
    expect(loaded.raw.scenes).toEqual([withSlot]);
    await expect(
      repository.mutateWorkspace(1, 'older-edit', {
        scenes: { put: [{ ...base, updatedAt: '2026-10-15T11:00:00.000Z' }] },
      })
    ).resolves.toMatchObject({ status: 'rejected' });
    const key: [string, string] = [repository.workspaceIdentity, 'scene-1'];
    expect(await readRaw(factory, key)).toEqual(withSlot);

    // A newer build reapplies or discards the offline changes.
    await writeRaw(factory, base);
    const recovered = await repository.reload();
    expect(recovered.status).toBe('ready');
    if (recovered.status !== 'ready') throw new Error('expected ready');
    expect(recovered.snapshot.scenes[0]?.map.name).toBe('Crypt');
  });
});
