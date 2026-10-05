import { describe, expect, it } from 'vitest';

import {
  TABLE_LIMITS,
  canonicalJson,
  commandDigest,
  deepFreezeSnapshot,
  serializedByteCount,
  validateActorRecord,
  validateRuntimeCommand,
  validateWorkspaceLimits,
  type TableActorRecordV1,
  type TableRuntimeCommandV1,
  type TableWorkspaceSnapshotV1,
} from './schema';

const actor = (actorId = 'actor-1'): TableActorRecordV1 => ({
  schemaVersion: 1,
  workspaceKey: 'user:account-a/workspace:workspace-a',
  actorId,
  actorKind: 'dm-managed',
  liveStats: {
    name: 'Guard',
    currentHp: 11,
    maxHp: 11,
    tempHp: 0,
    armorClass: 16,
    conditions: [],
  },
  playerReference: null,
  cachedPlayerData: null,
  playerConditionOverlay: null,
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
});

const command = (): TableRuntimeCommandV1 => ({
  type: 'runtime.commit',
  campaign: { selectedRunId: 'run-1', activeRunId: 'run-1' },
  actors: { put: [actor()], delete: [] },
  encounters: {
    put: [
      {
        schemaVersion: 1,
        workspaceKey: actor().workspaceKey,
        runId: 'run-1',
        sceneId: 'scene-1',
        sourceEncounterId: 'source-encounter-1',
        runGeneration: 'generation-1',
        participants: [
          {
            actorId: 'actor-1',
            initiative: null,
            turnResources: { reactionAvailable: true, legendaryActionsUsed: 0 },
          },
        ],
        round: 0,
        currentActorId: null,
        isActive: false,
        createdAt: '2026-10-05T00:00:00.000Z',
        updatedAt: '2026-10-05T00:00:00.000Z',
      },
    ],
    delete: [],
  },
  logs: {
    put: [
      {
        schemaVersion: 1,
        workspaceKey: actor().workspaceKey,
        archiveId: 'archive-1',
        runId: 'run-1',
        events: [],
        startedAt: '2026-10-05T00:00:00.000Z',
        endedAt: null,
      },
    ],
    delete: [],
  },
});

