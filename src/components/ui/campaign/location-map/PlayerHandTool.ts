import { HandTool, getElementBounds } from '@fieldnotes/core';

import type {
  CanvasElement,
  PointerState,
  SelectTool,
  ToolContext,
} from '@fieldnotes/core';

/** Token element types: PlayerTokenTool stamps an `image` (avatar) or a
 * `shape` ellipse fallback. ONLY these grab-through from pan — templates,
 * strokes, and arrows can cover large map areas, and treating them as
 * grabbable made panning nearly impossible after a big AoE was placed. */
const TOKEN_TYPES = new Set(['image', 'shape']);

/** Whether this player could grab the element: a token that is visible and
 * not locked at the element or layer level. Mirrored DM layers are locked on
 * player canvases, so DM content (map image, grid) keeps panning. This is
 * the DEFAULT predicate — callers may override it entirely (see
 * `PlayerHandTool`'s constructor) rather than layering additional checks on
 * top of it. */
function defaultIsGrabbable(el: CanvasElement, ctx: ToolContext): boolean {
  if (!TOKEN_TYPES.has(el.type)) return false;
  if (el.locked) return false;
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
 * Screen-px distance a press must travel before the pan tool starts moving
 * the camera. Mirrors fieldnotes' own (unexported) `DEFAULT_ACTIVATION_SLOP_PX`
 * used by its ElementActivation tap/double-tap detection: `Camera.pan`
 * notifies listeners on every call — including a 0px or sub-slop jitter move
 * — which bumps `cameraRevision`, and ElementActivation discards a tap whose
 * revision changed between pointerdown and pointerup. Without this dead
 * zone, HandTool's unconditional per-move `camera.pan` call made every tap
 * or double-tap on a non-grabbable element (another player's token, a
 * merchant/marker) register as a pan and silently eat the tap.
 */
const PAN_START_SLOP_PX = 8;

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Pan tool that hands off to Select when the press lands on something the
 * player can actually move (their TOKEN — see TOKEN_TYPES): the SAME
 * gesture starts dragging the element, and the toolbar flips to Select.
 * Presses on DM content or empty map pan as usual.
 *
 * `isGrabbable` is an optional override for what counts as "grabbable" —
 * when provided it REPLACES `defaultIsGrabbable` entirely (it is not ANDed
 * with the token-type/lock checks). The DM canvas passes
 * `el => isCombatantToken(el)` so only combatant tokens hand off to Select.
 */
export class PlayerHandTool extends HandTool {
  /**
   * Reference screen point deltas are computed from while panning: the press
   * point until the slop is crossed, then the most recent pointer position.
   * `null` whenever this tool isn't tracking an in-progress pan (no press
   * yet, or the press was handed off to Select).
   */
  private panAnchor: { x: number; y: number } | null = null;
  /** Whether the pan slop has been crossed for the current press. */
  private panStarted = false;

  constructor(
    private readonly selectTool: SelectTool,
    private readonly isGrabbable: (
      el: CanvasElement,
      ctx: ToolContext
    ) => boolean = defaultIsGrabbable
  ) {
    super();
  }

  onPointerDown(state: PointerState, ctx: ToolContext): void {
    const world = ctx.camera.screenToWorld({ x: state.x, y: state.y });
    const grabbed = ctx.store
      .snapshot()
      .some(el => this.isGrabbable(el, ctx) && hits(world.x, world.y, el));
    if (grabbed) {
      ctx.switchTool?.('select');
      this.selectTool.onPointerDown(state, ctx);
      return;
    }
    this.panAnchor = { x: state.x, y: state.y };
    this.panStarted = false;
    super.onPointerDown(state, ctx);
  }

  onPointerMove(state: PointerState, ctx: ToolContext): void {
    if (!this.panAnchor) return;
    const here = { x: state.x, y: state.y };

    if (!this.panStarted) {
      // Dead zone: don't move the camera (and never call camera.pan) until
      // the press has moved more than the slop distance from where it
      // started — a tap, double-tap, or sub-slop jitter must not pan.
      if (distance(this.panAnchor, here) <= PAN_START_SLOP_PX) return;
      this.panStarted = true;
      // Pan by the full accumulated delta since the press so crossing the
      // slop doesn't lose the movement that happened inside the dead zone.
      ctx.camera.pan(here.x - this.panAnchor.x, here.y - this.panAnchor.y);
      this.panAnchor = here;
      return;
    }

    const dx = here.x - this.panAnchor.x;
    const dy = here.y - this.panAnchor.y;
    if (dx === 0 && dy === 0) return;
    this.panAnchor = here;
    ctx.camera.pan(dx, dy);
  }

  onPointerUp(state: PointerState, ctx: ToolContext): void {
    this.resetPan();
    super.onPointerUp(state, ctx);
  }

  // A tool switch mid-press never delivers this tool's pointerup; drop the
  // pan so reactivating doesn't resume from a stale anchor.
  onDeactivate(ctx: ToolContext): void {
    this.resetPan();
    super.onDeactivate(ctx);
  }

  private resetPan(): void {
    this.panAnchor = null;
    this.panStarted = false;
  }
}
