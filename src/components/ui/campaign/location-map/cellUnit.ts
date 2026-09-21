import type { ToolContext } from '@fieldnotes/core';

/**
 * One grid cell in world pixels, matching the SDK's own conversion
 * (TemplateTool drag-to-size and computeTemplateResize): on hex grids the
 * cell unit is √3 × the grid cell size. Single source of truth — using
 * a raw cell size on hex maps undersized spell templates by √3 (fixed in
 * fix/vtt-polish) and must never be re-derived inline.
 */
export interface GridConstraintInfo {
  gridType?: 'square' | 'hex';
  cellSize?: number;
}

/** Reads only the VTT grid metadata that RollKeeper consumes. */
export function gridConstraintInfo(
  ctx: Pick<ToolContext, 'constraintService'>
): GridConstraintInfo {
  const info = ctx.constraintService?.getConstraintInfo();
  if (!info || (info.gridType !== 'square' && info.gridType !== 'hex')) {
    return {};
  }
  const cellSize = info.cellSize;
  return typeof cellSize === 'number' &&
    Number.isFinite(cellSize) &&
    cellSize > 0
    ? { gridType: info.gridType, cellSize }
    : { gridType: info.gridType };
}

export function cellUnit(ctx: Pick<ToolContext, 'constraintService'>): number {
  const { gridType, cellSize } = gridConstraintInfo(ctx);
  if (cellSize === undefined) return 40;
  return gridType === 'hex' ? Math.sqrt(3) * cellSize : cellSize;
}
