import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useBattleMapStore } from '@/store/battleMapStore';
import { useEncounterStore } from '@/store/encounterStore';
import { useLocationStore } from '@/store/locationStore';
import { useDmStore } from '@/store/dmStore';
import { TableRepository, type TableWorkspaceSelection } from './repository';
import { createTableSceneAdapter } from './sceneAdapter';
import type { TableSceneRecordV1 } from './schema';

const selection: TableWorkspaceSelection = {
  account: { kind: 'guest' },
  workspace: { localWorkspaceId: 'scene-adapter' },
};
const repositories: TableRepository[] = [];
afterEach(() => {
  repositories.splice(0).forEach(repository => repository.dispose());
  vi.restoreAllMocks();
});

function scene(workspaceKey: string): TableSceneRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    sceneId: 'scene-1',
    originalMapId: 'legacy-map',
    map: {
      name: 'Table scene',
      mapImageUrl: '/map.webp',
      mapImageSize: { w: 100, h: 100 },
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
  };
}

describe('Table scene canvas adapter', () => {
  it('persists canvas/grid/fog/marker/camera/audience edits only to Table state', async () => {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection });
    repositories.push(repository);
    await repository.start();
    await repository.putSceneForTest(scene(repository.workspaceIdentity), 0);
    const battleMapWrites = {
      update: vi.spyOn(useBattleMapStore.getState(), 'updateBattleMap'),
      setDmOnly: vi.spyOn(useBattleMapStore.getState(), 'setDmOnly'),
      toggleDmOnly: vi.spyOn(useBattleMapStore.getState(), 'toggleDmOnly'),
    };
    const encounterWrite = vi.spyOn(
      useEncounterStore.getState(),
      'updateEncounter'
    );
    const unrelatedLocationWrite = vi.spyOn(
      useLocationStore.getState(),
      'updateLocation'
    );
    const cloudOrCampaignWrite = vi.spyOn(
      useDmStore.getState(),
      'updateCampaign'
    );
    const sourceRouteWrite = vi.spyOn(globalThis, 'fetch');
    const unrelatedStorageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const adapter = createTableSceneAdapter({
      repository,
      sceneId: 'scene-1',
      campaignCode: 'CAMP',
      newOperationId: vi
        .fn<() => string>()
        .mockReturnValueOnce('canvas')
        .mockReturnValueOnce('audience'),
      now: () => '2026-10-05T04:00:00.000Z',
    });

    adapter.updateBattleMap({
      canvasState:
        '{"elements":[{"id":"token-1"}],"layers":[],"extensions":{"fog":null}}',
      gridEnabled: true,
      markers: [{ id: 'marker-1', title: '', body: '', dmNotes: '' }],
      cameraViews: [
        { id: 'view-1', name: 'Entrance', view: { x: 0, y: 0, w: 10, h: 10 } },
      ],
      fogAppearance: 'cloudy',
    });
    adapter.setDmOnly('token-1', true);
    await adapter.flush();

    expect(
      Object.values(battleMapWrites).every(spy => !spy.mock.calls.length)
    ).toBe(true);
    expect(encounterWrite).not.toHaveBeenCalled();
    expect(unrelatedLocationWrite).not.toHaveBeenCalled();
    expect(cloudOrCampaignWrite).not.toHaveBeenCalled();
    expect(sourceRouteWrite).not.toHaveBeenCalled();
    expect(unrelatedStorageWrite).not.toHaveBeenCalled();
    const loaded = await repository.reload();
    if (loaded.status !== 'ready') throw new Error('expected ready');
    expect(loaded.snapshot.scenes[0]).toMatchObject({
      map: {
        gridEnabled: true,
        dmOnlyElements: { 'token-1': true },
        fogAppearance: 'cloudy',
        cameraViews: [{ id: 'view-1' }],
        markers: [{ id: 'marker-1' }],
      },
      localDraft: { state: { elements: [{ id: 'token-1' }] } },
    });
    adapter.dispose();
  });

  it('keeps a reconnect draft separate from the last committed checkpoint', async () => {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection });
    repositories.push(repository);
    await repository.start();
    const seeded = scene(repository.workspaceIdentity);
    seeded.canvasCheckpoint = {
      protocolVersion: 1,
      generation: 'authority-1',
      revision: 2,
      capturedAt: '2026-10-05T00:00:00.000Z',
      state: { elements: [{ id: 'committed' }] },
    };
    await repository.putSceneForTest(seeded, 0);
    const adapter = createTableSceneAdapter({
      repository,
      sceneId: 'scene-1',
      campaignCode: 'CAMP',
      newOperationId: () => 'offline-edit',
    });
    adapter.updateBattleMap({ canvasState: '{"elements":[{"id":"offline"}]}' });
    await adapter.flush();
    const loaded = await repository.reload();
    if (loaded.status !== 'ready') throw new Error('expected ready');
    expect(loaded.snapshot.scenes[0]?.canvasCheckpoint?.state).toEqual({
      elements: [{ id: 'committed' }],
    });
    expect(loaded.snapshot.scenes[0]?.localDraft?.state).toEqual({
      elements: [{ id: 'offline' }],
    });
    adapter.dispose();
  });

  it('retains a stale specific intent for deliberate reconciliation without overwriting the winner', async () => {
    const factory = new IDBFactory();
    const first = new TableRepository({ factory, selection });
    const second = new TableRepository({ factory, selection });
    repositories.push(first, second);
    await first.start();
    await first.putSceneForTest(scene(first.workspaceIdentity), 0);
    await second.reload();
    const winner = createTableSceneAdapter({
      repository: first,
      sceneId: 'scene-1',
      campaignCode: 'CAMP',
      newOperationId: () => 'winner-marker',
    });
    const stale = createTableSceneAdapter({
      repository: second,
      sceneId: 'scene-1',
      campaignCode: 'CAMP',
      newOperationId: vi
        .fn<() => string>()
        .mockReturnValueOnce('stale-name')
        .mockReturnValueOnce('deliberate-retry'),
    });

    winner.updateBattleMap({
      markers: [{ id: 'winner-marker', title: '', body: '', dmNotes: '' }],
    });
    await winner.flush();
    stale.updateBattleMap({ name: 'Stale tab rename' });
    await stale.flush();

    const afterConflict = await first.reload();
    if (afterConflict.status !== 'ready') throw new Error('expected ready');
    expect(afterConflict.snapshot.scenes[0]).toMatchObject({
      map: { name: 'Table scene', markers: [{ id: 'winner-marker' }] },
    });
    expect(stale.getPendingConflict()).toMatchObject({
      fields: ['name'],
    });
    expect(stale.getBattleMap()).toMatchObject({
      name: 'Table scene',
      markers: [{ id: 'winner-marker' }],
    });

    await expect(stale.retryPendingConflict()).resolves.toBe('committed');
    const reconciled = await first.reload();
    if (reconciled.status !== 'ready') throw new Error('expected ready');
    expect(reconciled.snapshot.scenes[0]).toMatchObject({
      map: { name: 'Stale tab rename', markers: [{ id: 'winner-marker' }] },
    });
    expect(stale.getPendingConflict()).toBeNull();
    winner.dispose();
    stale.dispose();
  });
});

