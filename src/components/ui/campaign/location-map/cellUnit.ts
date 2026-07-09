import type { ToolContext } from '@fieldnotes/core';

/**
 * One grid cell in world pixels, matching the SDK's own conversion
 * (TemplateTool drag-to-size and computeTemplateResize): on hex grids the
 * cell unit is √3 × gridSize, not gridSize. Single source of truth — using
 * raw gridSize on hex maps undersized spell templates by √3 (fixed in
 * fix/vtt-polish) and must never be re-derived inline.
 */
export function cellUnit(
  ctx: Pick<ToolContext, 'gridSize' | 'gridType'>
): number {
  const gridSize = ctx.gridSize ?? 40;
  return ctx.gridType === 'hex' ? Math.sqrt(3) * gridSize : gridSize;
}
