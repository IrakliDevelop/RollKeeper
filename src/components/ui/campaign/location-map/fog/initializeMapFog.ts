import type { FogManager, Bounds, FogStateV1 } from '@fieldnotes/core';
import { recommendedFogCellSize } from '@fieldnotes/core';

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
