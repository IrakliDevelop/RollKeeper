import { describe, it, expect, vi } from 'vitest';
import {
  ensurePlayerLayer,
  playerLayerId,
} from '@/components/ui/campaign/location-map/playerLayer';

import type { Viewport, Layer } from '@fieldnotes/core';

function fakeViewport(existing: Layer[] = []) {
  const layers = new Map(existing.map(l => [l.id, l]));
  let activeId: string | null = null;
  const vp = {
    layerManager: {
      getLayer: (id: string) => layers.get(id),
      addLayerDirect: vi.fn((layer: Layer) => {
        layers.set(layer.id, layer);
      }),
      setActiveLayer: vi.fn((id: string) => {
        activeId = id;
      }),
    },
  } as unknown as Viewport;
  return { vp, layers, activeId: () => activeId };
}

describe('ensurePlayerLayer', () => {
  it('creates an unlocked player layer and makes it active', () => {
    const { vp, layers, activeId } = fakeViewport();
    const id = ensurePlayerLayer(vp, 'char-1');
    expect(id).toBe(playerLayerId('char-1'));
    const layer = layers.get(id)!;
    expect(layer.locked).toBe(false);
    expect(layer.visible).toBe(true);
    expect(activeId()).toBe(id);
  });

  it('is idempotent: an existing layer is reused, not recreated (reload case)', () => {
    const existing: Layer = {
      id: playerLayerId('char-1'),
      name: 'My elements',
      visible: true,
      locked: false,
      order: 1,
      opacity: 1,
    };
    const { vp, activeId } = fakeViewport([existing]);
    ensurePlayerLayer(vp, 'char-1');
    expect(vp.layerManager.addLayerDirect).not.toHaveBeenCalled();
    expect(activeId()).toBe(existing.id);
  });

  it('the id is stable per character across calls/sessions', () => {
    expect(playerLayerId('abc')).toBe(playerLayerId('abc'));
    expect(playerLayerId('abc')).not.toBe(playerLayerId('xyz'));
  });
});
