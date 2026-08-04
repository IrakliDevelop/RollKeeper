import { describe, it, expect, vi } from 'vitest';
import { ElementStore, LayerManager, type Layer } from '@fieldnotes/core';
import type { RemoteLayerUpdate } from '@fieldnotes/sync';
import {
  MAP_LAYER_ID,
  ANNOTATIONS_LAYER_ID,
  ANNOTATIONS_LAYER_ORDER,
  CUSTOM_BAND_ORDER,
  PLAYER_BAND_ORDER,
  ensureCanonicalLayers,
  migrateCanvasToContract,
  subscribePinCanonicalLayers,
  type ViewportLike,
} from '@/components/ui/campaign/location-map/layerContract';
import {
  makeApplyRemoteLayer,
  publishOwnedLayers,
} from '@/components/ui/campaign/location-map/layerSync';

function makeVp(role: 'dm' | 'player' = 'dm'): ViewportLike {
  const store = new ElementStore();
  const layerManager = new LayerManager(store);
  const vp = { store, layerManager };
  ensureCanonicalLayers(vp, role);
  migrateCanvasToContract(vp, role);
  return vp;
}

function def(id: string, overrides: Partial<Layer> = {}): Layer {
  return {
    id,
    name: id,
    visible: true,
    locked: false,
    order: CUSTOM_BAND_ORDER,
    opacity: 1,
    ...overrides,
  };
}

function upsert(definition: Layer, version = 1): RemoteLayerUpdate {
  return {
    source: 'op',
    record: { id: definition.id, version, editor: 'remote', definition },
  };
}

function tombstone(id: string, version = 2): RemoteLayerUpdate {
  return { source: 'op', record: { id, version, editor: 'remote' } };
}

