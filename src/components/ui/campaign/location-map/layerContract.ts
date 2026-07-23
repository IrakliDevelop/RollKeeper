import type { ElementStore, LayerManager } from '@fieldnotes/core';

/**
 * Canonical layer bands shared by ALL battlemap canvases (DM setup editor,
 * DM play canvas, player canvas). The FieldNotes SDK paints elements sorted
 * by (layerOrder, zIndex) with zIndex compared only WITHIN a layer, and
 * layers are not synced between clients — so stacking is only deterministic
 * if every canvas assigns the same order band to the same layer id:
 *
 *   layer-map (0, locked)            map images + grid
 *   layer-annotations (100)          DM annotations + combatant tokens
 *   custom DM layers (200+)          extra layers from the layers panel
 *   player-<characterId> (500+)      each player's token + drawings
 *
 * The player band sits above everything a DM can draw on, so a DM-added
 * image can never cover a player token (the bug this module exists to fix).
 */
export const MAP_LAYER_ID = 'layer-map';
export const ANNOTATIONS_LAYER_ID = 'layer-annotations';
export const MAP_LAYER_ORDER = 0;
export const ANNOTATIONS_LAYER_ORDER = 100;
export const CUSTOM_BAND_ORDER = 200;
export const PLAYER_BAND_ORDER = 500;
export const PLAYER_LAYER_PREFIX = 'player-';

export type CanvasRole = 'dm' | 'player';

/** Structural subset of Viewport so tests run on real SDK stores headless. */
export interface ViewportLike {
  store: ElementStore;
  layerManager: LayerManager;
}

const LEGACY_MAP_NAME = 'Map Background';
const LEGACY_ANNOTATIONS_NAME = 'Annotations';
const AUTO_LAYER_NAME = /^Layer \d+$/;

/**
 * Create the canonical layers if missing and pin the bands. Annotations is
 * locked for players (their hit-testing must skip DM content — the relay
 * would reject their writes anyway). Also guards the active layer off the
 * locked map layer (loadJSON resets active to the lowest-order layer).
 */
export function ensureCanonicalLayers(
  vp: ViewportLike,
  role: CanvasRole
): void {
  const lm = vp.layerManager;
  if (!lm.getLayer(MAP_LAYER_ID)) {
    lm.addLayerDirect({
      id: MAP_LAYER_ID,
      name: 'Map',
      visible: true,
      locked: true,
      order: MAP_LAYER_ORDER,
      opacity: 1,
    });
  }
  if (!lm.getLayer(ANNOTATIONS_LAYER_ID)) {
    lm.addLayerDirect({
      id: ANNOTATIONS_LAYER_ID,
      name: 'Annotations',
      visible: true,
      locked: role === 'player',
      order: ANNOTATIONS_LAYER_ORDER,
      opacity: 1,
    });
  }
  pinCanonicalLayers(vp);
  if (lm.activeLayerId === MAP_LAYER_ID || !lm.getLayer(lm.activeLayerId)) {
    lm.setActiveLayer(ANNOTATIONS_LAYER_ID);
  }
}

/**
 * Re-assert band invariants. Lock state of annotations/custom/player layers
 * is NOT pinned (role- and user-controlled); only the map lock is, because
 * only arrange-maps mode may relax it (opts.mapUnlocked).
 */
export function pinCanonicalLayers(
  vp: ViewportLike,
  opts?: { mapUnlocked?: boolean }
): void {
  const lm = vp.layerManager;
  const map = lm.getLayer(MAP_LAYER_ID);
  if (map) {
    const wantLocked = !opts?.mapUnlocked;
    if (map.order !== MAP_LAYER_ORDER || map.locked !== wantLocked) {
      lm.updateLayerDirect(MAP_LAYER_ID, {
        order: MAP_LAYER_ORDER,
        locked: wantLocked,
      });
    }
  }
  const annotations = lm.getLayer(ANNOTATIONS_LAYER_ID);
  if (annotations && annotations.order !== ANNOTATIONS_LAYER_ORDER) {
    lm.updateLayerDirect(ANNOTATIONS_LAYER_ID, {
      order: ANNOTATIONS_LAYER_ORDER,
    });
  }
  // getLayers() is order-sorted (stable), so renumbering by enumeration
  // index preserves each band's relative order.
  const others = lm
    .getLayers()
    .filter(l => l.id !== MAP_LAYER_ID && l.id !== ANNOTATIONS_LAYER_ID);
  const customs = others.filter(l => !l.id.startsWith(PLAYER_LAYER_PREFIX));
  const players = others.filter(l => l.id.startsWith(PLAYER_LAYER_PREFIX));
  customs.forEach((l, i) => {
    if (l.order !== CUSTOM_BAND_ORDER + i) {
      lm.updateLayerDirect(l.id, { order: CUSTOM_BAND_ORDER + i });
    }
  });
  players.forEach((l, i) => {
    if (l.order !== PLAYER_BAND_ORDER + i) {
      lm.updateLayerDirect(l.id, { order: PLAYER_BAND_ORDER + i });
    }
  });
}

