import type {
  AuthorityBarrier,
  AuthorityCheckpointPayload,
} from '@fieldnotes/sync';

import type { BattleMapConnection } from '@/lib/battlemapSync';

import { canvasStateToAuthorityState } from './authorityLifecycle';
import type { TableRepository } from './repository';
import type {
  JsonObject,
  TableCanvasCheckpointV1,
  TableSceneRecordV1,
} from './schema';

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function jsonClone(value: unknown): JsonObject | null {
  try {
    const parsed = JSON.parse(JSON.stringify(value)) as unknown;
    return object(parsed) as JsonObject | null;
  } catch {
    return null;
  }
}

/**
 * Validates the S6 durable shape in addition to the SDK's transport checks.
 * Fog is mandatory for a Table checkpoint, including the explicit null-data
 * form, so a canvas can never be restored with visibility silently widened.
 */
export function validateSceneAuthorityCheckpoint(
  value: unknown,
  barrier: AuthorityBarrier
): JsonObject | null {
  const checkpoint = object(value);
  const cursor = object(checkpoint?.cursor);
  const extensions = object(checkpoint?.extensions);
  const fog = object(extensions?.fog);
  if (
    !checkpoint ||
    !Array.isArray(checkpoint.elements) ||
    !Array.isArray(checkpoint.layers) ||
    !cursor ||
    typeof cursor.generation !== 'string' ||
    cursor.generation !== barrier.generation ||
    !Number.isSafeInteger(cursor.revision) ||
    Number(cursor.revision) < 0 ||
    typeof cursor.streamId !== 'string' ||
    cursor.streamId.length === 0 ||
    typeof checkpoint.casToken !== 'string' ||
    checkpoint.casToken.length === 0 ||
    !extensions ||
    !fog ||
    typeof fog.pluginName !== 'string' ||
    !Number.isSafeInteger(fog.version) ||
    (!object(fog.data) && fog.data !== null)
  ) {
    return null;
  }
  if (fog.data !== null) {
    const data = object(fog.data);
    const meta = object(data?.meta);
    if (!data || !meta || !Array.isArray(data.tiles)) return null;
    if (
      typeof meta.version !== 'number' ||
      !Number.isSafeInteger(meta.version) ||
      typeof meta.editor !== 'string'
    ) {
      return null;
    }
  }
  return jsonClone(checkpoint);
}

export type SceneCheckpointSaveResult =
  | { status: 'committed'; revision: number; pending: boolean }
  | {
      status: 'not-saved';
      reason:
        | 'authority-unavailable'
        | 'barrier-unavailable'
        | 'receipts-not-acknowledged'
        | 'checkpoint-failed'
        | 'invalid-checkpoint';
    }
  | Exclude<
      Awaited<ReturnType<TableRepository['mutateWorkspace']>>,
      { status: 'committed' }
    >;

