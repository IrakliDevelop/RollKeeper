import {
  tableAuthorityRoomKeys,
  tableControlKey,
  tableRegistryKey,
} from './keys';
import { normalizeHashEntries, resolveVerifiedLocation } from './resourceKind';

type RawRedisRead = {
  get(key: string): Promise<unknown>;
  hget(key: string, field: string): Promise<unknown>;
};

export type PresentedTableSceneResolution =
  | {
      status: 'resolved';
      sceneId: string;
      room: string;
      roomGeneration: string;
      epoch: string;
      displayGeneration: number | null;
    }
  /** Any scene-availability denial; callers answer uniformly. */
  | { status: 'unavailable' }
  /** A genuine read failure of the authority service. */
  | { status: 'error' };

function decodeRecord(value: unknown): Record<string, unknown> | null {
  try {
    const decoded =
      typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
    return decoded && typeof decoded === 'object' && !Array.isArray(decoded)
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Presentation authorization for map-pinned audiences (player and display)
 * in Table v1 mode. A request that names no scene, or names its own source
 * map, resolves to the CURRENT unblanked presentation iff that registered
 * scene was adopted from this map; an explicit scene must itself be the
 * current presentation of this map. Every miss is the same `unavailable`
 * outcome so a caller cannot probe which scenes are registered. The result
 * carries only what admission already implies (scene id, room, generation).
 * DM requests and location sharing never come through here.
 */
export async function resolvePresentedTableScene(options: {
  rawRedis: RawRedisRead;
  campaign: string;
  battleMapId: string;
  requestedSceneId?: string;
  role: 'player' | 'display';
}): Promise<PresentedTableSceneResolution> {
  let controlKey: string;
  let registryKey: string;
  try {
    controlKey = tableControlKey(options.campaign);
    registryKey = tableRegistryKey(options.campaign);
  } catch {
    return { status: 'unavailable' };
  }
  try {
    const control = decodeRecord(await options.rawRedis.get(controlKey));
    const presentation = decodeRecord(control?.presentation);
    if (
      control?.v !== 1 ||
      typeof control.epoch !== 'string' ||
      !presentation ||
      presentation.blanked === true ||
      typeof presentation.sceneId !== 'string'
    ) {
      return { status: 'unavailable' };
    }
    const sceneId =
      options.requestedSceneId === undefined ||
      options.requestedSceneId === options.battleMapId
        ? presentation.sceneId
        : options.requestedSceneId;
    if (presentation.sceneId !== sceneId) return { status: 'unavailable' };
    const registry = decodeRecord(
      await options.rawRedis.hget(registryKey, sceneId)
    );
    const room = registry?.roomId;
    if (
      registry?.v !== 1 ||
      registry.sceneId !== sceneId ||
      registry.sourceMapId !== options.battleMapId ||
      registry.deleted === true ||
      typeof room !== 'string'
    ) {
      return { status: 'unavailable' };
    }
    let metaKey: string;
    try {
      metaKey = tableAuthorityRoomKeys(options.campaign, room).meta;
    } catch {
      return { status: 'unavailable' };
    }
    const meta = decodeRecord(await options.rawRedis.get(metaKey));
    if (meta?.v !== 1 || typeof meta.generation !== 'string') {
      return { status: 'unavailable' };
    }
    const displayGeneration =
      typeof control.displayGeneration === 'number'
        ? control.displayGeneration
        : null;
    if (options.role === 'display' && displayGeneration === null) {
      return { status: 'unavailable' };
    }
    return {
      status: 'resolved',
      sceneId,
      room,
      roomGeneration: meta.generation,
      epoch: control.epoch,
      displayGeneration,
    };
  } catch {
    return { status: 'error' };
  }
}

type RawRegistryRead = RawRedisRead & {
  hgetall(key: string): Promise<unknown>;
};

/**
 * Server-side resource kind of an id addressed by an HTTP side channel
 * (PR04 P5.2), resolved in a fixed order that no caller input can change:
 * a registry scene id, a non-deleted registry source map, a verified
 * location, otherwise an unregistered map. Read failures are `error`.
 */
export type TableResource =
  | {
      kind: 'scene';
      sceneId: string;
      sourceMapId: string | null;
      safeLabel: string;
      deleted: boolean;
      /** Control v1 presents this scene, unblanked, and it is not deleted. */
      audienceVisible: boolean;
    }
  | { kind: 'source-map' | 'location' | 'unregistered' }
  | { kind: 'error' };

function presentationOf(control: Record<string, unknown> | null) {
  const presentation = decodeRecord(control?.presentation);
  if (control?.v !== 1 || !presentation) return null;
  return {
    sceneId:
      typeof presentation.sceneId === 'string' ? presentation.sceneId : null,
    blanked: presentation.blanked === true,
  };
}

export async function resolveTableResource(options: {
  rawRedis: RawRegistryRead;
  /** Location detail/list reader (deserializing or raw). */
  locationRedis?: { get(key: string): Promise<unknown> };
  campaign: string;
  id: string;
}): Promise<TableResource> {
  let registryKey: string;
  let controlKey: string;
  try {
    registryKey = tableRegistryKey(options.campaign);
    controlKey = tableControlKey(options.campaign);
  } catch {
    return { kind: 'error' };
  }
  try {
    // One HGET first; the source-map scan runs only on a miss.
    const entry = decodeRecord(
      await options.rawRedis.hget(registryKey, options.id)
    );
    if (entry?.v === 1 && entry.sceneId === options.id) {
      const presentation = presentationOf(
        decodeRecord(await options.rawRedis.get(controlKey))
      );
      const deleted = entry.deleted === true;
      return {
        kind: 'scene',
        sceneId: options.id,
        sourceMapId:
          typeof entry.sourceMapId === 'string' ? entry.sourceMapId : null,
        safeLabel: typeof entry.safeLabel === 'string' ? entry.safeLabel : '',
        deleted,
        audienceVisible:
          !deleted &&
          presentation !== null &&
          presentation.sceneId === options.id &&
          !presentation.blanked,
      };
    }
    const entries = normalizeHashEntries(
      await options.rawRedis.hgetall(registryKey)
    );
    if (entries === null) return { kind: 'error' };
    for (const [, raw] of entries) {
      const candidate = decodeRecord(raw);
      if (
        candidate?.v === 1 &&
        candidate.deleted !== true &&
        candidate.sourceMapId === options.id
      )
        return { kind: 'source-map' };
    }
  } catch {
    return { kind: 'error' };
  }
  const location = await resolveVerifiedLocation({
    redis: options.locationRedis ?? options.rawRedis,
    registryRedis: options.rawRedis,
    campaign: options.campaign,
    battleMapId: options.id,
    registryKey,
  });
  if (location.status === 'unavailable') return { kind: 'error' };
  return location.status === 'verified'
    ? { kind: 'location' }
    : { kind: 'unregistered' };
}

/** The presented, unblanked, registered scene (list GET projection). */
export async function readPresentedTableScene(options: {
  rawRedis: RawRedisRead;
  campaign: string;
}): Promise<
  | {
      status: 'presented';
      sceneId: string;
      sourceMapId: string | null;
      safeLabel: string;
    }
  | { status: 'none' }
  | { status: 'error' }
> {
  try {
    const presentation = presentationOf(
      decodeRecord(
        await options.rawRedis.get(tableControlKey(options.campaign))
      )
    );
    if (!presentation?.sceneId || presentation.blanked)
      return { status: 'none' };
    const entry = decodeRecord(
      await options.rawRedis.hget(
        tableRegistryKey(options.campaign),
        presentation.sceneId
      )
    );
    if (
      entry?.v !== 1 ||
      entry.sceneId !== presentation.sceneId ||
      entry.deleted === true ||
      typeof entry.safeLabel !== 'string'
    )
      return { status: 'none' };
    return {
      status: 'presented',
      sceneId: presentation.sceneId,
      sourceMapId:
        typeof entry.sourceMapId === 'string' ? entry.sourceMapId : null,
      safeLabel: entry.safeLabel,
    };
  } catch {
    return { status: 'error' };
  }
}