/**
 * Keep bands pinned as layers come and go. updateLayerDirect emits 'change'
 * synchronously, so the guard prevents self-recursion; the pin is
 * idempotent, so the one re-entrant emit converges immediately.
 */
export function subscribePinCanonicalLayers(
  vp: ViewportLike,
  getOpts?: () => { mapUnlocked?: boolean }
): () => void {
  let pinning = false;
  return vp.layerManager.on('change', () => {
    if (pinning) return;
    pinning = true;
    try {
      pinCanonicalLayers(vp, getOpts?.());
    } finally {
      pinning = false;
    }
  });
}

/**
 * Layers don't sync: a remote element can reference a layer id this canvas
 * has never seen (old clients mid-rollout, other players' layers). Mirror it
 * locally into the right band so stacking stays deterministic. Locked for
 * players (can't touch remote content anyway); unlocked for the DM (keeps
 * the DM able to drag player tokens).
 */
export function mirrorUnknownLayer(
  vp: ViewportLike,
  layerId: string,
  role: CanvasRole
): void {
  if (!layerId || vp.layerManager.getLayer(layerId)) return;
  const isPlayerLayer = layerId.startsWith(PLAYER_LAYER_PREFIX);
  vp.layerManager.addLayerDirect({
    id: layerId,
    name: 'Remote layer',
    visible: true,
    locked: role === 'player',
    order: isPlayerLayer ? PLAYER_BAND_ORDER : CUSTOM_BAND_ORDER,
    opacity: 1,
  });
  pinCanonicalLayers(vp);
}

/**
 * Register the unknown-layer mirror on a store. Both 'add' AND 'update' must
 * be covered: relay snapshot reconcile re-applies remote elements as full
 * updates (including layerId), so a layerId referencing a layer this canvas
 * no longer has (e.g. pre-migration legacy ids restored from the relay's
 * persisted room state) can arrive on either event. Returns an unsubscribe
 * for both listeners.
 */
export function attachUnknownLayerMirror(
  vp: ViewportLike,
  role: CanvasRole,
  onMirrored?: () => void
): () => void {
  const check = (layerId: string | undefined) => {
    if (layerId && !vp.layerManager.getLayer(layerId)) {
      mirrorUnknownLayer(vp, layerId, role);
      onMirrored?.();
    }
  };
  const unsubAdd = vp.store.on('add', el => check(el.layerId));
  const unsubUpdate = vp.store.on('update', ({ current }) =>
    check(current.layerId)
  );
  return () => {
    unsubAdd();
    unsubUpdate();
  };
}

/**
 * Lazy per-load migration of pre-contract canvases: legacy name-matched
 * layers are absorbed into the canonical ids (elements moved — the element
 * updates flow through the relay, which is what teaches OTHER canvases the
 * canonical ids), and empty auto-named leftovers (the SDK default "Layer 1")
 * are dropped. Returns true when anything changed so the caller can persist.
 */
export function migrateCanvasToContract(
  vp: ViewportLike,
  role: CanvasRole
): boolean {
  const lm = vp.layerManager;
  ensureCanonicalLayers(vp, role);
  let changed = false;

  for (const legacy of lm.getLayers()) {
    if (legacy.id === MAP_LAYER_ID || legacy.id === ANNOTATIONS_LAYER_ID) {
      continue;
    }
    const target =
      legacy.name === LEGACY_MAP_NAME
        ? MAP_LAYER_ID
        : legacy.name === LEGACY_ANNOTATIONS_NAME
          ? ANNOTATIONS_LAYER_ID
          : null;
    if (!target) continue;
    for (const el of vp.store.getAll()) {
      if (el.layerId === legacy.id) {
        vp.store.update(el.id, { layerId: target });
      }
    }
    lm.removeLayerDirect(legacy.id);
    changed = true;
  }

  for (const leftover of lm.getLayers()) {
    if (leftover.id === MAP_LAYER_ID || leftover.id === ANNOTATIONS_LAYER_ID) {
      continue;
    }
    if (!AUTO_LAYER_NAME.test(leftover.name)) continue;
    const empty = !vp.store.getAll().some(el => el.layerId === leftover.id);
    if (empty) {
      lm.removeLayerDirect(leftover.id);
      changed = true;
    }
  }

  // removeLayerDirect doesn't repair a dangling active layer.
  if (!lm.getLayer(lm.activeLayerId)) {
    lm.setActiveLayer(ANNOTATIONS_LAYER_ID);
  }
  if (changed) pinCanonicalLayers(vp);
  return changed;
}
