import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BattleMapConnection } from '@/lib/battlemapSync';

import { TableRepository, type TableWorkspaceSelection } from './repository';
import {
  restoreAuthorityFork,
  saveSceneCheckpoint,
  sceneCheckpointToViewportState,
  validateSceneAuthorityCheckpoint,
} from './checkpoint';
import { canvasStateToAuthorityState } from './authorityLifecycle';
import type { TableSceneRecordV1 } from './schema';

const selection: TableWorkspaceSelection = {
  account: { kind: 'guest' },
  workspace: { localWorkspaceId: 'checkpoint-workspace' },
};
const repositories: TableRepository[] = [];
afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

const barrier = {
  barrierId: 'barrier-1',
  scopeId: 'CAMP:scene:scene-1',
  generation: 'generation-1',
  throughLocalSequence: 2,
  localEditGeneration: 4,
  operationIds: ['op-1'],
} as const;

const checkpoint = {
  elements: [{ id: 'token-1', type: 'token' }],
  layers: [
    { id: 'tokens', definition: { id: 'tokens' }, version: 1, editor: 'dm' },
  ],
  extensions: {
    fog: {
      pluginName: 'fog',
      version: 1,
      data: {
        meta: { definition: { generation: 'fog-1' }, version: 1, editor: 'dm' },
        tiles: [],
      },
    },
  },
  cursor: {
    generation: 'generation-1',
    streamId: '0123456789abcdef0123456789abcdef',
    revision: 7,
  },
  casToken: 'cas-1',
};

function connection(
  overrides: Partial<BattleMapConnection> = {}
): BattleMapConnection {
  return {
    stop: vi.fn(),
    publishLayerUpsert: vi.fn(),
    publishLayerRemove: vi.fn(),
    sendPresence: vi.fn(),
    onPresence: vi.fn(() => () => {}),
    onPresenceLeave: vi.fn(() => () => {}),
    captureBarrier: vi.fn(() => barrier),
    waitForAcknowledgements: vi.fn(async () => ({
      status: 'acknowledged' as const,
      barrier,
      accepted: [],
      rejectedIds: [],
      uncertainIds: [],
      outstandingIds: [],
    })),
    requestCheckpoint: vi.fn(async () => ({
      status: 'complete' as const,
      checkpoint,
      barrier,
    })) as unknown as NonNullable<BattleMapConnection['requestCheckpoint']>,
    releaseBarrier: vi.fn(() => true),
    ...overrides,
  };
}

const scene = (workspaceKey: string): TableSceneRecordV1 => ({
  schemaVersion: 1,
  workspaceKey,
  sceneId: 'scene-1',
  originalMapId: 'map-1',
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

describe('scene checkpoint persistence', () => {
  it('translates authority layer records and fog extensions into the exact Viewport load shape', () => {
    expect(
      sceneCheckpointToViewportState({
        protocolVersion: 1,
        generation: 'generation-1',
        revision: 7,
        capturedAt: '2026-10-05T00:00:00.000Z',
        state: checkpoint,
      })
    ).toEqual({
      version: 4,
      camera: { position: { x: 0, y: 0 }, zoom: 1 },
      elements: checkpoint.elements,
      layers: [{ id: 'tokens' }],
      activeLayerId: 'tokens',
      extensions: {
        fog: {
          version: 1,
          data: checkpoint.extensions.fog.data,
        },
      },
    });
  });

  it('requires explicit receipts and commits one coherent same-generation elements/layers/fog checkpoint', async () => {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection });
    repositories.push(repository);
    await repository.start();
    await repository.putSceneForTest(scene(repository.workspaceIdentity), 0);

    const result = await saveSceneCheckpoint({
      repository,
      connection: connection(),
      sceneId: 'scene-1',
      expectedRevision: 1,
      operationId: 'checkpoint-1',
      now: () => '2026-10-05T02:00:00.000Z',
    });

    expect(result).toMatchObject({ status: 'committed', pending: false });
    const loaded = await repository.reload();
    if (loaded.status !== 'ready') throw new Error('expected ready');
    expect(loaded.snapshot.scenes[0]?.canvasCheckpoint).toMatchObject({
      generation: 'generation-1',
      revision: 7,
      state: checkpoint,
    });
  });

  it.each(['blocked', 'timeout'] as const)(
    'rejects %s receipt barriers without requesting a checkpoint',
    async status => {
      const requestCheckpoint = vi.fn();
      const result = await saveSceneCheckpoint({
        repository: {} as TableRepository,
        connection: connection({
          waitForAcknowledgements: vi.fn(async () => ({
            status,
            barrier,
            accepted: [],
            rejectedIds: [],
            uncertainIds: status === 'timeout' ? ['op-1'] : [],
            outstandingIds: ['op-1'],
          })),
          requestCheckpoint,
        }),
        sceneId: 'scene-1',
        expectedRevision: 1,
        operationId: 'checkpoint-1',
      });
      expect(result.status).toBe('not-saved');
      expect(requestCheckpoint).not.toHaveBeenCalled();
    }
  );

  it('rejects missing, malformed and wrong-generation fog checkpoints', () => {
    expect(
      validateSceneAuthorityCheckpoint(
        { ...checkpoint, extensions: {} },
        barrier
      )
    ).toBeNull();
    expect(
      validateSceneAuthorityCheckpoint(
        {
          ...checkpoint,
          extensions: {
            fog: {
              ...checkpoint.extensions.fog,
              data: { meta: {}, tiles: 'bad' },
            },
          },
        },
        barrier
      )
    ).toBeNull();
    expect(
      validateSceneAuthorityCheckpoint(
        {
          ...checkpoint,
          cursor: { ...checkpoint.cursor, generation: 'other' },
        },
        barrier
      )
    ).toBeNull();
  });

  it('reports a later local edit as pending after committing the barrier checkpoint', async () => {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection });
    repositories.push(repository);
    await repository.start();
    await repository.putSceneForTest(scene(repository.workspaceIdentity), 0);
    const result = await saveSceneCheckpoint({
      repository,
      connection: connection(),
      sceneId: 'scene-1',
      expectedRevision: 1,
      operationId: 'checkpoint-1',
      getLocalEditGeneration: () => 5,
    });
    expect(result).toMatchObject({ status: 'committed', pending: true });
  });

  it('uses generation+CAS for explicit restore so only one simultaneous restore wins', async () => {
    let restored = false;
    const fetcher = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.endsWith('/checkpoint')) {
        return new Response(
          JSON.stringify({ generation: 'current', casToken: 'current-cas' }),
          { status: 200 }
        );
      }
      if (!restored) {
        restored = true;
        return new Response(JSON.stringify({ status: 'provisioned' }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({ error: 'Authority state changed' }),
        {
          status: 409,
        }
      );
    });
    const retained = {
      protocolVersion: 1 as const,
      generation: 'old',
      revision: 1,
      capturedAt: '2026-10-05T00:00:00.000Z',
      state: checkpoint,
    };

    const outcomes = await Promise.all([
      restoreAuthorityFork({
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        sceneId: 'scene-1',
        checkpoint: retained,
        fetcher,
      }),
      restoreAuthorityFork({
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        sceneId: 'scene-1',
        checkpoint: retained,
        fetcher,
      }),
    ]);

    expect(outcomes.map(value => value.status).sort()).toEqual([
      'conflict',
      'restored',
    ]);
    const restoreBodies = fetcher.mock.calls
      .filter(([input]) => String(input).endsWith('/initialize-if-empty'))
      .map(
        ([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>
      );
    expect(restoreBodies).toHaveLength(2);
    expect(restoreBodies[0]).toMatchObject({
      expectedGeneration: 'current',
      expectedCasToken: 'current-cas',
    });
  });
});

