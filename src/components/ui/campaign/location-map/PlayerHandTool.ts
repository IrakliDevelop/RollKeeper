import { HandTool, getElementBounds } from '@fieldnotes/core';

import type {
  CanvasElement,
  PointerState,
  SelectTool,
  ToolContext,
} from '@fieldnotes/core';

/** Whether this player could grab the element: visible and not locked at the
 * element or layer level. Mirrored DM layers are locked on player canvases,
 * so DM content (map image, grid, DM drawings) keeps panning. */
function isGrabbable(el: CanvasElement, ctx: ToolContext): boolean {
  if (el.locked) return false;
  if (el.type === 'grid') return false;
  if (el.layerId) {
    if (ctx.isLayerVisible && !ctx.isLayerVisible(el.layerId)) return false;
    if (ctx.isLayerLocked?.(el.layerId)) return false;
  }
  return true;
}

function hits(worldX: number, worldY: number, el: CanvasElement): boolean {
  const b = getElementBounds(el);
  if (!b) return false;
  return (
    worldX >= b.x && worldX <= b.x + b.w && worldY >= b.y && worldY <= b.y + b.h
  );
}

/**
 * Pan tool that hands off to Select when the press lands on something the
 * player can actually move (their token, templates, drawings): the SAME
 * gesture starts dragging the element, and the toolbar flips to Select.
 * Presses on DM content or empty map pan as usual.
 */
export class PlayerHandTool extends HandTool {
  constructor(private readonly selectTool: SelectTool) {
    super();
  }

  onPointerDown(state: PointerState, ctx: ToolContext): void {
    const world = ctx.camera.screenToWorld({ x: state.x, y: state.y });
    const grabbed = ctx.store
      .snapshot()
      .some(el => isGrabbable(el, ctx) && hits(world.x, world.y, el));
    if (grabbed) {
      ctx.switchTool?.('select');
      this.selectTool.onPointerDown(state, ctx);
      return;
    }
    super.onPointerDown(state, ctx);
  }
}
