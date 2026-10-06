import type { BattleMap, MarkerDetail } from '@/types/battlemap';

import type { MarkerProductStateAdapter } from '@/components/ui/campaign/location-map/useMarkerWrites';
import type { MovementResolution } from '@/components/ui/campaign/location-map/movementTool';
import type { MovableTokenIdentity } from '@/components/ui/campaign/location-map/tokenIdentity';
import { sceneCheckpointToViewportState } from './checkpoint';
import {
  resolveTableWorkspaceSelection,
  TableRepository,
  type TableRepositoryOptions,
  type TableWorkspaceSelection,
} from './repository';
import { deriveSceneRoster } from './roster';
import type { JsonObject, TableSceneRecordV1 } from './schema';

const DEFAULT_WALK_FEET = 30;

function parseCanvasState(value: string): JsonObject {
  const parsed = JSON.parse(value) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Canvas state must be a JSON object');
  }
  return parsed as JsonObject;
}

function asBattleMap(
  scene: TableSceneRecordV1,
  campaignCode: string,
  linkedEncounterIds: string[]
): BattleMap {
  return {
    id: scene.sceneId,
    campaignCode,
    name: scene.map.name,
    mapImageUrl: scene.map.mapImageUrl,
    mapImageSize: structuredClone(scene.map.mapImageSize),
    canvasState: JSON.stringify(
      scene.localDraft?.state ??
        (scene.canvasCheckpoint
          ? sceneCheckpointToViewportState(scene.canvasCheckpoint)
          : {})
    ),
    dmOnlyElements: structuredClone(scene.map.dmOnlyElements),
    gridEnabled: scene.map.gridEnabled,
    ...(scene.map.gridSettings
      ? { gridSettings: structuredClone(scene.map.gridSettings) as never }
      : {}),
    linkedEncounterIds,
    ...(scene.map.cameraViews
      ? { cameraViews: structuredClone(scene.map.cameraViews) as never }
      : {}),
    ...(scene.map.fogAppearance !== undefined
      ? { fogAppearance: structuredClone(scene.map.fogAppearance) as never }
      : {}),
    markers: structuredClone(scene.map.markers) as unknown as MarkerDetail[],
    createdAt: scene.createdAt,
    updatedAt: scene.updatedAt,
  };
}

export interface TableSceneAdapter {
  readonly sceneId: string;
  readonly sourceMapId: string;
  subscribe(listener: () => void): () => void;
  getBattleMap(): BattleMap | undefined;
  updateBattleMap(updates: Partial<BattleMap>): void;
  setDmOnly(elementId: string, dmOnly: boolean): void;
  toggleDmOnly(elementId: string): void;
  markerProductState: MarkerProductStateAdapter;
  getLocalEditGeneration(): number;
  /**
   * Table movement resolution comes from scene members (never linked
   * encounters): member id or adopted entity id for DM-managed tokens,
   * the verified player id for party tokens.
   */
  resolveMovement(identity: MovableTokenIdentity): MovementResolution | null;
  getPendingConflict(): {
    operationId: string;
    fields: string[];
    createdAt: string;
  } | null;
  refreshPendingConflict(): Promise<boolean>;
  retryPendingConflict(): Promise<'committed' | 'conflict' | 'failed' | 'none'>;
  discardPendingConflict(): void;
  flush(): Promise<void>;
  dispose(): void;
}

export function isTableWorkspaceBoundToCampaign(
  selection: TableWorkspaceSelection,
  campaignCode: string
): boolean {
  return (
    (selection.workspace.routeCampaignCode ??
      selection.workspace.sourceCampaignCode ??
      null) === campaignCode
  );
}

/**
 * Isolated scene command adapter used by the canvas. Every callback writes
 * only the Table repository; it intentionally has no dependency on Zustand,
 * legacy source routes, cloud families or browser localStorage.
 */
