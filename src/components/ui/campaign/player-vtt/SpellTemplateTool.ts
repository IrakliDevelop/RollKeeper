import { createTemplate } from '@fieldnotes/vtt';

import { cellUnit } from '@/components/ui/campaign/location-map/cellUnit';
import { TEMPLATE_ELEMENT_ZINDEX } from '@/components/ui/campaign/location-map/tokenSnap';

import type { Point, PointerState, Tool, ToolContext } from '@fieldnotes/core';
import type { AoeShape } from '@/types/spellAoe';

export interface SpellTemplateConfig {
  shape: AoeShape;
  sizeFeet: number;
  /** Independent line-template width in feet. */
  widthFeet?: number;
  /** Called once after the template lands (tool has already switched to select). */
  onPlaced: () => void;
}

const FEET_PER_CELL = 5;
const SPELL_FILL = '#7C3AB7';

/**
 * One-shot fixed-size AoE placement, armed by the casting flow via the
 * mutable configRef (the canvas keeps the FIRST tool instance per name, so
 * per-cast config must flow through a ref — same pattern as PlayerTokenTool).
 * circle/square: tap places. cone/line: press places at angle 0, dragging
 * aims (live element updates sync to everyone), release finalizes.
 */
export class SpellTemplateTool implements Tool {
  readonly name = 'spelltemplate';

  private placedId: string | null = null;
  private origin: Point | null = null;
  private aiming = false;

  constructor(
    private readonly configRef: { current: SpellTemplateConfig | null }
  ) {}

  onPointerDown(state: PointerState, ctx: ToolContext): void {
    const config = this.configRef.current;
    if (!config) {
      ctx.switchTool?.('select');
      return;
    }
    const world = ctx.camera.screenToWorld({ x: state.x, y: state.y });
    const origin = ctx.constraintService?.constrainPoint(world) ?? world;
    const cellPx = cellUnit(ctx);
    // The renderer draws squares as fillRect(cx - r/2, cy - r/2, r, r):
    // `radius` is the FULL side, so a 20ft cube = 20ft across, same formula
    // as circle (where radius really is a radius).
    const radiusPx = (config.sizeFeet / FEET_PER_CELL) * cellPx;
    // Line spells render as RECTANGLE templates (core 0.48): a directional
    // AoE with independent length and width, so Lightning-Bolt-style lines
    // finally honor their real widthFeet instead of the default line width.
    const isLine = config.shape === 'line';
    const widthPx = isLine
      ? ((config.widthFeet ?? FEET_PER_CELL) / FEET_PER_CELL) * cellPx
      : undefined;

    const el = createTemplate({
      position: origin,
      templateShape: isLine ? 'rectangle' : config.shape,
      radius: radiusPx,
      angle: 0,
      ...(widthPx !== undefined ? { width: widthPx } : {}),
      fillColor: SPELL_FILL,
      strokeColor: SPELL_FILL,
      opacity: 0.28,
      feetPerCell: FEET_PER_CELL,
      radiusFeet: config.sizeFeet,
      renderStyle: 'geometric',
      layerId: ctx.activeLayerId ?? '',
      zIndex: TEMPLATE_ELEMENT_ZINDEX,
    });
    const adapter = ctx.elementRegistry?.getAdapter('vtt:template');
    const runtime = adapter ? adapter.wrap(el) : el;
    ctx.store.add(runtime);
    this.placedId = el.id;
    this.origin = origin;
    this.aiming = config.shape === 'cone' || config.shape === 'line';
    ctx.requestRender();
  }

  onPointerMove(state: PointerState, ctx: ToolContext): void {
    if (!this.aiming || !this.placedId || !this.origin) return;
    const world = ctx.camera.screenToWorld({ x: state.x, y: state.y });
    const angle = Math.atan2(world.y - this.origin.y, world.x - this.origin.x);
    const current = ctx.store.getById(this.placedId);
    if (
      current?.type === 'extension' &&
      current.extensionType === 'vtt:template'
    ) {
      ctx.store.update(this.placedId, {
        data: { ...current.data, angle },
      });
    } else {
      // Compatibility for test/custom stores that have no registered adapter.
      ctx.store.update(this.placedId, { angle });
    }
    ctx.requestRender();
  }

  onPointerUp(_state: PointerState, ctx: ToolContext): void {
    const config = this.configRef.current;
    const placed = this.placedId !== null;
    this.placedId = null;
    this.origin = null;
    this.aiming = false;
    ctx.switchTool?.('select');
    if (placed) config?.onPlaced();
  }

  onActivate(ctx: ToolContext): void {
    ctx.setCursor?.('crosshair');
  }

  onDeactivate(ctx: ToolContext): void {
    // An in-flight id here means the gesture was aborted (Escape / disarm)
    // between pointer-down and pointer-up — remove the half-placed element.
    // Normal completion clears placedId BEFORE switching tools.
    if (this.placedId) {
      ctx.store.remove(this.placedId);
      this.placedId = null;
      this.origin = null;
      this.aiming = false;
      ctx.requestRender();
    }
    ctx.setCursor?.('default');
  }
}