export async function saveSceneCheckpoint(options: {
  repository: TableRepository;
  connection: BattleMapConnection;
  sceneId: string;
  expectedRevision: number;
  operationId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  now?: () => string;
  getLocalEditGeneration?: () => number;
  hasNewLocalEditsSinceBarrier?: () => boolean;
}): Promise<SceneCheckpointSaveResult> {
  const connection = options.connection;
  if (
    !connection.captureBarrier ||
    !connection.waitForAcknowledgements ||
    !connection.requestCheckpoint ||
    !connection.releaseBarrier
  ) {
    return { status: 'not-saved', reason: 'authority-unavailable' };
  }
  const barrier = connection.captureBarrier();
  if (!barrier || !barrier.generation) {
    return { status: 'not-saved', reason: 'barrier-unavailable' };
  }
  try {
    const receipts = await connection.waitForAcknowledgements(barrier, {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    });
    if (
      receipts.status !== 'acknowledged' ||
      receipts.rejectedIds.length > 0 ||
      receipts.uncertainIds.length > 0 ||
      receipts.outstandingIds.length > 0
    ) {
      return { status: 'not-saved', reason: 'receipts-not-acknowledged' };
    }
    const captured = await connection.requestCheckpoint({
      barrier,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    });
    if (captured.status !== 'complete') {
      return { status: 'not-saved', reason: 'checkpoint-failed' };
    }
    if (
      captured.barrier?.barrierId !== barrier.barrierId ||
      captured.barrier.generation !== barrier.generation
    ) {
      return { status: 'not-saved', reason: 'invalid-checkpoint' };
    }
    const state = validateSceneAuthorityCheckpoint(
      captured.checkpoint,
      barrier
    );
    if (!state) return { status: 'not-saved', reason: 'invalid-checkpoint' };

    const current = options.repository.getCurrent();
    if (current?.status !== 'ready') {
      return { status: 'not-saved', reason: 'invalid-checkpoint' };
    }
    const scene = current.snapshot.scenes.find(
      value => value.sceneId === options.sceneId
    );
    if (!scene) return { status: 'not-saved', reason: 'invalid-checkpoint' };
    const cursor = (captured.checkpoint as AuthorityCheckpointPayload).cursor;
    const now = (options.now ?? (() => new Date().toISOString()))();
    const pending =
      options.hasNewLocalEditsSinceBarrier?.() === true ||
      (options.getLocalEditGeneration?.() ?? barrier.localEditGeneration) >
        barrier.localEditGeneration;
    const canvasCheckpoint: TableCanvasCheckpointV1 = {
      protocolVersion: 1,
      generation: cursor.generation,
      revision: cursor.revision,
      capturedAt: now,
      state,
    };
    const nextScene: TableSceneRecordV1 = {
      ...structuredClone(scene),
      canvasCheckpoint,
      ...(pending
        ? scene.localDraft === undefined
          ? {}
          : { localDraft: scene.localDraft }
        : { localDraft: null }),
      updatedAt: now,
    };
    const outcome = await options.repository.mutateWorkspace(
      options.expectedRevision,
      options.operationId,
      { scenes: { put: [nextScene] } }
    );
    if (outcome.status !== 'committed') return outcome;
    return {
      status: 'committed',
      revision: outcome.revision,
      pending,
    };
  } finally {
    connection.releaseBarrier(barrier);
  }
}

export interface SceneCanvasPersistenceAdapter {
  readonly sceneId: string;
  read(): TableSceneRecordV1;
  writeLocalDraft(state: JsonObject): void;
  readLocalDraft(): JsonObject | null;
  discardLocalDraft(): void;
  status(): {
    relay: 'connected' | 'disconnected';
    localOperationsPending: boolean;
    localDraftSaved: boolean;
    authoritativeCheckpointCommitted: boolean;
  };
}

/**
 * Authority checkpoints are relay documents, not Viewport JSON. In
 * particular, layers are versioned records and extensions carry a transport
 * plugin name. Translate those wrappers before handing persisted data to
 * `Viewport.loadJSON()`.
 */
export function sceneCheckpointToViewportState(
  checkpoint: TableCanvasCheckpointV1
): JsonObject {
  const state = object(checkpoint.state);
  const cursor = object(state?.cursor);
  if (!state || !cursor || !Array.isArray(state.layers)) {
    return structuredClone(checkpoint.state);
  }
  const layers = state.layers.flatMap(value => {
    const item = object(value);
    const definition = object(item?.definition);
    return definition ? [structuredClone(definition) as JsonObject] : [];
  });
  const extensions = object(state.extensions) ?? {};
  const viewportExtensions = Object.fromEntries(
    Object.entries(extensions).flatMap(([key, value]) => {
      const extension = object(value);
      if (
        !extension ||
        !Number.isSafeInteger(extension.version) ||
        !Object.hasOwn(extension, 'data')
      ) {
        return [];
      }
      return [
        [
          key,
          {
            version: Number(extension.version),
            data: structuredClone(extension.data) as JsonObject[string],
          },
        ],
      ];
    })
  ) as JsonObject;
  const firstLayer = layers[0];
  return {
    version: 4,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
    elements: structuredClone(state.elements ?? []) as JsonObject[string],
    layers,
    ...(typeof firstLayer?.id === 'string'
      ? { activeLayerId: firstLayer.id }
      : {}),
    extensions: viewportExtensions,
  };
}

/**
 * Session-local draft holder. It deliberately never calls legacy seedLocal or
 * any legacy source writer; durable writes are made only by the guarded
 * checkpoint/restore functions.
 */