describe('Table movement resolution from scene members (item 10)', () => {
  it('resolves member tokens from the roster instead of linked encounters', async () => {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection });
    repositories.push(repository);
    await repository.start();
    const base = scene(repository.workspaceIdentity);
    base.members = [
      { actorId: 'npc-actor', tokenIds: [], sceneMemberId: 'member-npc' },
      {
        actorId: 'party-actor',
        tokenIds: [],
        sceneMemberId: 'member-party',
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
            actorId: 'npc-actor',
            actorKind: 'dm-managed',
            liveStats: {
              name: 'Barkeep',
              currentHp: 5,
              maxHp: 5,
              tempHp: 0,
              armorClass: 10,
              conditions: [],
            },
            playerReference: null,
            cachedPlayerData: null,
            playerConditionOverlay: null,
            profile: { category: 'npc', walkFeet: 25 },
            createdAt: '2026-10-05T00:00:00.000Z',
            updatedAt: '2026-10-05T00:00:00.000Z',
          },
          {
            schemaVersion: 1,
            workspaceKey: repository.workspaceIdentity,
            actorId: 'party-actor',
            actorKind: 'player-reference',
            liveStats: null,
            playerReference: { campaignId: 'CAMP', playerId: 'legacy-a' },
            cachedPlayerData: { name: 'Aria' },
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
    const adapter = createTableSceneAdapter({
      repository,
      sceneId: 'scene-1',
      campaignCode: 'CAMP',
    });
    expect(
      adapter.resolveMovement({ kind: 'combatant', key: 'member-npc' })
    ).toEqual({ name: 'Barkeep', walkFeet: 25, entityId: 'member-npc' });
    expect(
      adapter.resolveMovement({ kind: 'player', key: 'legacy-a' })
    ).toEqual({ name: 'Aria', walkFeet: 30, entityId: 'legacy-a' });
    expect(
      adapter.resolveMovement({ kind: 'combatant', key: 'unknown' })
    ).toBeNull();
    adapter.dispose();
  });
});