export function createTableSceneAdapter(options: {
  repository: TableRepository;
  sceneId: string;
  campaignCode: string;
  newOperationId?: () => string;
  now?: () => string;
}): TableSceneAdapter {
  const listeners = new Set<() => void>();
  const newOperationId = options.newOperationId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date().toISOString());
  let scene: TableSceneRecordV1 | undefined;
  let linkedEncounterIds: string[] = [];
  let queue = Promise.resolve();
  let disposed = false;
  let localEditGeneration = 0;
  type SceneEditIntent = {
    operationId: string;
    updates: Partial<BattleMap>;
    timestamp: string;
  };
  const pendingConflicts: SceneEditIntent[] = [];

  const hydrate = () => {
    const current = options.repository.getCurrent();
    if (current?.status !== 'ready') {
      scene = undefined;
      linkedEncounterIds = [];
      return;
    }
    scene = current.snapshot.scenes.find(
      value => value.sceneId === options.sceneId
    );
    linkedEncounterIds = current.snapshot.encounters
      .filter(value => value.sceneId === options.sceneId)
      .map(value => value.runId);
  };
  hydrate();
  const unsubscribe = options.repository.subscribe(() => {
    hydrate();
    listeners.forEach(listener => listener());
  });

  const applyIntent = (
    base: TableSceneRecordV1,
    intent: SceneEditIntent
  ): TableSceneRecordV1 => {
    const updates = intent.updates;
    const next = structuredClone(base);
    next.updatedAt = intent.timestamp;
    if (updates.name !== undefined) next.map.name = updates.name;
    if (updates.mapImageUrl !== undefined)
      next.map.mapImageUrl = updates.mapImageUrl;
    if (updates.mapImageSize !== undefined)
      next.map.mapImageSize = structuredClone(updates.mapImageSize);
    if (updates.gridEnabled !== undefined)
      next.map.gridEnabled = updates.gridEnabled;
    if (updates.gridSettings !== undefined)
      next.map.gridSettings = structuredClone(updates.gridSettings) as never;
    if (updates.markers !== undefined)
      next.map.markers = structuredClone(
        updates.markers
      ) as unknown as JsonObject[];
    if (updates.dmOnlyElements !== undefined)
      next.map.dmOnlyElements = structuredClone(updates.dmOnlyElements);
    if (updates.cameraViews !== undefined)
      next.map.cameraViews = structuredClone(updates.cameraViews) as never;
    if (updates.fogAppearance !== undefined)
      next.map.fogAppearance = structuredClone(updates.fogAppearance) as never;
    if (updates.canvasState !== undefined) {
      next.localDraft = {
        protocolVersion: 1,
        generation:
          next.canvasCheckpoint?.generation ?? `offline:${options.sceneId}`,
        revision: (next.localDraft?.revision ?? 0) + 1,
        capturedAt: intent.timestamp,
        state: parseCanvasState(updates.canvasState),
      };
    }
    return next;
  };

  const pendingView = () => {
    const intent = pendingConflicts[0];
    return intent
      ? {
          operationId: intent.operationId,
          fields: Object.keys(intent.updates).sort(),
          createdAt: intent.timestamp,
        }
      : null;
  };

  const persist = (intent: SceneEditIntent) => {
    queue = queue.then(async () => {
      if (disposed) return;
      if (pendingConflicts.length > 0) {
        pendingConflicts.push(intent);
        listeners.forEach(listener => listener());
        return;
      }
      const current = options.repository.getCurrent();
      if (current?.status !== 'ready') return;
      const stored = current.snapshot.scenes.find(
        value => value.sceneId === options.sceneId
      );
      if (!stored) return;
      const candidate = {
        ...applyIntent(stored, intent),
        workspaceKey: stored.workspaceKey,
      };
      const result = await options.repository.mutateWorkspace(
        current.snapshot.campaign?.revision ?? 0,
        `scene-edit:${intent.operationId}`,
        { scenes: { put: [candidate] } }
      );
      if (result.status === 'conflict') {
        pendingConflicts.push(intent);
        await options.repository.reload();
        listeners.forEach(listener => listener());
      } else if (result.status !== 'committed') {
        pendingConflicts.push(intent);
        listeners.forEach(listener => listener());
      }
    });
  };

  const updateBattleMap = (updates: Partial<BattleMap>) => {
    if (!scene || disposed) return;
    localEditGeneration += 1;
    const intent: SceneEditIntent = {
      operationId: newOperationId(),
      updates: structuredClone(updates),
      timestamp: updates.updatedAt ?? now(),
    };
    scene = applyIntent(scene, intent);
    listeners.forEach(listener => listener());
    persist(intent);
  };

  const setDmOnly = (elementId: string, dmOnly: boolean) => {
    if (!scene) return;
    const dmOnlyElements = { ...scene.map.dmOnlyElements };
    if (dmOnly) dmOnlyElements[elementId] = true;
    else delete dmOnlyElements[elementId];
    updateBattleMap({ dmOnlyElements });
  };
  const markerProductState: MarkerProductStateAdapter = {
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getMarkers: () =>
      (scene?.map.markers as unknown as readonly MarkerDetail[] | undefined) ??
      [],
    setMarkers: markers =>
      updateBattleMap({ markers: structuredClone(markers) }),
    getDmOnlyElements: () => scene?.map.dmOnlyElements ?? {},
    setDmOnly,
    setDmOnlyBulk: updates => {
      if (!scene) return;
      const dmOnlyElements = { ...scene.map.dmOnlyElements };
      for (const [id, value] of Object.entries(updates)) {
        if (value) dmOnlyElements[id] = true;
        else delete dmOnlyElements[id];
      }
      updateBattleMap({ dmOnlyElements });
    },
    isReadable: () => scene !== undefined,
  };

  return {
    get sceneId() {
      return options.sceneId;
    },
    get sourceMapId() {
      return scene?.originalMapId ?? options.sceneId;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getBattleMap: () =>
      scene
        ? asBattleMap(scene, options.campaignCode, linkedEncounterIds)
        : undefined,
    updateBattleMap,
    setDmOnly,
    toggleDmOnly: elementId =>
      setDmOnly(elementId, !scene?.map.dmOnlyElements[elementId]),
    markerProductState,
    getLocalEditGeneration: () => localEditGeneration,
    resolveMovement: identity => {
      const current = options.repository.getCurrent();
      if (current?.status !== 'ready') return null;
      const roster = deriveSceneRoster({
        snapshot: current.snapshot,
        sceneId: options.sceneId,
      });
      const entry = roster.entries.find(
        item =>
          !item.removed &&
          (identity.kind === 'combatant'
            ? item.sceneMemberId === identity.key ||
              item.sourceEntityId === identity.key
            : (item.control.kind === 'player' &&
                item.control.legacyPlayerId === identity.key) ||
              item.verifiedLegacyPlayerId === identity.key)
      );
      return entry
        ? {
            name: entry.name,
            walkFeet: entry.walkFeet ?? DEFAULT_WALK_FEET,
            entityId: identity.key,
          }
        : null;
    },
    getPendingConflict: pendingView,
    refreshPendingConflict: async () => {
      const attempt = queue.then(async () => {
        if (disposed || pendingConflicts.length === 0) return false;
        const result = await options.repository.reload();
        listeners.forEach(listener => listener());
        return result.status === 'ready';
      });
      queue = attempt.then(() => undefined);
      return attempt;
    },
    retryPendingConflict: async () => {
      const attempt = queue.then(async () => {
        const intent = pendingConflicts[0];
        if (disposed || !intent) return 'none' as const;
        const current = await options.repository.reload();
        if (current.status !== 'ready') return 'failed' as const;
        const stored = current.snapshot.scenes.find(
          value => value.sceneId === options.sceneId
        );
        if (!stored) return 'failed' as const;
        const candidate = applyIntent(stored, intent);
        const result = await options.repository.mutateWorkspace(
          current.snapshot.campaign?.revision ?? 0,
          `scene-edit:${newOperationId()}`,
          { scenes: { put: [candidate] } }
        );
        if (result.status === 'committed') {
          pendingConflicts.shift();
          listeners.forEach(listener => listener());
          return 'committed' as const;
        }
        if (result.status === 'conflict') {
          await options.repository.reload();
          listeners.forEach(listener => listener());
          return 'conflict' as const;
        }
        return 'failed' as const;
      });
      queue = attempt.then(() => undefined);
      return attempt;
    },
    discardPendingConflict: () => {
      if (pendingConflicts.length === 0) return;
      pendingConflicts.shift();
      hydrate();
      listeners.forEach(listener => listener());
    },
    flush: () => queue,
    dispose: () => {
      disposed = true;
      unsubscribe();
      listeners.clear();
    },
  };
}

/** Resolves the immutable per-account local workspace used by Table routes. */
export async function openTableWorkspace(options: {
  factory?: IDBFactory | null;
  account: TableWorkspaceSelection['account'];
  sourceCampaignCode: string;
  localWorkspaceId?: string | null;
  repositoryOptions?: Omit<TableRepositoryOptions, 'factory' | 'selection'>;
}): Promise<{
  selection: TableWorkspaceSelection;
  repository: TableRepository;
}> {
  const selection = await resolveTableWorkspaceSelection({
    factory: options.factory,
    account: options.account,
    workspace: options.localWorkspaceId
      ? {
          localWorkspaceId: options.localWorkspaceId,
          routeCampaignCode: options.sourceCampaignCode,
        }
      : {
          sourceCampaignCode: options.sourceCampaignCode,
          routeCampaignCode: options.sourceCampaignCode,
        },
    requireExistingLocalWorkspace: Boolean(options.localWorkspaceId),
  });
  const repository = new TableRepository({
    ...options.repositoryOptions,
    factory: options.factory,
    selection,
  });
  await repository.start();
  return { selection, repository };
}
