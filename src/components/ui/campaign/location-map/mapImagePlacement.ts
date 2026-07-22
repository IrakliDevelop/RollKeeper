import { MAP_LAYER_ID } from './layerContract';

export const MAP_IMAGE_GUTTER = 40;

/** Structural subset of CanvasElement — keeps the helper trivially testable. */
export interface PlacedElement {
  layerId: string;
  type: string;
  position: { x: number; y: number };
  size?: { w: number; h: number };
}

/**
 * Slot for the next map image: right edge of the existing map images'
 * bounding box, top-aligned, with a gutter. Origin when the map is empty.
 */
export function nextMapImagePosition(elements: PlacedElement[]): {
  x: number;
  y: number;
} {
  let right = -Infinity;
  let top = Infinity;
  for (const el of elements) {
    if (el.layerId !== MAP_LAYER_ID || el.type !== 'image') continue;
    const size = el.size ?? { w: 0, h: 0 };
    right = Math.max(right, el.position.x + size.w);
    top = Math.min(top, el.position.y);
  }
  if (right === -Infinity) return { x: 0, y: 0 };
  return { x: right + MAP_IMAGE_GUTTER, y: top };
}