describe('GG3 offline fork slot', () => {
  async function setup() {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection });
    repositories.push(repository);
    await repository.start();
    await repository.putSceneForTest(scene(repository.workspaceIdentity), 0);
    let clock = 0;
    const adapter = createTableSceneAdapter({
      repository,
      sceneId: 'scene-1',
      campaignCode: 'CAMP',
      now: () => `2026-10-15T10:0${clock++}:00.000Z`,
    });
    const stored = async () => {
      const loaded = await repository.reload();
      if (loaded.status !== 'ready') throw new Error('expected ready');
      return loaded.snapshot.scenes[0]!;
    };
    return { repository, adapter, stored };
  }

  it('captures the offline version into its own slot, and later edits leave it alone', async () => {
    const { adapter, stored } = await setup();
    adapter.updateBattleMap({ canvasState: '{"elements":[{"id":"offline"}]}' });
    adapter.captureOfflineFork();
    adapter.updateBattleMap({ canvasState: '{"elements":[{"id":"live"}]}' });
    await adapter.flush();
    const record = await stored();
    expect(record.localDraft?.state).toEqual({ elements: [{ id: 'live' }] });
    expect(record.offlineFork).toMatchObject({
      replacedEarlier: false,
      draft: { state: { elements: [{ id: 'offline' }] } },
    });
    expect(adapter.getBattleMap()).toBeDefined();
    adapter.dispose();
  });

  it('keeps one slot: the newest wins and says it replaced an earlier one', async () => {
    const { adapter, stored } = await setup();
    adapter.updateBattleMap({ canvasState: '{"elements":[{"id":"first"}]}' });
    adapter.captureOfflineFork();
    adapter.updateBattleMap({ canvasState: '{"elements":[{"id":"second"}]}' });
    adapter.captureOfflineFork();
    await adapter.flush();
    expect((await stored()).offlineFork).toMatchObject({
      replacedEarlier: true,
      draft: { state: { elements: [{ id: 'second' }] } },
    });
    adapter.dispose();
  });

  it('captures nothing when there is no local version', async () => {
    const { adapter, stored } = await setup();
    adapter.captureOfflineFork();
    await adapter.flush();
    expect((await stored()).offlineFork ?? null).toBeNull();
    adapter.dispose();
  });

  it('clears the slot it was asked about, never a newer one', async () => {
    const { adapter, stored } = await setup();
    adapter.updateBattleMap({ canvasState: '{"elements":[{"id":"first"}]}' });
    adapter.captureOfflineFork();
    await adapter.flush();
    const first = (await stored()).offlineFork!;
    adapter.updateBattleMap({ canvasState: '{"elements":[{"id":"second"}]}' });
    adapter.captureOfflineFork();
    await expect(adapter.clearOfflineFork(first.savedAt)).resolves.toBe('gone');
    const second = (await stored()).offlineFork!;
    expect(second.draft.state).toEqual({ elements: [{ id: 'second' }] });
    await expect(adapter.clearOfflineFork(second.savedAt)).resolves.toBe(
      'cleared'
    );
    const record = await stored();
    expect(record.offlineFork ?? null).toBeNull();
    expect(record.localDraft?.state).toEqual({ elements: [{ id: 'second' }] });
    adapter.dispose();
  });
});

/** A fogged scene's canvas of realistic size: 40 fog tiles of 128×128 cells. */
function foggedCanvasState(marker: string): string {
  let seed = 7;
  const tile = () => {
    const bytes = new Uint8Array(128 * 128);
    for (let index = 0; index < bytes.length; index += 1) {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      bytes[index] = seed % 256;
    }
    return Buffer.from(bytes).toString('base64');
  };
  return JSON.stringify({
    elements: [{ id: marker }],
    layers: [],
    extensions: {
      fog: {
        pluginName: 'fog',
        version: 1,
        data: {
          tiles: Array.from({ length: 40 }, (_, index) => ({
            x: index % 8,
            y: Math.floor(index / 8),
            data: tile(),
          })),
        },
      },
    },
  });
}

