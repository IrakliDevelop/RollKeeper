import { describe, it, expect } from 'vitest';
import {
  ElementStore,
  LayerManager,
  createImage,
  createGrid,
  createShape,
  createNote,
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
  type ArrangeViewport,
} from '@/components/ui/campaign/location-map/arrangeMaps';

// migrateCanvasToContract (in addition to ensureCanonicalLayers) drops the
// SDK's empty default "Layer 1", which otherwise stays active and breaks the
// "previous active layer" assertions below — same fixture pattern as
// makeCleanVp in layerContract.test.ts.
function makeVp(): ArrangeViewport {
  const store = new ElementStore();
  const layerManager = new LayerManager(store);
  let smartGuides = false;
  const vp: ArrangeViewport = {
    store,
    layerManager,
    get smartGuides() {
      return smartGuides;
    },
    setSmartGuides(enabled: boolean) {
      smartGuides = enabled;
    },
  };
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

  it('sweeps non-image/grid elements created on layer-map (active layer while arranging) to annotations on exit, leaving images and grid in place', () => {
    // Regression (I1): while arranging, active layer = layer-map. Any other
    // creation path (drag-drop/paste ImageTool, drawing tools, annotation
    // image button, DmTokenTool) targets the active layer, so shapes/notes/
    // tokens can land on layer-map — after exit, that layer is locked again
    // and those elements would be trapped under the map images.
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

    const session = enterArrangeMaps(vp);

    // Simulate a stray creation path (e.g. drawing/note tool) that dropped
    // an element onto the currently-active map layer mid-arrange.
    const shape = createShape({
      position: { x: 0, y: 0 },
      size: { w: 10, h: 10 },
      layerId: MAP_LAYER_ID,
    });
    vp.store.add(shape);
    const note = createNote({
      position: { x: 0, y: 0 },
      layerId: MAP_LAYER_ID,
    });
    vp.store.add(note);

    exitArrangeMaps(vp, session);

    expect(vp.store.getById(shape.id)?.layerId).toBe(ANNOTATIONS_LAYER_ID);
    expect(vp.store.getById(note.id)?.layerId).toBe(ANNOTATIONS_LAYER_ID);
    expect(vp.store.getById(imageId)?.layerId).toBe(MAP_LAYER_ID);
    expect(vp.store.getById(grid.id)?.layerId).toBe(MAP_LAYER_ID);
  });

  it('enables smart guides on enter and restores the previous value on exit', () => {
    const vp = makeVp();
    const session = enterArrangeMaps(vp);
    expect(vp.smartGuides).toBe(true);
    expect(session.smartGuidesWasEnabled).toBe(false);
    exitArrangeMaps(vp, session);
    expect(vp.smartGuides).toBe(false);
  });

  it('keeps smart guides on after exit when they were already enabled', () => {
    const vp = makeVp();
    vp.setSmartGuides(true);
    const session = enterArrangeMaps(vp);
    expect(session.smartGuidesWasEnabled).toBe(true);
    exitArrangeMaps(vp, session);
    expect(vp.smartGuides).toBe(true);
  });
});
