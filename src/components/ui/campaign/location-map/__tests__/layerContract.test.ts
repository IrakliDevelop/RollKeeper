import { describe, it, expect } from 'vitest';
import {
  ElementStore,
  LayerManager,
  createImage,
  type Layer,
} from '@fieldnotes/core';
import {
  MAP_LAYER_ID,
  ANNOTATIONS_LAYER_ID,
  MAP_LAYER_ORDER,
  ANNOTATIONS_LAYER_ORDER,
  CUSTOM_BAND_ORDER,
  PLAYER_BAND_ORDER,
  ensureCanonicalLayers,
  pinCanonicalLayers,
  subscribePinCanonicalLayers,
  mirrorUnknownLayer,
  migrateCanvasToContract,
  type ViewportLike,
} from '@/components/ui/campaign/location-map/layerContract';

function makeVp(): ViewportLike {
  const store = new ElementStore();
  const layerManager = new LayerManager(store);
  return { store, layerManager };
}

/** Contract applied AND the SDK's empty default "Layer 1" dropped — use for
 *  band-order assertions ("Layer 1" would otherwise occupy the first custom
 *  slot and shift every expected order by one). */
function makeCleanVp(role: 'dm' | 'player' = 'dm'): ViewportLike {
  const vp = makeVp();
  ensureCanonicalLayers(vp, role);
  migrateCanvasToContract(vp, role);
  return vp;
}

function addImageOn(vp: ViewportLike, layerId: string, zIndex = 0): string {
  const el = createImage({
    position: { x: 0, y: 0 },
    size: { w: 10, h: 10 },
    src: 'test.png',
    layerId,
    zIndex,
  });
  vp.store.add(el);
  return el.id;
}

function layer(vp: ViewportLike, id: string): Layer {
  const l = vp.layerManager.getLayer(id);
  if (!l) throw new Error(`layer ${id} missing`);
  return l;
}

describe('ensureCanonicalLayers', () => {
  it('creates map + annotations with canonical ids, orders, and locks (dm)', () => {
    const vp = makeVp();
    ensureCanonicalLayers(vp, 'dm');
    expect(layer(vp, MAP_LAYER_ID).order).toBe(MAP_LAYER_ORDER);
    expect(layer(vp, MAP_LAYER_ID).locked).toBe(true);
    expect(layer(vp, ANNOTATIONS_LAYER_ID).order).toBe(ANNOTATIONS_LAYER_ORDER);
    expect(layer(vp, ANNOTATIONS_LAYER_ID).locked).toBe(false);
  });

  it('locks annotations for role player', () => {
    const vp = makeVp();
    ensureCanonicalLayers(vp, 'player');
    expect(layer(vp, ANNOTATIONS_LAYER_ID).locked).toBe(true);
  });

  it('is idempotent — second call changes nothing', () => {
    const vp = makeVp();
    ensureCanonicalLayers(vp, 'dm');
    const before = vp.layerManager.getLayers();
    ensureCanonicalLayers(vp, 'dm');
    expect(vp.layerManager.getLayers()).toEqual(before);
  });

  it('moves the active layer off layer-map', () => {
    const vp = makeVp();
    ensureCanonicalLayers(vp, 'dm');
    vp.layerManager.setActiveLayer(MAP_LAYER_ID);
    ensureCanonicalLayers(vp, 'dm');
    expect(vp.layerManager.activeLayerId).toBe(ANNOTATIONS_LAYER_ID);
  });
});

describe('pinCanonicalLayers', () => {
  it('renumbers custom layers into the 200-band and player layers into the 500-band, preserving relative order', () => {
    const vp = makeCleanVp();
    const customA = vp.layerManager.createLayer('Traps'); // maxOrder+1 → above 100
    const customB = vp.layerManager.createLayer('Notes');
    vp.layerManager.addLayerDirect({
      id: 'player-b',
      name: 'x',
      visible: true,
      locked: false,
      order: 3,
      opacity: 1,
    });
    vp.layerManager.addLayerDirect({
      id: 'player-a',
      name: 'x',
      visible: true,
      locked: false,
      order: 7,
      opacity: 1,
    });
    pinCanonicalLayers(vp);
    expect(layer(vp, customA.id).order).toBe(CUSTOM_BAND_ORDER);
    expect(layer(vp, customB.id).order).toBe(CUSTOM_BAND_ORDER + 1);
    expect(layer(vp, 'player-b').order).toBe(PLAYER_BAND_ORDER);
    expect(layer(vp, 'player-a').order).toBe(PLAYER_BAND_ORDER + 1);
  });

  it('re-locks and re-orders layer-map, unless mapUnlocked', () => {
    const vp = makeVp();
    ensureCanonicalLayers(vp, 'dm');
    vp.layerManager.updateLayerDirect(MAP_LAYER_ID, {
      locked: false,
      order: 50,
    });
    pinCanonicalLayers(vp, { mapUnlocked: true });
    expect(layer(vp, MAP_LAYER_ID).locked).toBe(false);
    expect(layer(vp, MAP_LAYER_ID).order).toBe(MAP_LAYER_ORDER);
    pinCanonicalLayers(vp);
    expect(layer(vp, MAP_LAYER_ID).locked).toBe(true);
  });
});

