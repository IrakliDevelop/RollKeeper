import type { Bounds } from '@fieldnotes/core';
import {
  recommendedFogCellSize,
  type FogManager,
  type FogStateV1,
} from '@fieldnotes/vtt';

export function initializeMapFog(
  fogManager: FogManager,
  bounds: Bounds
): FogStateV1 {
  return fogManager.initialize({
    bounds,
    base: 'covered',
    cellSize: recommendedFogCellSize(bounds),
  });
}