describe('HH2 / HH4 / HH5 offline fork slot edges', () => {
  async function setup() {
    const factory = new IDBFactory();
    const repository = new TableRepository({ factory, selection });
    repositories.push(repository);
    await repository.start();
    await repository.putSceneForTest(scene(repository.workspaceIdentity), 0);
    let clock = 0;
    const adapter = createTableSceneAdapter({
      repository,
      sceneId: 'scene-1',
      campaignCode: 'CAMP',
      now: () => `2026-10-15T11:0${clock++}:00.000Z`,
    });
    const stored = async () => {
      const loaded = await repository.reload();
      if (loaded.status !== 'ready') throw new Error('expected ready');
      return loaded.snapshot.scenes[0]!;
    };
    return { factory, repository, adapter, stored };
  }

  it('keeps a fogged offline version of realistic size and still saves later edits', async () => {
    const { adapter, stored } = await setup();
    const offline = foggedCanvasState('offline');
    expect(offline.length).toBeGreaterThan(800_000);
    adapter.updateBattleMap({ canvasState: offline });
    await expect(adapter.captureOfflineFork()).resolves.toBe(true);
    adapter.updateBattleMap({ canvasState: foggedCanvasState('later') });
    await adapter.flush();
    expect(adapter.getPendingConflict()).toBeNull();
    const record = await stored();
    expect(record.offlineFork?.draft.state.elements).toEqual([
      { id: 'offline' },
    ]);
    expect(record.localDraft?.state.elements).toEqual([{ id: 'later' }]);
    adapter.dispose();
  });

  it('II3: saves a 2 MiB local draft and keeps it as a 2 MiB offline slot', async () => {
    const { adapter, stored } = await setup();
    const big = JSON.stringify({
      elements: [{ id: 'big' }],
      blob: 'x'.repeat(2 * 1_048_576),
    });
    adapter.updateBattleMap({ canvasState: big });
    await adapter.flush();
    expect(adapter.getPendingConflict()).toBeNull();
    expect((await stored()).localDraft?.state.elements).toEqual([
      { id: 'big' },
    ]);
    await expect(adapter.captureOfflineFork()).resolves.toBe(true);
    expect((await stored()).offlineFork?.draft.state.elements).toEqual([
      { id: 'big' },
    ]);
    adapter.dispose();
  });

  it('says when the offline version could not be kept', async () => {
    const { repository, adapter } = await setup();
    adapter.updateBattleMap({ canvasState: '{"elements":[{"id":"offline"}]}' });
    await adapter.flush();
    vi.spyOn(repository, 'mutateWorkspace').mockResolvedValue({
      status: 'rejected',
      reason: 'limit-exceeded',
    } as never);
    await expect(adapter.captureOfflineFork()).resolves.toBe(false);
    adapter.dispose();
  });

  it('retries once after another tab moved the workspace on', async () => {
    const { factory, adapter, stored } = await setup();
    adapter.updateBattleMap({ canvasState: '{"elements":[{"id":"offline"}]}' });
    await adapter.flush();
    const other = new TableRepository({ factory, selection });
    repositories.push(other);
    const loaded = await other.start();
    if (loaded.status !== 'ready') throw new Error('expected ready');
    const bumped = await other.mutateWorkspace(
      loaded.snapshot.campaign?.revision ?? 0,
      `other-tab:${crypto.randomUUID()}`,
      {
        scenes: {
          put: [
            {
              ...loaded.snapshot.scenes[0]!,
              updatedAt: '2026-10-15T12:00:00.000Z',
            },
          ],
        },
      }
    );
    expect(bumped.status).toBe('committed');
    await expect(adapter.captureOfflineFork()).resolves.toBe(true);
    expect((await stored()).offlineFork?.draft.state).toEqual({
      elements: [{ id: 'offline' }],
    });
    adapter.dispose();
  });

  it('keeps the newest offline edit even when it is still waiting as a conflict', async () => {
    const { factory, repository, adapter, stored } = await setup();
    adapter.updateBattleMap({ canvasState: '{"elements":[{"id":"older"}]}' });
    await adapter.flush();
    // Another tab moves the workspace on: the next local save conflicts.
    const other = new TableRepository({ factory, selection });
    repositories.push(other);
    const loaded = await other.start();
    if (loaded.status !== 'ready') throw new Error('expected ready');
    const bumped = await other.mutateWorkspace(
      loaded.snapshot.campaign?.revision ?? 0,
      `other-tab:${crypto.randomUUID()}`,
      {
        scenes: {
          put: [
            {
              ...loaded.snapshot.scenes[0]!,
              updatedAt: '2026-10-15T12:00:00.000Z',
            },
          ],
        },
      }
    );
    expect(bumped.status).toBe('committed');
    adapter.updateBattleMap({ canvasState: '{"elements":[{"id":"newest"}]}' });
    await adapter.flush();
    expect(adapter.getPendingConflict()).not.toBeNull();
    await repository.reload();
    await expect(adapter.captureOfflineFork()).resolves.toBe(true);
    expect((await stored()).offlineFork?.draft.state).toEqual({
      elements: [{ id: 'newest' }],
    });
    adapter.dispose();
  });

  it('tells a cleared slot from one that was already gone', async () => {
    const { adapter } = await setup();
    adapter.updateBattleMap({ canvasState: '{"elements":[{"id":"offline"}]}' });
    await adapter.captureOfflineFork();
    const loaded = await (async () => {
      await adapter.flush();
      return adapter;
    })();
    const savedAt = '2026-10-15T11:01:00.000Z';
    await expect(loaded.clearOfflineFork(savedAt)).resolves.toBe('cleared');
    await expect(loaded.clearOfflineFork(savedAt)).resolves.toBe('gone');
    adapter.dispose();
  });
});