describe('makeApplyRemoteLayer', () => {
  it('creates a missing layer from a remote definition and reports it', () => {
    const vp = makeVp();
    const onApplied = vi.fn();
    const apply = makeApplyRemoteLayer(vp, 'dm', { onApplied });
    apply(upsert(def('layer-tokens', { name: 'Tokens', opacity: 0.8 })));
    const created = vp.layerManager.getLayer('layer-tokens');
    expect(created?.name).toBe('Tokens');
    expect(created?.opacity).toBe(0.8);
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it('updates an existing layer in place', () => {
    const vp = makeVp();
    const apply = makeApplyRemoteLayer(vp, 'dm');
    apply(upsert(def('layer-tokens')));
    apply(upsert(def('layer-tokens', { name: 'Renamed', visible: false }), 2));
    const updated = vp.layerManager.getLayer('layer-tokens');
    expect(updated?.name).toBe('Renamed');
    expect(updated?.visible).toBe(false);
    expect(
      vp.layerManager.getLayers().filter(l => l.id === 'layer-tokens')
    ).toHaveLength(1);
  });

  it('ignores remote records for the canonical bands so role locks are never stomped', () => {
    const vp = makeVp('player');
    const apply = makeApplyRemoteLayer(vp, 'player');
    // A DM's copy of annotations is unlocked; applying it here would unlock
    // DM content for this player.
    apply(upsert(def(ANNOTATIONS_LAYER_ID, { locked: false, order: 7 })));
    apply(tombstone(MAP_LAYER_ID));
    expect(vp.layerManager.getLayer(ANNOTATIONS_LAYER_ID)?.locked).toBe(true);
    expect(vp.layerManager.getLayer(ANNOTATIONS_LAYER_ID)?.order).toBe(
      ANNOTATIONS_LAYER_ORDER
    );
    expect(vp.layerManager.getLayer(MAP_LAYER_ID)).toBeDefined();
  });

  it('locks every remote layer for players except their own', () => {
    const vp = makeVp('player');
    const own = 'player-me';
    vp.layerManager.addLayerDirect(def(own, { order: PLAYER_BAND_ORDER }));
    const apply = makeApplyRemoteLayer(vp, 'player', { ownLayerId: own });

    apply(
      upsert(def('player-other', { order: PLAYER_BAND_ORDER, locked: false }))
    );
    apply(upsert(def('layer-dm-custom', { locked: false })));
    // Own-layer definition arriving from the hub (e.g. same character on
    // another device) must not lock the owner out.
    apply(upsert(def(own, { order: PLAYER_BAND_ORDER, locked: false }), 3));

    expect(vp.layerManager.getLayer('player-other')?.locked).toBe(true);
    expect(vp.layerManager.getLayer('layer-dm-custom')?.locked).toBe(true);
    expect(vp.layerManager.getLayer(own)?.locked).toBe(false);
  });

  it('applies lock state as-is for the DM and always locked for the display', () => {
    const dmVp = makeVp();
    makeApplyRemoteLayer(
      dmVp,
      'dm'
    )(upsert(def('player-char1', { order: PLAYER_BAND_ORDER, locked: false })));
    expect(dmVp.layerManager.getLayer('player-char1')?.locked).toBe(false);

    const displayVp = makeVp('player');
    makeApplyRemoteLayer(
      displayVp,
      'display'
    )(upsert(def('layer-x', { locked: false })));
    expect(displayVp.layerManager.getLayer('layer-x')?.locked).toBe(true);
  });

  it('removes a layer on a tombstone and repairs a dangling active layer', () => {
    const vp = makeVp();
    const apply = makeApplyRemoteLayer(vp, 'dm');
    apply(upsert(def('layer-tokens')));
    vp.layerManager.setActiveLayer('layer-tokens');

    apply(tombstone('layer-tokens'));
    expect(vp.layerManager.getLayer('layer-tokens')).toBeUndefined();
    expect(vp.layerManager.activeLayerId).toBe(ANNOTATIONS_LAYER_ID);
  });

  it('never removes the player own layer and ignores tombstones for unknown ids', () => {
    const vp = makeVp('player');
    const own = 'player-me';
    vp.layerManager.addLayerDirect(def(own, { order: PLAYER_BAND_ORDER }));
    const onApplied = vi.fn();
    const apply = makeApplyRemoteLayer(vp, 'player', {
      ownLayerId: own,
      onApplied,
    });

    apply(tombstone(own));
    apply(tombstone('never-seen'));
    expect(vp.layerManager.getLayer(own)).toBeDefined();
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('keeps bands pinned when combined with the pin subscription', () => {
    const vp = makeVp();
    subscribePinCanonicalLayers(vp, () => ({ annotationsLocked: false }));
    const apply = makeApplyRemoteLayer(vp, 'dm');
    // Remote order lands inside its band even if the record carries a raw value.
    apply(upsert(def('layer-tokens', { order: 42 })));
    apply(upsert(def('player-char1', { order: 999 })));
    expect(vp.layerManager.getLayer('layer-tokens')?.order).toBe(
      CUSTOM_BAND_ORDER
    );
    expect(vp.layerManager.getLayer('player-char1')?.order).toBe(
      PLAYER_BAND_ORDER
    );
  });
});

describe('publishOwnedLayers', () => {
  it('dm publishes custom layers only — never canonical or player layers', () => {
    const vp = makeVp();
    vp.layerManager.addLayerDirect(
      def('layer-props', { order: CUSTOM_BAND_ORDER })
    );
    vp.layerManager.addLayerDirect(
      def('player-char1', { order: PLAYER_BAND_ORDER })
    );
    const published: string[] = [];
    publishOwnedLayers(vp, 'dm', d => published.push(d.id));
    expect(published).toEqual(['layer-props']);
  });

  it('player publishes exactly their own layer', () => {
    const vp = makeVp('player');
    vp.layerManager.addLayerDirect(
      def('player-me', { order: PLAYER_BAND_ORDER })
    );
    vp.layerManager.addLayerDirect(
      def('player-other', { order: PLAYER_BAND_ORDER })
    );
    const published: string[] = [];
    publishOwnedLayers(vp, 'player', d => published.push(d.id), 'player-me');
    expect(published).toEqual(['player-me']);
  });

  it('player publishes nothing when the own layer does not exist yet', () => {
    const vp = makeVp('player');
    const published: string[] = [];
    publishOwnedLayers(vp, 'player', d => published.push(d.id), 'player-me');
    expect(published).toEqual([]);
  });
});
