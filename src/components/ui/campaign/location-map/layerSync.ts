import type { Layer } from '@fieldnotes/core';
import type { RemoteLayerUpdate } from '@fieldnotes/sync';
import {
  MAP_LAYER_ID,
  ANNOTATIONS_LAYER_ID,
  PLAYER_LAYER_PREFIX,
  type ViewportLike,
} from './layerContract';

/**
 * Roles a synced battle-map canvas can play. `display` is the read-only TV
 * view: definitions apply verbatim but always locked, and it never publishes.
 */
export type LayerSyncRole = 'dm' | 'player' | 'display';

export interface ApplyRemoteLayerOptions {
  /**
   * The player's own `player-<characterId>` layer. It is never locked or
   * removed by remote records — the owner must always keep control of their
   * elements, whatever another client's copy of the definition says.
   */
  ownLayerId?: string;
  /** Called after a record actually changed local layer state (e.g. requestRender). */
  onApplied?: () => void;
}

/**
 * Builds the `applyLayer` hook for a battle-map connection. The SDK calls it
 * only for records that win the deterministic (version, editor) ordering;
 * this hook owns RollKeeper policy on top:
 *
 * - Canonical bands (`layer-map`, `layer-annotations`) are locally owned and
 *   pinned by `subscribePinCanonicalLayers`; remote definitions for them are
 *   ignored outright so role lock rules are never stomped.
 * - Players get every remote layer locked except their own (hit-testing and
 *   marquee must skip content they cannot edit — the relay rejects their
 *   writes to it anyway). The DM applies lock state as-is; the display locks
 *   everything.
 * - Application uses `LayerManager` `*Direct` calls, so remote layer changes
 *   never enter local undo history.
 * - Band renumbering stays with the existing pin subscription, which fires on
 *   every layer change these applications emit.
 */
export function makeApplyRemoteLayer(
  vp: ViewportLike,
  role: LayerSyncRole,
  opts: ApplyRemoteLayerOptions = {}
): (update: RemoteLayerUpdate) => void {
  return update => {
    const { record } = update;
    const id = record.id;
    if (id === MAP_LAYER_ID || id === ANNOTATIONS_LAYER_ID) return;
    if (id === opts.ownLayerId && record.definition === undefined) return;
    const lm = vp.layerManager;

    if (!record.definition) {
      if (!lm.getLayer(id)) return;
      lm.removeLayerDirect(id);
      // removeLayerDirect does not repair a dangling active layer.
      if (!lm.getLayer(lm.activeLayerId)) {
        const fallback =
          opts.ownLayerId && lm.getLayer(opts.ownLayerId)
            ? opts.ownLayerId
            : ANNOTATIONS_LAYER_ID;
        if (lm.getLayer(fallback)) lm.setActiveLayer(fallback);
      }
      opts.onApplied?.();
      return;
    }

    const def = record.definition;
    const locked =
      role === 'display'
        ? true
        : role === 'player' && id !== opts.ownLayerId
          ? true
          : def.locked;
    const existing = lm.getLayer(id);
    if (existing) {
      lm.updateLayerDirect(id, {
        name: def.name,
        visible: def.visible,
        locked,
        order: def.order,
        opacity: def.opacity,
      });
    } else {
      lm.addLayerDirect({ ...def, locked });
    }
    opts.onApplied?.();
  };
}

/**
 * Publishes the layers this client owns, once per canvas ready, so peers and
 * late joiners get definitions even for layers created before layer sync
 * shipped (persisted in `canvasState` only):
 *
 * - DM canvases own the custom (non-canonical, non-player) layers.
 * - A player canvas owns exactly its `player-<characterId>` layer.
 * - Canonical bands are never published — every canvas creates and pins them
 *   locally with role-dependent lock state.
 *
 * The connection ledger stamps versions; while the socket is still
 * connecting, edits land in the ledger and are re-pushed after the first
 * authoritative snapshot.
 */
export function publishOwnedLayers(
  vp: ViewportLike,
  role: 'dm' | 'player',
  publish: (definition: Layer) => void,
  ownLayerId?: string
): void {
  if (role === 'player') {
    const own = ownLayerId ? vp.layerManager.getLayer(ownLayerId) : undefined;
    if (own) publish(own);
    return;
  }
  for (const layer of vp.layerManager.getLayers()) {
    if (layer.id === MAP_LAYER_ID || layer.id === ANNOTATIONS_LAYER_ID) {
      continue;
    }
    if (layer.id.startsWith(PLAYER_LAYER_PREFIX)) continue;
    publish(layer);
  }
}
