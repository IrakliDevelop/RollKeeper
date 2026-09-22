import { cellUnit } from '@/components/ui/campaign/location-map/cellUnit';
import type { ToolContext } from '@fieldnotes/core';

export type Point = { x: number; y: number };

/**
 * Calculate distance in feet between two world points.
 *
 * Formula: euclidean distance ÷ cellUnit × feetPerCell, then Math.round.
 * - Square grid: cellUnit = cellSize (e.g., 50px = 10ft)
 * - Hex grid: cellUnit = √3 × cellSize (e.g., √3×40px = 5ft)
 *
 * @param start Starting world position
 * @param current Current world position
 * @param ctx Grid constraint service
 * @param feetPerCell Feet per cell (default 5)
 * @returns Distance in feet, rounded to nearest integer
 */
export function dragDistanceFeet(
  start: Point,
  current: Point,
  ctx: Pick<ToolContext, 'constraintService'>,
  feetPerCell: number = 5
): number {
  // Calculate euclidean distance in world pixels
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const distancePixels = Math.hypot(dx, dy);

  // Get the cell unit (accounts for hex vs square grids)
  const unit = cellUnit(ctx);

  // Convert pixels to cells, then to feet
  const distanceCells = distancePixels / unit;
  const distanceFt = distanceCells * feetPerCell;

  // Round to nearest integer
  return Math.round(distanceFt);
}
