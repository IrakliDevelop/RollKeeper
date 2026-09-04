import { describe, it, expect } from 'vitest';
import { ElementStore } from '@fieldnotes/core';
import type { CanvasElement } from '@fieldnotes/core';
import { resolveMapImageBounds } from '../resolveMapImageBounds';

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
    layerId: 'map',
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
});
