import type { Bounds, CanvasElement, ElementStore } from '@fieldnotes/core';
import { getElementBounds } from '@fieldnotes/core';
import { MAP_LAYER_ID } from '../layerContract';

export function resolveMapImageBounds(
  store: ElementStore,
  fallbackSize: { w: number; h: number }
): Bounds {
  const images = store
    .snapshot()
    .filter(
      (el: CanvasElement) => el.type === 'image' && el.layerId === MAP_LAYER_ID
    );
  const visualBounds = images.flatMap(element => {
    const bounds = getElementBounds(element);
    if (!bounds) return [];
    const angle = element.rotation ?? 0;
    if (angle === 0) return [bounds];
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const w = bounds.w * cos + bounds.h * sin;
    const h = bounds.w * sin + bounds.h * cos;
    const centerX = bounds.x + bounds.w / 2;
    const centerY = bounds.y + bounds.h / 2;
    return [{ x: centerX - w / 2, y: centerY - h / 2, w, h }];
  });
  const union = visualBounds.length
    ? {
        x: Math.min(...visualBounds.map(bounds => bounds.x)),
        y: Math.min(...visualBounds.map(bounds => bounds.y)),
        w: 0,
        h: 0,
      }
    : null;
  if (union) {
    const maxX = Math.max(...visualBounds.map(bounds => bounds.x + bounds.w));
    const maxY = Math.max(...visualBounds.map(bounds => bounds.y + bounds.h));
    union.w = maxX - union.x;
    union.h = maxY - union.y;
  }
  if (union) return union;

  if (
    !Number.isFinite(fallbackSize.w) ||
    !Number.isFinite(fallbackSize.h) ||
    fallbackSize.w <= 0 ||
    fallbackSize.h <= 0
  ) {
    throw new Error('Fog needs a valid map image before it can be edited');
  }
  return { x: 0, y: 0, w: fallbackSize.w, h: fallbackSize.h };
}
