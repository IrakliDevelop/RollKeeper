import {
  createShape,
  createText,
  type Tool,
  type ToolContext,
  type PointerState,
} from '@fieldnotes/core';

const TOKEN_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

/** Deterministic per-character token color (canvas paint, not themed UI). */
export function tokenColorForId(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TOKEN_COLORS[h % TOKEN_COLORS.length];
}

const TOKEN_SIZE = 40; // ≈ one 5-ft cell at default 50px grid

/**
 * Places the player's token: a colored ellipse plus a small name label.
 * Ownership is stamped by the relay; other players can't move it.
 */
export class PlayerTokenTool implements Tool {
  readonly name = 'token';

  constructor(
    private readonly color: string,
    private readonly label: string
  ) {}

  onPointerDown(state: PointerState, ctx: ToolContext): void {
    const world = ctx.camera.screenToWorld({ x: state.x, y: state.y });
    ctx.store.add(
      createShape({
        position: { x: world.x - TOKEN_SIZE / 2, y: world.y - TOKEN_SIZE / 2 },
        size: { w: TOKEN_SIZE, h: TOKEN_SIZE },
        shape: 'ellipse',
        fillColor: this.color,
        strokeColor: '#1e293b',
        strokeWidth: 2,
        layerId: ctx.activeLayerId ?? '',
      })
    );
    ctx.store.add(
      createText({
        position: { x: world.x - TOKEN_SIZE, y: world.y + TOKEN_SIZE / 2 + 4 },
        text: this.label,
        fontSize: 12,
        color: '#f8fafc',
        textAlign: 'center',
        size: { w: TOKEN_SIZE * 2, h: 16 },
        layerId: ctx.activeLayerId ?? '',
      })
    );
    ctx.requestRender();
  }

  onPointerMove(): void {}
  onPointerUp(): void {}
}
