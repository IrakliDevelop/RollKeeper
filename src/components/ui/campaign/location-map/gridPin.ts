import type { Viewport } from '@fieldnotes/core';
import { ensureCanonicalLayers, MAP_LAYER_ID } from './layerContract';

/**
 * Map + grid must live on the layer-locked map layer so hit-testing skips
 * them (see @fieldnotes/core InputHandler / SelectTool + `isLayerLocked`).
 * Grid elements must also be `locked` so Select cannot drag them (otherwise
 * they appear to slide when panning/zooming).
 */
export function pinGridToMapLayer(vp: Viewport) {
  ensureCanonicalLayers(vp, 'dm');
  for (const g of vp.store.getElementsByType('grid')) {
    vp.layerManager.moveElementToLayer(g.id, MAP_LAYER_ID);
    vp.store.update(g.id, { locked: true });
  }
  vp.requestRender();
}
