import type {
  Point,
  Size,
  Tool,
  ToolContext,
  PointerState,
} from '@fieldnotes/core';
import { cellUnit } from './cellUnit';
import type { MarkerKind, MarkerColorKey } from './markerData';

export const MARKER_TOOL_NAME = 'marker';

/** Screen-pixel movement above which a gesture is a drag, not a tap. PingInput parity. */
export const MARKER_TOOL_SLOP_PX = 8;

export interface PlaceMarkerRequest {
  /** World-space TOP-LEFT of the new element. */
  position: Point;
  /** Square; side = cellUnit(ctx). */
  size: Size;
  kind: MarkerKind;
  color: MarkerColorKey;
}

/**
 * DM marker placement tool: a tap emits a `PlaceMarkerRequest` and writes
 * nothing. All persistence (building the element, saving the detail record,
 * stamping DM-only audience, and the store.add) is the caller's job —
 * `useMarkerWrites` owns that cross-store write ordering (spec §6.7) and
 * this tool must never bypass it by touching `ctx.store` itself.
 *
 * `kindRef` / `colorRef` are read at placement time, not captured at
 * construction: the canvas keeps the first registered tool instance (see
 * `PlayerTokenTool.ts:154-161`), so a value captured in the constructor
 * would go stale the moment the DM changes the kind/color picker.
 *
 * After a successful placement request it switches to select mode so the DM
 * can immediately click the new marker, open its workflow, or move it.
 *
 * No grid snapping: markers are annotations pinned to where the DM clicked,
 * not tokens that need to align to a cell. Do not "fix" this to snap.
 */
export class DmMarkerTool implements Tool {
  readonly name = MARKER_TOOL_NAME;

  private downScreen: Point | null = null;
  private downWorld: Point | null = null;
  private isDrag = false;

  constructor(
    private readonly kindRef: { current: MarkerKind },
    private readonly colorRef: { current: MarkerColorKey },
    private readonly onPlaceMarker: (request: PlaceMarkerRequest) => void
  ) {}

  onPointerDown(state: PointerState, ctx: ToolContext): void {
    this.downScreen = { x: state.x, y: state.y };
    this.downWorld = ctx.camera.screenToWorld({ x: state.x, y: state.y });
    this.isDrag = false;
  }

  onPointerMove(state: PointerState): void {
    if (!this.downScreen || this.isDrag) return;
    const dx = state.x - this.downScreen.x;
    const dy = state.y - this.downScreen.y;
    // Sticky once tripped: intentionally never re-evaluated against the
    // down point once true, so a drag-then-return-to-origin gesture still
    // does not place a marker.
    if (Math.sqrt(dx * dx + dy * dy) > MARKER_TOOL_SLOP_PX) {
      this.isDrag = true;
    }
  }

  onPointerUp(_state: PointerState, ctx: ToolContext): void {
    const downWorld = this.downWorld;
    const wasDrag = this.isDrag;
    this.downScreen = null;
    this.downWorld = null;
    this.isDrag = false;

    if (wasDrag || !downWorld) return;

    const side = cellUnit(ctx);
    const size: Size = { w: side, h: side };
    const position: Point = {
      x: downWorld.x - size.w / 2,
      y: downWorld.y - size.h / 2,
    };

    this.onPlaceMarker({
      position,
      size,
      kind: this.kindRef.current,
      color: this.colorRef.current,
    });
    ctx.switchTool?.('select');
  }
}
