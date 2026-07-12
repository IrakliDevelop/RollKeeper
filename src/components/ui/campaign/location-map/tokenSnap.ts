import { smartSnap } from '@fieldnotes/core';

import type { Point, ToolContext } from '@fieldnotes/core';

/**
 * zIndex stamped on every token element (DM combatant tokens and player
 * self-tokens). Players mirror unknown remote layers at `order: -1`
 * (PlayerBattleMapCanvas), and the SDK breaks (layerOrder, zIndex) ties by
 * element-arrival order — after a resync, a token can land beneath the map
 * background (zIndex 0). Elevating tokens above every map-background
 * element guarantees they always paint on top, regardless of arrival order.
 * Single source of truth: dm-vtt/combatantToken.ts re-exports this value as
 * COMBATANT_TOKEN_ZINDEX (location-map must not import from dm-vtt).
 */
export const TOKEN_ELEMENT_ZINDEX = 1000;

/** Templates paint above the map background, below tokens. */
export const TEMPLATE_ELEMENT_ZINDEX = 900;

/**
 * Grid-aware token CENTER snap for an N×N-cell footprint.
 *
 * Square grids: odd N centers in a cell (a 1×1 fills one cell — the old
 * smartSnap-only path put every token on an intersection, straddling four);
 * even N centers on an intersection so the footprint fills cells exactly.
 * Hex grids and snapping-off defer to smartSnap unchanged (snapToHexCenter
 * already centers in cells; identity when snapping is disabled).
 */
export function snapTokenCenter(
  world: Point,
  cells: number,
  ctx: ToolContext
): Point {
  const gridSize = ctx.gridSize;
  // Mirror smartSnap's own routing: only square-grid snapping gets parity math.
  if (!ctx.snapToGrid || !gridSize || ctx.gridType === 'hex') {
    return smartSnap(world, ctx);
  }
  if (cells % 2 === 0) {
    return {
      x: Math.round(world.x / gridSize) * gridSize,
      y: Math.round(world.y / gridSize) * gridSize,
    };
  }
  return {
    x: (Math.round((world.x - gridSize / 2) / gridSize) + 0.5) * gridSize,
    y: (Math.round((world.y - gridSize / 2) / gridSize) + 0.5) * gridSize,
  };
}