describe('subscribePinCanonicalLayers', () => {
  it('pins on layer changes without infinite recursion', () => {
    const vp = makeCleanVp();
    const unsubscribe = subscribePinCanonicalLayers(vp);
    const custom = vp.layerManager.createLayer('Overlay'); // fires 'change'
    expect(layer(vp, custom.id).order).toBe(CUSTOM_BAND_ORDER);
    // While subscribed, a rogue map reorder is snapped back.
    vp.layerManager.updateLayerDirect(MAP_LAYER_ID, { order: 50 });
    expect(layer(vp, MAP_LAYER_ID).order).toBe(MAP_LAYER_ORDER);
    unsubscribe();
    vp.layerManager.updateLayerDirect(MAP_LAYER_ID, { order: 50 });
    expect(layer(vp, MAP_LAYER_ID).order).toBe(50); // no longer pinned
  });
});

describe('mirrorUnknownLayer', () => {
  it('puts player-* ids in the player band, locked for role player', () => {
    const vp = makeCleanVp('player');
    mirrorUnknownLayer(vp, 'player-remote', 'player');
    expect(layer(vp, 'player-remote').order).toBe(PLAYER_BAND_ORDER);
    expect(layer(vp, 'player-remote').locked).toBe(true);
  });

  it('is unlocked for role dm and no-ops on a known layer', () => {
    const vp = makeCleanVp();
    mirrorUnknownLayer(vp, 'player-remote', 'dm');
    expect(layer(vp, 'player-remote').locked).toBe(false);
    const before = layer(vp, 'player-remote');
    mirrorUnknownLayer(vp, 'player-remote', 'dm');
    expect(layer(vp, 'player-remote')).toEqual(before);
  });

  it('puts non-player unknown ids in the custom band', () => {
    const vp = makeCleanVp();
    mirrorUnknownLayer(vp, 'layer-oldclient', 'dm');
    expect(layer(vp, 'layer-oldclient').order).toBe(CUSTOM_BAND_ORDER);
  });
});

describe('migrateCanvasToContract', () => {
  function legacyVp(): { vp: ViewportLike; bgId: string; annId: string } {
    const vp = makeVp();
    // Emulate the legacy editor: default layer renamed 'Map Background',
    // a created 'Annotations' layer.
    const bg = vp.layerManager.getLayers()[0];
    vp.layerManager.renameLayer(bg.id, 'Map Background');
    const ann = vp.layerManager.createLayer('Annotations');
    return { vp, bgId: bg.id, annId: ann.id };
  }

  it('absorbs legacy layers into canonical ids, moving elements', () => {
    const { vp, bgId, annId } = legacyVp();
    const mapEl = addImageOn(vp, bgId);
    const annEl = addImageOn(vp, annId);
    const changed = migrateCanvasToContract(vp, 'dm');
    expect(changed).toBe(true);
    expect(vp.layerManager.getLayer(bgId)).toBeUndefined();
    expect(vp.layerManager.getLayer(annId)).toBeUndefined();
    expect(vp.store.getById(mapEl)?.layerId).toBe(MAP_LAYER_ID);
    expect(vp.store.getById(annEl)?.layerId).toBe(ANNOTATIONS_LAYER_ID);
  });

  it('drops empty auto-named leftovers and keeps named custom + player layers', () => {
    const vp = makeVp(); // default 'Layer 1' is empty
    vp.layerManager.createLayer('Traps');
    vp.layerManager.addLayerDirect({
      id: 'player-x',
      name: 'My elements',
      visible: true,
      locked: false,
      order: 1,
      opacity: 1,
    });
    migrateCanvasToContract(vp, 'dm');
    const names = vp.layerManager.getLayers().map(l => l.name);
    expect(names).not.toContain('Layer 1');
    expect(names).toContain('Traps');
    expect(vp.layerManager.getLayer('player-x')).toBeDefined();
  });

  it('repairs a dangling active layer and is change-false on second run', () => {
    const { vp, annId } = legacyVp();
    vp.layerManager.setActiveLayer(annId);
    migrateCanvasToContract(vp, 'dm');
    expect(
      vp.layerManager.getLayer(vp.layerManager.activeLayerId)
    ).toBeDefined();
    expect(migrateCanvasToContract(vp, 'dm')).toBe(false);
  });
});

describe('bug regression: DM-added image vs player token', () => {
  it('a remote player token paints above a DM annotations image', () => {
    const vp = makeVp();
    ensureCanonicalLayers(vp, 'dm');
    const imageId = addImageOn(vp, ANNOTATIONS_LAYER_ID, 0);
    // Remote token arrives referencing a layer this canvas has never seen.
    mirrorUnknownLayer(vp, 'player-char1', 'dm');
    const tokenId = addImageOn(vp, 'player-char1', 1000);
    const order = vp.store.getAll().map(el => el.id);
    expect(order.indexOf(tokenId)).toBeGreaterThan(order.indexOf(imageId));
  });
});
