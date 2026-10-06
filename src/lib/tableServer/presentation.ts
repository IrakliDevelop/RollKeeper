import { tableControlKey, tableRegistryKey } from './control';
import { tableAuthorityRoomKeys } from './keys';

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