describe('PR02 checkpoint provenance and roster durability', () => {
  it('keeps ownerId and token control fields through checkpoint, reload and provisioning state', async () => {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection });
    repositories.push(repository);
    await repository.start();
    const base = scene(repository.workspaceIdentity);
    base.members = [
      {
        actorId: 'party-actor',
        tokenIds: ['party-token'],
        sceneMemberId: 'member-1',
        control: { kind: 'player', legacyPlayerId: 'legacy-a' },
      },
    ];
    await repository.mutateWorkspace(0, 'seed', {
      scenes: { put: [base] },
      actors: {
        put: [
          {
            schemaVersion: 1,
            workspaceKey: repository.workspaceIdentity,
            actorId: 'party-actor',
            actorKind: 'player-reference',
            liveStats: null,
            playerReference: { campaignId: 'CAMP', playerId: 'legacy-a' },
            cachedPlayerData: null,
            playerConditionOverlay: {
              suppressedSourceConditionIds: [],
              dmConditions: [],
            },
            createdAt: '2026-10-05T00:00:00.000Z',
            updatedAt: '2026-10-05T00:00:00.000Z',
          },
        ],
      },
    });
    const party = {
      id: 'party-token',
      type: 'shape',
      tokenKind: 'player',
      characterId: 'legacy-a',
      layerId: 'player-legacy-a',
      sceneMemberId: 'member-1',
      ownerId: 'dm-a',
    };
    const withProvenance = { ...checkpoint, elements: [party] };
    const result = await saveSceneCheckpoint({
      repository,
      connection: connection({
        requestCheckpoint: vi.fn(async () => ({
          status: 'complete' as const,
          checkpoint: withProvenance,
          barrier,
        })) as unknown as NonNullable<BattleMapConnection['requestCheckpoint']>,
      }),
      sceneId: 'scene-1',
      expectedRevision: 1,
      operationId: 'checkpoint-provenance',
    });
    expect(result).toMatchObject({ status: 'committed' });

    const reopened = new TableRepository({ factory, selection });
    repositories.push(reopened);
    const loaded = await reopened.start();
    if (loaded.status !== 'ready') throw new Error('expected ready');
    const stored = loaded.snapshot.scenes[0]!;
    expect(stored.members[0]).toMatchObject({
      sceneMemberId: 'member-1',
      tokenIds: ['party-token'],
    });
    const viewport = sceneCheckpointToViewportState(stored.canvasCheckpoint!);
    const authority = canvasStateToAuthorityState(viewport, 'dm-a');
    expect(authority.elements).toEqual([party]);
  });
});