describe('table schema', () => {
  it('canonicalizes keys recursively and hashes equal commands identically', async () => {
    const left = command();
    const right = {
      logs: left.logs,
      encounters: left.encounters,
      actors: left.actors,
      campaign: { activeRunId: 'run-1', selectedRunId: 'run-1' },
      type: 'runtime.commit',
    } as TableRuntimeCommandV1;

    expect(canonicalJson({ z: 1, nested: { b: 2, a: 1 } })).toBe(
      '{"nested":{"a":1,"b":2},"z":1}'
    );
    await expect(commandDigest(left)).resolves.toBe(await commandDigest(right));
    expect(serializedByteCount('é')).toBe(4);
    expect(() => canonicalJson({ invalid: undefined })).toThrow(
      'JSON-compatible'
    );
  });

  it('validates exact v1 actors and keeps live stats separate from turn resources', () => {
    expect(validateActorRecord(actor())).toEqual({ ok: true });
    expect('initiative' in actor().liveStats!).toBe(false);
    expect(command().encounters.put[0]?.participants[0]?.turnResources).toEqual(
      { reactionAvailable: true, legendaryActionsUsed: 0 }
    );

    expect(
      validateActorRecord({ ...actor(), unexpected: true } as unknown)
    ).toMatchObject({ ok: false });
    expect(
      validateActorRecord({ ...actor(), schemaVersion: 2 } as unknown)
    ).toMatchObject({ ok: false, reason: 'unsupported-schema' });
    expect(validateRuntimeCommand(command())).toEqual({ ok: true });
  });

  it('enforces member, actor, record, archive, checkpoint, and workspace bounds', () => {
    const workspaceKey = actor().workspaceKey;
    const snapshot: TableWorkspaceSnapshotV1 = {
      workspaceKey,
      campaign: null,
      scenes: [],
      actors: [],
      encounters: [],
      logs: [],
      sources: [],
      tombstones: [],
    };

    expect(validateWorkspaceLimits(snapshot)).toEqual({ ok: true });
    expect(
      validateWorkspaceLimits({
        ...snapshot,
        actors: Array.from({ length: TABLE_LIMITS.maxActors + 1 }, (_, index) =>
          actor(`actor-${index}`)
        ),
      })
    ).toMatchObject({ ok: false, reason: 'actor-count' });

    expect(
      validateWorkspaceLimits({
        ...snapshot,
        scenes: [
          {
            schemaVersion: 1,
            workspaceKey,
            sceneId: 'scene-1',
            originalMapId: 'map-1',
            map: {
              name: 'Large party',
              mapImageUrl: '',
              mapImageSize: { w: 1, h: 1 },
              gridEnabled: false,
              gridSettings: null,
              markers: [],
              dmOnlyElements: {},
            },
            canvasCheckpoint: null,
            members: Array.from(
              { length: TABLE_LIMITS.maxMembersPerScene + 1 },
              (_, index) => ({ actorId: `actor-${index}`, tokenIds: [] })
            ),
            arrivalPoint: null,
            createdAt: '2026-10-05T00:00:00.000Z',
            updatedAt: '2026-10-05T00:00:00.000Z',
          },
        ],
      })
    ).toMatchObject({ ok: false, reason: 'scene-member-count' });

    expect(
      validateWorkspaceLimits(
        { ...snapshot, actors: [actor()] },
        { ...TABLE_LIMITS, maxMetadataRecordBytes: 20 }
      )
    ).toMatchObject({ ok: false, reason: 'metadata-record-bytes' });
    expect(
      validateWorkspaceLimits(
        { ...snapshot, actors: [actor()] },
        { ...TABLE_LIMITS, maxWorkspaceBytes: 20 }
      )
    ).toMatchObject({ ok: false, reason: 'workspace-bytes' });

    const boundedScene: TableWorkspaceSnapshotV1['scenes'][number] = {
      schemaVersion: 1,
      workspaceKey,
      sceneId: 'scene-checkpoint',
      originalMapId: null,
      map: {
        name: 'Checkpoint',
        mapImageUrl: '',
        mapImageSize: { w: 1, h: 1 },
        gridEnabled: false,
        gridSettings: null,
        markers: [],
        dmOnlyElements: {},
      },
      canvasCheckpoint: {
        protocolVersion: 1,
        generation: 'generation-1',
        revision: 1,
        capturedAt: '2026-10-05T00:00:00.000Z',
        state: { elements: [] },
      },
      members: [],
      arrivalPoint: null,
      createdAt: '2026-10-05T00:00:00.000Z',
      updatedAt: '2026-10-05T00:00:00.000Z',
    };
    expect(
      validateWorkspaceLimits(
        { ...snapshot, scenes: [boundedScene] },
        { ...TABLE_LIMITS, maxCanvasCheckpointBytes: 20 }
      )
    ).toMatchObject({ ok: false, reason: 'canvas-checkpoint-bytes' });
    expect(
      validateWorkspaceLimits(
        { ...snapshot, logs: command().logs.put },
        { ...TABLE_LIMITS, maxCombatArchiveBytes: 20 }
      )
    ).toMatchObject({ ok: false, reason: 'archive-record-bytes' });
    expect(
      validateWorkspaceLimits(
        {
          ...snapshot,
          tombstones: [
            {
              schemaVersion: 1,
              workspaceKey,
              kind: 'actor',
              id: 'deleted-actor',
              deletedAt: '2026-10-05T00:00:00.000Z',
            },
          ],
        },
        { ...TABLE_LIMITS, maxActors: 0 }
      )
    ).toMatchObject({ ok: false, reason: 'actor-count' });
  });

  it('returns recursively frozen snapshots rather than mutable store values', () => {
    const frozen = deepFreezeSnapshot({ nested: { values: [1, 2, 3] } });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.nested)).toBe(true);
    expect(Object.isFrozen(frozen.nested.values)).toBe(true);
    expect(() => frozen.nested.values.push(4)).toThrow();
  });
});
