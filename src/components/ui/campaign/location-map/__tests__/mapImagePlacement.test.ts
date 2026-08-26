import { describe, it, expect } from 'vitest';
import {
  nextMapImagePosition,
  MAP_IMAGE_GUTTER,
  type PlacedElement,
} from '@/components/ui/campaign/location-map/mapImagePlacement';
import { MAP_LAYER_ID } from '@/components/ui/campaign/location-map/layerContract';

const mapImage = (
  x: number,
  y: number,
  w: number,
  h: number
): PlacedElement => ({
  layerId: MAP_LAYER_ID,
  type: 'image',
  position: { x, y },
  size: { w, h },
});

describe('nextMapImagePosition', () => {
  it('returns the origin when no map images exist', () => {
    expect(nextMapImagePosition([])).toEqual({ x: 0, y: 0 });
  });

  it('ignores non-map and non-image elements', () => {
    const elements: PlacedElement[] = [
      { ...mapImage(0, 0, 100, 100), layerId: 'layer-annotations' },
      { ...mapImage(0, 0, 100, 100), type: 'grid' },
    ];
    expect(nextMapImagePosition(elements)).toEqual({ x: 0, y: 0 });
  });

  it('places at the right edge of the widest extent, top-aligned, with a gutter', () => {
    const elements = [mapImage(0, 50, 400, 300), mapImage(440, 0, 200, 200)];
    expect(nextMapImagePosition(elements)).toEqual({
      x: 640 + MAP_IMAGE_GUTTER,
      y: 0,
    });
  });
});
