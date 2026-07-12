import { createImage, createShape } from '@fieldnotes/core';

import { cellUnit } from '@/components/ui/campaign/location-map/cellUnit';
import { tokenAvatarUrl } from '@/components/ui/campaign/location-map/PlayerTokenTool';
import { snapTokenCenter } from '@/components/ui/campaign/location-map/tokenSnap';

import type {
  CanvasElement,
  Point,
  PointerState,
  Tool,
  ToolContext,
} from '@fieldnotes/core';
import type { EncounterEntity, TokenCellSize } from '@/types/encounter';

export const COMBATANT_TOKEN_KIND = 'combatant';

/** Extra top-level keys carried on token elements — they survive the
 * FieldNotes store, export, and sync round-trips (verified in the spec). */
export interface CombatantTokenKeys {
  entityId: string;
  tokenKind: typeof COMBATANT_TOKEN_KIND;
}

export function isCombatantToken(
  el: CanvasElement
): el is CanvasElement & CombatantTokenKeys {
  const rec = el as Partial<CombatantTokenKeys>;
  return (
    rec.tokenKind === COMBATANT_TOKEN_KIND && typeof rec.entityId === 'string'
  );
}

/** Handoff ring colors: player emerald, legendary purple, then disposition. */
export function dispositionColor(
  entity: Pick<EncounterEntity, 'type' | 'playerDisposition'> &
    Partial<Pick<EncounterEntity, 'legendaryActions'>>
): string {
  if (entity.type === 'player') return '#12855C';
  if (entity.legendaryActions) return '#7C4DBC';
  if (entity.playerDisposition === 'ally') return '#2F6FD0';
  if (entity.playerDisposition === 'neutral') return '#6B7280';
  return '#C0392B';
}

export interface DmTokenConfig {
  entityId: string;
  name: string;
  avatarUrl?: string;
  color: string;
  /** Footprint in cells (Large=2 …); absent = 1. */
  tokenSize?: TokenCellSize;
  /** Fired once after placement (tool has handed back to select). */
  onPlaced: () => void;
}

/** Stamps a grid-snapped, creature-size-aware combatant token and adds it to the store. */
export function stampCombatantToken(
  config: Omit<DmTokenConfig, 'onPlaced'>,
  world: Point,
  ctx: ToolContext
): CanvasElement {
  const cells = config.tokenSize ?? 1;
  const center = snapTokenCenter(world, cells, ctx);
  const size = cells * cellUnit(ctx);
  const position = { x: center.x - size / 2, y: center.y - size / 2 };
  const layerId = ctx.activeLayerId ?? '';
  const src = tokenAvatarUrl(config.avatarUrl);

  const base = src
    ? createImage({
        position,
        size: { w: size, h: size },
        src,
        layerId,
      })
    : createShape({
        position,
        size: { w: size, h: size },
        shape: 'ellipse',
        fillColor: config.color,
        strokeColor: '#1e293b',
        strokeWidth: 2,
        layerId,
      });

  const token: CanvasElement & CombatantTokenKeys = {
    ...base,
    entityId: config.entityId,
    tokenKind: COMBATANT_TOKEN_KIND,
  };
  ctx.store.add(token);
  ctx.requestRender();
  return token;
}

/**
 * One-shot combatant placement, armed by the roster via the mutable
 * configRef (the canvas keeps the FIRST tool instance per name — same
 * pattern as SpellTemplateTool/PlayerTokenTool).
 */
export class DmTokenTool implements Tool {
  readonly name = 'dmtoken';

  private placedId: string | null = null;

  constructor(private readonly configRef: { current: DmTokenConfig | null }) {}

  onPointerDown(state: PointerState, ctx: ToolContext): void {
    const config = this.configRef.current;
    if (!config) {
      ctx.switchTool?.('select');
      return;
    }
    const world = ctx.camera.screenToWorld({ x: state.x, y: state.y });
    const token = stampCombatantToken(config, world, ctx);
    this.placedId = token.id;
  }

  onPointerMove(): void {}

  onPointerUp(_state: PointerState, ctx: ToolContext): void {
    const config = this.configRef.current;
    const placed = this.placedId !== null;
    this.placedId = null;
    ctx.switchTool?.('select');
    if (placed) config?.onPlaced();
  }

  onActivate(ctx: ToolContext): void {
    ctx.setCursor?.('crosshair');
  }

  onDeactivate(ctx: ToolContext): void {
    if (this.placedId) {
      ctx.store.remove(this.placedId);
      this.placedId = null;
      ctx.requestRender();
    }
    ctx.setCursor?.('default');
  }
}
