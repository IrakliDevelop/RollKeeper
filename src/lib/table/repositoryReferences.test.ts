import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';

import {
  TableRepository,
  retainOperations,
  type TableWorkspaceSelection,
} from './repository';
import {
  TABLE_LIMITS,
  type TableActorRecordV1,
  type TableEncounterRecordV1,
  type TableOperationRecordV1,
  type TableSceneRecordV1,
} from './schema';

const AT = '2026-10-07T00:00:00.000Z';
const selection: TableWorkspaceSelection = {
  account: { kind: 'guest' },
  workspace: { localWorkspaceId: 'workspace-references' },
};
const repositories: TableRepository[] = [];
afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

async function open(factory = new IDBFactory()) {
  const repository = new TableRepository({
    factory,
    selection,
    broadcastChannel: null,
    events: null,
  });
  repositories.push(repository);
  await repository.start();
  return repository;
}

function scene(workspaceKey: string): TableSceneRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    sceneId: 'scene-1',
    originalMapId: null,
    map: {
      name: 'Map',
      mapImageUrl: '/map.webp',
      mapImageSize: { w: 10, h: 10 },
      gridEnabled: false,
      gridSettings: null,
      markers: [],
      dmOnlyElements: {},
    },
    canvasCheckpoint: null,
    members: [{ actorId: 'actor-1', tokenIds: [] }],
    arrivalPoint: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

function actor(workspaceKey: string, actorId = 'actor-1'): TableActorRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    actorId,
    actorKind: 'dm-managed',
    liveStats: {
      name: actorId,
      currentHp: 1,
      maxHp: 1,
      tempHp: 0,
      armorClass: 10,
      conditions: [],
    },
    playerReference: null,
    cachedPlayerData: null,
    playerConditionOverlay: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

function run(
  workspaceKey: string,
  patch: Partial<TableEncounterRecordV1> = {}
): TableEncounterRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    runId: 'run-1',
    sceneId: 'scene-1',
    sourceEncounterId: null,
    runGeneration: 'run-1',
    participants: [
      {
        actorId: 'actor-1',
        initiative: 10,
        turnResources: { reactionAvailable: true, legendaryActionsUsed: 0 },
      },
    ],
    round: 0,
    currentActorId: null,
    isActive: false,
    createdAt: AT,
    updatedAt: AT,
    ...patch,
  };
}

async function seeded() {
  const repository = await open();
  const key = repository.workspaceIdentity;
  const result = await repository.mutateWorkspace(0, 'seed', {
    scenes: { put: [scene(key)] },
    actors: { put: [actor(key)] },
    encounters: { put: [run(key)] },
  });
  expect(result.status).toBe('committed');
  return { repository, key };
}

describe('mutateWorkspace reference checks (D2, R2-8)', () => {
  it('rejects an activeRunId that names no run', async () => {
    const { repository } = await seeded();
    const result = await repository.mutateWorkspace(1, 'bad-active', {
      campaign: { activeRunId: 'missing-run' },
    });
    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'invalid-reference',
      detail: 'active-run-missing',
    });
  });

  it('rejects a selectedRunId that names no run', async () => {
    const { repository } = await seeded();
    const result = await repository.mutateWorkspace(1, 'bad-selected', {
      campaign: { selectedRunId: 'missing-run' },
    });
    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'invalid-reference',
      detail: 'selected-run-missing',
    });
  });

  it('rejects selection of a tombstoned run', async () => {
    const { repository, key } = await seeded();
    const tombstoned = await repository.mutateWorkspace(1, 'tombstone', {
      tombstones: {
        put: [
          {
            schemaVersion: 1,
            workspaceKey: key,
            kind: 'encounter',
            id: 'run-1',
            deletedAt: AT,
          },
        ],
      },
    });
    expect(tombstoned.status).toBe('committed');
    const result = await repository.mutateWorkspace(2, 'select-tombstoned', {
      campaign: { selectedRunId: 'run-1' },
    });
    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'invalid-reference',
      detail: 'selected-run-missing',
    });
  });

  it('rejects activeRunId pointing at an inactive run', async () => {
    const { repository } = await seeded();
    const result = await repository.mutateWorkspace(1, 'inactive-active', {
      campaign: { activeRunId: 'run-1' },
    });
    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'invalid-reference',
      detail: 'active-run-inactive',
    });
  });

  it('rejects a currentActorId that is not a participant', async () => {
    const { repository, key } = await seeded();
    const result = await repository.mutateWorkspace(1, 'bad-current', {
      actors: { put: [actor(key, 'actor-2')] },
      encounters: { put: [run(key, { currentActorId: 'actor-2' })] },
    });
    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'invalid-reference',
      detail: 'current-actor-not-participant',
    });
  });

  it('accepts a consistent active run and the adoption legacy-active shape', async () => {
    const { repository, key } = await seeded();
    const active = await repository.mutateWorkspace(1, 'consistent', {
      encounters: {
        put: [run(key, { isActive: true, currentActorId: 'actor-1' })],
      },
      campaign: { activeRunId: 'run-1', selectedRunId: 'run-1' },
    });
    expect(active.status).toBe('committed');
    // Adoption may copy a legacy `isActive: true` while activeRunId stays
    // null; only `activeRunId ⇒ active run` is enforced (R2-8).
    const legacyShape = await repository.mutateWorkspace(2, 'legacy-shape', {
      campaign: { activeRunId: null },
    });
    expect(legacyShape.status).toBe('committed');
  });

  it('evicts operations by committed revision then operation id, like commit()', async () => {
    const repository = await open();
    const key = repository.workspaceIdentity;
    // Seed a full retention window plus duplicates at the oldest revision.
    const raw = await repository.mutateWorkspace(0, 'op-seed', {
      scenes: { put: [scene(key)] },
      actors: { put: [actor(key)] },
    });
    expect(raw.status).toBe('committed');
    let revision = 1;
    for (let index = 0; index < TABLE_LIMITS.maxOperations; index += 1) {
      const result = await repository.mutateWorkspace(
        revision,
        `op-${String(index).padStart(3, '0')}`,
        {}
      );
      expect(result.status).toBe('committed');
      revision += 1;
    }
    const stored = await repository.readRawForExport();
    const ids = (stored.operations as Array<{ operationId: string }>).map(
      operation => operation.operationId
    );
    expect(ids).toHaveLength(TABLE_LIMITS.maxOperations);
    expect(ids).not.toContain('op-seed');
    expect(ids).toContain('op-000');
  });

  it('breaks committedRevision ties by operation id when evicting', () => {
    const operation = (operationId: string, committedRevision: number) =>
      ({ operationId, committedRevision }) as TableOperationRecordV1;
    // Input order deliberately differs from operation-id order.
    const { kept, evicted } = retainOperations(
      [
        operation('z-new', 3),
        operation('b-tie', 1),
        operation('c-mid', 2),
        operation('a-tie', 1),
      ],
      3
    );
    expect(evicted.map(value => value.operationId)).toEqual(['a-tie']);
    expect(kept.map(value => value.operationId)).toEqual([
      'b-tie',
      'c-mid',
      'z-new',
    ]);
  });
});