export function createSceneCanvasPersistenceAdapter(options: {
  scene: () => TableSceneRecordV1;
}): SceneCanvasPersistenceAdapter {
  let draft: JsonObject | null = null;
  const relay: 'connected' | 'disconnected' = 'disconnected';
  return {
    get sceneId() {
      return options.scene().sceneId;
    },
    read: () => structuredClone(options.scene()),
    writeLocalDraft: state => {
      draft = structuredClone(state);
    },
    readLocalDraft: () => (draft ? structuredClone(draft) : null),
    discardLocalDraft: () => {
      draft = null;
    },
    status: () => ({
      relay,
      localOperationsPending: draft !== null,
      localDraftSaved: draft !== null,
      authoritativeCheckpointCommitted:
        options.scene().canvasCheckpoint !== null,
    }),
  };
}

export async function restoreSceneCheckpoint(options: {
  repository: TableRepository;
  sceneId: string;
  checkpoint: TableCanvasCheckpointV1;
  expectedRevision: number;
  operationId: string;
}): Promise<Awaited<ReturnType<TableRepository['mutateWorkspace']>>> {
  const current = options.repository.getCurrent();
  const scene =
    current?.status === 'ready'
      ? current.snapshot.scenes.find(value => value.sceneId === options.sceneId)
      : undefined;
  if (!scene) {
    return { status: 'rejected', reason: 'invalid-reference' };
  }
  return options.repository.mutateWorkspace(
    options.expectedRevision,
    options.operationId,
    {
      scenes: {
        put: [
          {
            ...structuredClone(scene),
            canvasCheckpoint: structuredClone(options.checkpoint),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    }
  );
}

export type AuthorityRestoreResult =
  | { status: 'restored' }
  | { status: 'conflict' }
  | { status: 'failed'; reason: 'capture' | 'invalid-current' | 'restore' };

/**
 * Explicit recovery only: capture the current generation/CAS, then ask the
 * guarded initialize/replace endpoint to publish the retained fork. Two
 * restorers racing with the same guard cannot both win.
 */
export async function restoreAuthorityFork(options: {
  campaignCode: string;
  dmId: string;
  sceneId: string;
  checkpoint: TableCanvasCheckpointV1;
  fetcher?: typeof fetch;
}): Promise<AuthorityRestoreResult> {
  const fetcher = options.fetcher ?? fetch;
  const base = `/api/campaign/${encodeURIComponent(options.campaignCode)}/table/authority`;
  let currentResponse: Response;
  try {
    currentResponse = await fetcher(`${base}/checkpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dmId: options.dmId, sceneId: options.sceneId }),
    });
  } catch {
    return { status: 'failed', reason: 'capture' };
  }
  if (!currentResponse.ok) return { status: 'failed', reason: 'capture' };
  const current = object((await currentResponse.json()) as unknown);
  const nested = object(current?.checkpoint);
  const cursor = object(nested?.cursor);
  const expectedGeneration =
    typeof current?.generation === 'string'
      ? current.generation
      : typeof cursor?.generation === 'string'
        ? cursor.generation
        : null;
  const expectedCasToken =
    typeof current?.casToken === 'string'
      ? current.casToken
      : typeof nested?.casToken === 'string'
        ? nested.casToken
        : null;
  if (!expectedGeneration || !expectedCasToken) {
    return { status: 'failed', reason: 'invalid-current' };
  }
  const rawRetained = object(options.checkpoint.state);
  const retained = object(rawRetained?.cursor)
    ? rawRetained
    : object(
        canvasStateToAuthorityState(options.checkpoint.state, options.dmId)
      );
  if (
    !retained ||
    !Array.isArray(retained.elements) ||
    !Array.isArray(retained.layers) ||
    !object(retained.extensions)?.fog
  ) {
    return { status: 'failed', reason: 'restore' };
  }
  let response: Response;
  try {
    response = await fetcher(`${base}/initialize-if-empty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dmId: options.dmId,
        sceneId: options.sceneId,
        expectedGeneration,
        expectedCasToken,
        state: {
          elements: retained.elements,
          layers: retained.layers,
          extensions: retained.extensions,
        },
      }),
    });
  } catch {
    return { status: 'failed', reason: 'restore' };
  }
  if (response.status === 409) return { status: 'conflict' };
  return response.ok
    ? { status: 'restored' }
    : { status: 'failed', reason: 'restore' };
}
