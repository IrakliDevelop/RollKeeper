import type { TableRepository, TableWorkspaceMutation } from './repository';
import {
  canonicalJson,
  type TableCommitResult,
  type TableSceneRecordV1,
  type TableWorkspaceSnapshotV1,
} from './schema';

/**
 * PR06 A2: local scene commands for the unified Table workspace. Each is
 * planned against the snapshot at its expected revision and committed
 * through ONE `mutateWorkspace` transaction digesting the command intent, so
 * a retry with the same operation id replays and a different intent under
 * that id is refused. No schema change: every field already exists in v1.
 */
export type TableSceneCommandV1 =
  | {
      type: 'scene.create';
      sceneId: string;
      name: string;
      /** `''` (blank scene) or a validated https URL. */
      mapImageUrl: string;
      mapImageSize: { w: number; h: number };
      at: string;
    }
  | {
      type: 'scene.setArrivalPoint';
      sceneId: string;
      point: { x: number; y: number } | null;
      at: string;
    };

export type TableSceneRejection = Extract<
  TableCommitResult,
  { status: 'rejected' }
>;

export type TableSceneResult =
  | TableCommitResult
  | { status: 'unchanged'; revision: number };

type Plan =
  | { status: 'planned'; mutation: TableWorkspaceMutation }
  | { status: 'unchanged' }
  | TableSceneRejection;

const encoder = new TextEncoder();
export const SCENE_NAME_MAX = 200;

function rejected(
  reason: TableSceneRejection['reason'],
  detail: string
): TableSceneRejection {
  return { status: 'rejected', reason, detail };
}

function isSceneId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    encoder.encode(value).byteLength <= 255
  );
}

/** Scene names: 1–200 Unicode characters, not only whitespace. */
export function isSceneName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    [...value].length <= SCENE_NAME_MAX
  );
}

/** A scene map image reference: blank, or an absolute https URL. */
export function isSceneImageUrl(value: unknown): value is string {
  if (value === '') return true;
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function liveScene(
  snapshot: TableWorkspaceSnapshotV1,
  sceneId: string
): TableSceneRecordV1 | undefined {
  if (
    snapshot.tombstones.some(
      tombstone => tombstone.kind === 'scene' && tombstone.id === sceneId
    )
  )
    return undefined;
  return snapshot.scenes.find(scene => scene.sceneId === sceneId);
}

/** Plans one scene command against the snapshot at its expected revision. */
export function planSceneCommand(
  snapshot: TableWorkspaceSnapshotV1,
  command: TableSceneCommandV1
): Plan {
  if (!isSceneId(command.sceneId))
    return rejected('invalid-command', 'scene-id');
  if (typeof command.at !== 'string' || Number.isNaN(Date.parse(command.at)))
    return rejected('invalid-command', 'timestamp');
  switch (command.type) {
    case 'scene.create': {
      if (!isSceneName(command.name))
        return rejected('invalid-command', 'name');
      if (!isSceneImageUrl(command.mapImageUrl))
        return rejected('invalid-command', 'map-image-url');
      const size = command.mapImageSize;
      if (
        !size ||
        !finite(size.w) ||
        !finite(size.h) ||
        size.w < 0 ||
        size.h < 0
      )
        return rejected('invalid-command', 'map-image-size');
      if (
        snapshot.scenes.some(scene => scene.sceneId === command.sceneId) ||
        snapshot.tombstones.some(
          tombstone =>
            tombstone.kind === 'scene' && tombstone.id === command.sceneId
        )
      )
        return rejected('invalid-command', 'scene-exists');
      const scene: TableSceneRecordV1 = {
        schemaVersion: 1,
        workspaceKey: snapshot.workspaceKey,
        sceneId: command.sceneId,
        originalMapId: null,
        map: {
          name: command.name,
          mapImageUrl: command.mapImageUrl,
          mapImageSize: { w: size.w, h: size.h },
          gridEnabled: false,
          gridSettings: null,
          markers: [],
          dmOnlyElements: {},
        },
        canvasCheckpoint: null,
        members: [],
        arrivalPoint: null,
        createdAt: command.at,
        updatedAt: command.at,
      };
      return { status: 'planned', mutation: { scenes: { put: [scene] } } };
    }
    case 'scene.setArrivalPoint': {
      const scene = liveScene(snapshot, command.sceneId);
      if (!scene) return rejected('invalid-reference', 'scene-missing');
      const point = command.point;
      if (point !== null && (!finite(point?.x) || !finite(point?.y)))
        return rejected('invalid-command', 'point');
      const next = point === null ? null : { x: point.x, y: point.y };
      if (canonicalJson(scene.arrivalPoint) === canonicalJson(next))
        return { status: 'unchanged' };
      return {
        status: 'planned',
        mutation: {
          scenes: {
            put: [
              {
                ...structuredClone(scene),
                arrivalPoint: next,
                updatedAt: command.at,
              },
            ],
          },
        },
      };
    }
  }
}

function wellFormed(command: unknown): boolean {
  if (command === null || typeof command !== 'object') return false;
  const type = (command as { type?: unknown }).type;
  if (type !== 'scene.create' && type !== 'scene.setArrivalPoint') return false;
  try {
    canonicalJson(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * The one scene command path: plan on the expected snapshot, then a single
 * CAS'd IndexedDB transaction. Success is reported only after the
 * transaction completed; a stale or retried command is answered by replay,
 * digest mismatch or conflict, never re-planned on newer state.
 */
export async function runSceneCommand(
  repository: TableRepository,
  options: {
    expectedRevision: number;
    operationId: string;
    command: TableSceneCommandV1;
  }
): Promise<TableSceneResult> {
  const { command, expectedRevision, operationId } = options;
  if (!wellFormed(command)) return rejected('invalid-command', 'malformed');
  const current = repository.getCurrent();
  if (current?.status === 'read-only')
    return { status: 'rejected', reason: 'unknown-schema' };
  const snapshot = current?.status === 'ready' ? current.snapshot : null;
  const actualRevision = snapshot?.campaign?.revision ?? 0;
  if (!snapshot || actualRevision !== expectedRevision) {
    return repository.mutateWorkspace(
      expectedRevision,
      operationId,
      {},
      { digestSource: command }
    );
  }
  const plan = planSceneCommand(snapshot, command);
  if (plan.status === 'rejected') return plan;
  if (plan.status === 'unchanged')
    return { status: 'unchanged', revision: actualRevision };
  return repository.mutateWorkspace(
    expectedRevision,
    operationId,
    plan.mutation,
    { digestSource: command }
  );
}
