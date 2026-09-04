import type { Bounds, CanvasElement, ElementStore } from '@fieldnotes/core';
import { getElementsBoundingBox } from '@fieldnotes/core';

export function resolveMapImageBounds(
  store: ElementStore,
  fallbackSize: { w: number; h: number }
): Bounds {
  const images = store
    .snapshot()
    .filter((el: CanvasElement) => el.type === 'image');
  const union = getElementsBoundingBox(images);
  return union ?? { x: 0, y: 0, w: fallbackSize.w, h: fallbackSize.h };
}
