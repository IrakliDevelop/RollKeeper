import {
  ANNOTATIONS_LAYER_ID,
  MAP_LAYER_ID,
  type ViewportLike,
} from './layerContract';

/** ViewportLike plus the smart-guides switch — `Viewport` satisfies this
 *  structurally. Guides are only ever enabled inside arrange-maps mode:
 *  the SDK's SelectTool drag uses smart guides OR grid snapping, never
 *  both, and token drags outside this mode rely on grid snapping. */
export interface ArrangeViewport extends ViewportLike {
  smartGuides: boolean;
  setSmartGuides(enabled: boolean): void;
}

export interface ArrangeMapsSession {
  /** Map-layer image elements we unlocked on enter — re-locked on exit. */
  unlockedElementIds: string[];
  annotationsWasLocked: boolean;
  previousActiveLayerId: string;
  /** Smart-guides state before enter — restored (not forced off) on exit. */
  smartGuidesWasEnabled: boolean;
}

/**
 * Arrange-maps mode: only map images are editable. Unlocks layer-map and its
 * image elements (grid elements stay locked so they can't be dragged), locks
 * annotations so nothing else is selectable, and activates the map layer.
 * Also enables the SDK's smart alignment guides for the duration (map-to-map
 * edge/center snapping while dragging).
 * The caller must relax the pin invariant (mapUnlocked) for the duration —
 * otherwise the pin subscription re-locks the map layer on the next change.
 */
export function enterArrangeMaps(vp: ArrangeViewport): ArrangeMapsSession {
  const lm = vp.layerManager;
  const session: ArrangeMapsSession = {
    unlockedElementIds: [],
    annotationsWasLocked: lm.getLayer(ANNOTATIONS_LAYER_ID)?.locked ?? false,
    previousActiveLayerId: lm.activeLayerId,
    smartGuidesWasEnabled: vp.smartGuides,
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
  vp.setSmartGuides(true);
  return session;
}

export function exitArrangeMaps(
  vp: ArrangeViewport,
  session: ArrangeMapsSession
): void {
  const lm = vp.layerManager;
  for (const id of session.unlockedElementIds) {
    if (vp.store.getById(id)) vp.store.update(id, { locked: true });
  }
  // While arranging, the active layer is layer-map — every other creation
  // path (drag-drop/paste ImageTool, drawing tools, the annotation image
  // button, DmTokenTool) creates onto the active layer, not just the map
  // image tool. Sweep anything that isn't a map image or grid off layer-map
  // before re-locking it, or those elements get trapped on the locked
  // bottom band.
  for (const el of vp.store.getAll()) {
    if (
      el.layerId === MAP_LAYER_ID &&
      el.type !== 'image' &&
      el.type !== 'grid'
    ) {
      lm.moveElementToLayer(el.id, ANNOTATIONS_LAYER_ID);
    }
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
  vp.setSmartGuides(session.smartGuidesWasEnabled);
}
