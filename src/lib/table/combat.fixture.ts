import { IDBFactory } from 'fake-indexeddb';

import { TableRepository, type TableWorkspaceSelection } from './repository';
import type {
  JsonObject,
  TableActorRecordV1,
  TableEncounterRecordV1,
  TableSceneRecordV1,
  TableSourceRecordV1,
} from './schema';

/**
 * Shared synthetic scene for combat tests: two creatures, a manual PC, a
 * party member (player reference), a PR01-adopted PC (`enc-1:pc-1`, carried
 * by an imported legacy-active run) and a removed member.
 */
export const AT = '2026-10-07T00:00:00.000Z';
export const SCENE_ID = 'scene-1';
export const ADOPTED_PC = 'enc-1:pc-1';
export const IMPORTED_RUN = 'run-adopted';

export const fixtureSelection: TableWorkspaceSelection = {
  account: { kind: 'authenticated', accountId: 'account-combat' },
  workspace: { localWorkspaceId: 'workspace-combat' },
};

export function managedActor(
  workspaceKey: string,
  actorId: string,
  name: string,
  category?: 'pc' | 'npc' | 'monster',
  patch: Partial<TableActorRecordV1['liveStats'] & object> = {}
): TableActorRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    actorId,
    actorKind: 'dm-managed',
    liveStats: {
      name,
      currentHp: 10,
      maxHp: 10,
      tempHp: 0,
      armorClass: 13,
      conditions: [],
      ...patch,
    },
    playerReference: null,
    cachedPlayerData: null,
    playerConditionOverlay: null,
    ...(category ? { profile: { category } } : {}),
    createdAt: AT,
    updatedAt: AT,
  };
}

export function playerActor(
  workspaceKey: string,
  actorId = 'aria',
  legacyPlayerId = 'legacy-aria',
  overlay: TableActorRecordV1['playerConditionOverlay'] = {
    suppressedSourceConditionIds: [],
    dmConditions: [],
  }
): TableActorRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    actorId,
    actorKind: 'player-reference',
    liveStats: null,
    playerReference: {
      campaignId: 'CAMP',
      playerId: legacyPlayerId,
      legacyPlayerId,
    },
    cachedPlayerData: { name: 'Aria' } as JsonObject,
    playerConditionOverlay: overlay,
    createdAt: AT,
    updatedAt: AT,
  };
}

export function fixtureScene(workspaceKey: string): TableSceneRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    sceneId: SCENE_ID,
    originalMapId: 'map-1',
    map: {
      name: 'Secret Lair Of The Lich',
      mapImageUrl: '/map.webp',
      mapImageSize: { w: 10, h: 10 },
      gridEnabled: false,
      gridSettings: null,
      markers: [],
      dmOnlyElements: {},
    },
    canvasCheckpoint: {
      protocolVersion: 1,
      generation: 'generation-1',
      revision: 2,
      capturedAt: AT,
      state: {
        elements: [{ id: 'token-goblin', sceneMemberId: 'm-goblin' }],
        layers: [],
        extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
      },
    },
    members: [
      {
        actorId: 'goblin',
        tokenIds: ['token-goblin'],
        sceneMemberId: 'm-goblin',
      },
      { actorId: 'orc', tokenIds: [], sceneMemberId: 'm-orc' },
      { actorId: 'knight', tokenIds: [], sceneMemberId: 'm-knight' },
      {
        actorId: 'aria',
        tokenIds: [],
        sceneMemberId: 'm-aria',
        control: { kind: 'player', legacyPlayerId: 'legacy-aria' },
      },
      { actorId: ADOPTED_PC, tokenIds: [], sceneMemberId: 'm-pc1' },
      {
        actorId: 'ghost',
        tokenIds: [],
        sceneMemberId: 'm-ghost',
        removedAt: AT,
      },
      { actorId: 'bard', tokenIds: [], sceneMemberId: 'm-bard' },
    ],
    arrivalPoint: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

async function sha256(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(raw)
  );
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function adoptedSource(
  workspaceKey: string
): Promise<TableSourceRecordV1> {
  const rawJson = JSON.stringify({
    id: 'enc-1',
    name: 'Old fight',
    entities: [
      {
        id: 'pc-1',
        type: 'player',
        name: 'Bran',
        playerCharacterId: 'legacy-bran',
      },
    ],
  });
  return {
    schemaVersion: 1,
    workspaceKey,
    sourceKey: 'encounter:enc-1',
    sourceKind: 'encounter',
    sourceId: 'enc-1',
    rawJson,
    sha256: await sha256(rawJson),
    byteCount: new TextEncoder().encode(rawJson).byteLength,
    capturedAt: AT,
  };
}

export function importedRun(workspaceKey: string): TableEncounterRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    runId: IMPORTED_RUN,
    sceneId: SCENE_ID,
    sourceEncounterId: 'enc-1',
    runGeneration: 'adoption-generation',
    participants: [
      {
        actorId: ADOPTED_PC,
        initiative: 14,
        turnResources: { reactionAvailable: true, legendaryActionsUsed: 0 },
      },
    ],
    round: 3,
    currentActorId: ADOPTED_PC,
    isActive: true,
    createdAt: AT,
    updatedAt: AT,
  };
}

export const repositories: TableRepository[] = [];

export async function openFixture(
  options: {
    factory?: IDBFactory;
    beforeTransactionCommit?: ConstructorParameters<
      typeof TableRepository
    >[0]['beforeTransactionCommit'];
    seed?: boolean;
  } = {}
): Promise<TableRepository> {
  const repository = new TableRepository({
    factory: options.factory ?? new IDBFactory(),
    selection: fixtureSelection,
    broadcastChannel: null,
    events: null,
    now: () => AT,
    beforeTransactionCommit: options.beforeTransactionCommit,
  });
  repositories.push(repository);
  await repository.start();
  if (options.seed === false) return repository;
  const key = repository.workspaceIdentity;
  const seeded = await repository.mutateWorkspace(0, 'fixture-seed', {
    scenes: { put: [fixtureScene(key)] },
    actors: {
      put: [
        managedActor(key, 'goblin', 'Goblin', 'monster'),
        managedActor(key, 'orc', 'Orc', 'npc', { currentHp: 15, maxHp: 15 }),
        managedActor(key, 'knight', 'Knight', 'pc'),
        playerActor(key),
        managedActor(key, ADOPTED_PC, 'Bran', undefined, {
          currentHp: 22,
          maxHp: 30,
        }),
        managedActor(key, 'ghost', 'Ghost', 'monster'),
        managedActor(key, 'bard', 'Bard', 'npc'),
      ],
    },
    encounters: { put: [importedRun(key)] },
    sources: { put: [await adoptedSource(key)] },
  });
  if (seeded.status !== 'committed') {
    throw new Error(`fixture seed failed: ${JSON.stringify(seeded)}`);
  }
  return repository;
}

export function readySnapshot(repository: TableRepository) {
  const current = repository.getCurrent();
  if (current?.status !== 'ready') throw new Error('repository not ready');
  return current.snapshot;
}

export function revisionOf(repository: TableRepository): number {
  return readySnapshot(repository).campaign?.revision ?? 0;
}
