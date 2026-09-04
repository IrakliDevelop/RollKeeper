import { describe, it, expect } from 'vitest';
import { ElementStore } from '@fieldnotes/core';
import type { CanvasElement } from '@fieldnotes/core';
import { resolveMapImageBounds } from '../resolveMapImageBounds';
import { MAP_LAYER_ID } from '../../layerContract';

function imageElement(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number
): CanvasElement {
  return {
    id,
    type: 'image',
    position: { x, y },
    size: { w, h },
    zIndex: 0,
    locked: false,
    layerId: MAP_LAYER_ID,
    src: 'test.png',
  } as CanvasElement;
}

describe('resolveMapImageBounds', () => {
  it('returns fallback when store has no images', () => {
    const store = new ElementStore();
    const bounds = resolveMapImageBounds(store, { w: 800, h: 600 });
    expect(bounds).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });

  it('returns bounds of a single image', () => {
    const store = new ElementStore();
    store.add(imageElement('img-1', 10, 20, 100, 80));
    const bounds = resolveMapImageBounds(store, { w: 800, h: 600 });
    expect(bounds).toEqual({ x: 10, y: 20, w: 100, h: 80 });
  });

  it('returns union of multiple images', () => {
    const store = new ElementStore();
    store.add(imageElement('img-1', 0, 0, 100, 100));
    store.add(imageElement('img-2', 50, 80, 200, 150));
    const bounds = resolveMapImageBounds(store, { w: 800, h: 600 });
    expect(bounds).toEqual({ x: 0, y: 0, w: 250, h: 230 });
  });

  it('handles negative positions', () => {
    const store = new ElementStore();
    store.add(imageElement('img-1', -50, -30, 100, 100));
    store.add(imageElement('img-2', 20, 40, 80, 60));
    const bounds = resolveMapImageBounds(store, { w: 800, h: 600 });
    expect(bounds).toEqual({ x: -50, y: -30, w: 150, h: 130 });
  });

  it('ignores non-image elements', () => {
    const store = new ElementStore();
    store.add({
      id: 'shape-1',
      type: 'shape',
      shape: 'rectangle',
      position: { x: 0, y: 0 },
      size: { w: 500, h: 500 },
      zIndex: 0,
      locked: false,
      layerId: 'map',
      strokeColor: '#000',
      strokeWidth: 1,
      fillColor: '#fff',
    } as CanvasElement);
    const bounds = resolveMapImageBounds(store, { w: 200, h: 150 });
    expect(bounds).toEqual({ x: 0, y: 0, w: 200, h: 150 });
  });

  it('ignores images outside the canonical map layer', () => {
    const store = new ElementStore();
    const annotation = imageElement('token-image', -500, -500, 2000, 2000);
    store.add({ ...annotation, layerId: 'layer-annotations' } as CanvasElement);
    store.add(imageElement('map-image', 10, 20, 100, 80));

    expect(resolveMapImageBounds(store, { w: 800, h: 600 })).toEqual({
      x: 10,
      y: 20,
      w: 100,
      h: 80,
    });
  });

  it('uses the rotated visual bounds of map images', () => {
    const store = new ElementStore();
    store.add({
      ...imageElement('rotated', 0, 0, 100, 50),
      rotation: Math.PI / 2,
    } as CanvasElement);

    const bounds = resolveMapImageBounds(store, { w: 800, h: 600 });
    expect(bounds.x).toBeCloseTo(25);
    expect(bounds.y).toBeCloseTo(-25);
    expect(bounds.w).toBeCloseTo(50);
    expect(bounds.h).toBeCloseTo(100);
  });

  it('fails closed when neither a map image nor valid fallback exists', () => {
    const store = new ElementStore();
    expect(() => resolveMapImageBounds(store, { w: 0, h: 600 })).toThrow(
      /valid map image/i
    );
  });
});
