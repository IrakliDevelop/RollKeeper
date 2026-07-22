import {
  ANNOTATIONS_LAYER_ID,
  MAP_LAYER_ID,
  type ViewportLike,
} from './layerContract';

export interface ArrangeMapsSession {
  /** Map-layer image elements we unlocked on enter — re-locked on exit. */
  unlockedElementIds: string[];
  annotationsWasLocked: boolean;
  previousActiveLayerId: string;
}

/**
 * Arrange-maps mode: only map images are editable. Unlocks layer-map and its
 * image elements (grid elements stay locked so they can't be dragged), locks
 * annotations so nothing else is selectable, and activates the map layer.
 * The caller must relax the pin invariant (mapUnlocked) for the duration —
 * otherwise the pin subscription re-locks the map layer on the next change.
 */
export function enterArrangeMaps(vp: ViewportLike): ArrangeMapsSession {
  const lm = vp.layerManager;
  const session: ArrangeMapsSession = {
    unlockedElementIds: [],
    annotationsWasLocked: lm.getLayer(ANNOTATIONS_LAYER_ID)?.locked ?? false,
    previousActiveLayerId: lm.activeLayerId,
  };
  lm.updateLayerDirect(MAP_LAYER_ID, { locked: false });
  for (const el of vp.store.getAll()) {
    if (el.layerId !== MAP_LAYER_ID || el.type !== 'image') continue;
    if (el.locked) {
      vp.store.update(el.id, { locked: false });
      session.unlockedElementIds.push(el.id);
    }
  }
  lm.updateLayerDirect(ANNOTATIONS_LAYER_ID, { locked: true });
  lm.setActiveLayer(MAP_LAYER_ID);
  return session;
}

export function exitArrangeMaps(
  vp: ViewportLike,
  session: ArrangeMapsSession
): void {
  const lm = vp.layerManager;
  for (const id of session.unlockedElementIds) {
    if (vp.store.getById(id)) vp.store.update(id, { locked: true });
  }
  lm.updateLayerDirect(ANNOTATIONS_LAYER_ID, {
    locked: session.annotationsWasLocked,
  });
  const previous = lm.getLayer(session.previousActiveLayerId);
  if (previous && session.previousActiveLayerId !== MAP_LAYER_ID) {
    lm.setActiveLayer(session.previousActiveLayerId);
  } else {
    lm.setActiveLayer(ANNOTATIONS_LAYER_ID);
  }
  lm.updateLayerDirect(MAP_LAYER_ID, { locked: true });
}
