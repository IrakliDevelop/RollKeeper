import { describe, it, expect } from 'vitest';
import {
  ElementStore,
  LayerManager,
  createImage,
  createGrid,
} from '@fieldnotes/core';
import {
  MAP_LAYER_ID,
  ANNOTATIONS_LAYER_ID,
  ensureCanonicalLayers,
  migrateCanvasToContract,
  type ViewportLike,
} from '@/components/ui/campaign/location-map/layerContract';
import {
  enterArrangeMaps,
  exitArrangeMaps,
} from '@/components/ui/campaign/location-map/arrangeMaps';

// migrateCanvasToContract (in addition to ensureCanonicalLayers) drops the
// SDK's empty default "Layer 1", which otherwise stays active and breaks the
// "previous active layer" assertions below — same fixture pattern as
// makeCleanVp in layerContract.test.ts.
function makeVp(): ViewportLike {
  const store = new ElementStore();
  const layerManager = new LayerManager(store);
  const vp = { store, layerManager };
  ensureCanonicalLayers(vp, 'dm');
  migrateCanvasToContract(vp, 'dm');
  return vp;
}

function addLockedMapImage(vp: ViewportLike): string {
  const el = createImage({
    position: { x: 0, y: 0 },
    size: { w: 100, h: 100 },
    src: 'map.png',
    layerId: MAP_LAYER_ID,
    zIndex: 0,
  });
  vp.store.add(el);
  vp.store.update(el.id, { locked: true });
  return el.id;
}

describe('enter/exitArrangeMaps', () => {
  it('unlocks the map layer and its image elements, locks annotations, activates the map layer', () => {
    const vp = makeVp();
    const imageId = addLockedMapImage(vp);
    const grid = createGrid({
      gridType: 'square',
      cellSize: 50,
      strokeColor: '#000',
      strokeWidth: 1,
      opacity: 0.5,
      layerId: MAP_LAYER_ID,
    });
    vp.store.add(grid);
    vp.store.update(grid.id, { locked: true });

    const session = enterArrangeMaps(vp);

    expect(vp.layerManager.getLayer(MAP_LAYER_ID)!.locked).toBe(false);
    expect(vp.store.getById(imageId)!.locked).toBe(false);
    expect(vp.store.getById(grid.id)!.locked).toBe(true); // grid stays locked
    expect(vp.layerManager.getLayer(ANNOTATIONS_LAYER_ID)!.locked).toBe(true);
    expect(vp.layerManager.activeLayerId).toBe(MAP_LAYER_ID);
    expect(session.unlockedElementIds).toEqual([imageId]);
  });

  it('exit restores locks and the previous active layer', () => {
    const vp = makeVp();
    const imageId = addLockedMapImage(vp);
    const session = enterArrangeMaps(vp);
    exitArrangeMaps(vp, session);

    expect(vp.layerManager.getLayer(MAP_LAYER_ID)!.locked).toBe(true);
    expect(vp.store.getById(imageId)!.locked).toBe(true);
    expect(vp.layerManager.getLayer(ANNOTATIONS_LAYER_ID)!.locked).toBe(false);
    expect(vp.layerManager.activeLayerId).toBe(ANNOTATIONS_LAYER_ID);
  });

  it('exit tolerates elements deleted during arranging', () => {
    const vp = makeVp();
    const imageId = addLockedMapImage(vp);
    const session = enterArrangeMaps(vp);
    vp.store.remove(imageId);
    expect(() => exitArrangeMaps(vp, session)).not.toThrow();
  });
});
