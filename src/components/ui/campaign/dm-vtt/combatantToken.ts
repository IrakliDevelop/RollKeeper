import { createImage, createShape } from '@fieldnotes/core';

import { cellUnit } from '@/components/ui/campaign/location-map/cellUnit';
import { tokenAvatarUrl } from '@/components/ui/campaign/location-map/PlayerTokenTool';
import {
  snapTokenCenter,
  TOKEN_ELEMENT_ZINDEX,
} from '@/components/ui/campaign/location-map/tokenSnap';

import type {
  CanvasElement,
  ElementStore,
  Point,
  PointerState,
  Tool,
  ToolContext,
} from '@fieldnotes/core';
import type { EncounterEntity, TokenCellSize } from '@/types/encounter';

export const COMBATANT_TOKEN_KIND = 'combatant';

/** Re-exported from tokenSnap.ts (single source of truth — location-map
 * must not import from dm-vtt, so the constant lives there and this file
 * imports it, not the reverse). */
export const COMBATANT_TOKEN_ZINDEX = TOKEN_ELEMENT_ZINDEX;

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
        zIndex: COMBATANT_TOKEN_ZINDEX,
      })
    : createShape({
        position,
        size: { w: size, h: size },
        shape: 'ellipse',
        fillColor: config.color,
        strokeColor: '#1e293b',
        strokeWidth: 2,
        layerId,
        zIndex: COMBATANT_TOKEN_ZINDEX,
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

/**
 * Re-applies an entity's portrait/size to its already-placed tokens.
 * Same element type → narrow store.update (NEVER spread a captured element
 * into the patch — update() shallow-merges and stale fields would resurrect).
 * Ellipse↔image transitions → remove + re-add preserving keys/layer/center.
 */
export function restampCombatantTokens(
  store: ElementStore,
  entity: EncounterEntity,
  ctx: ToolContext
): void {
  const cells = entity.tokenSize ?? 1;
  const size = cells * cellUnit(ctx);
  const src = tokenAvatarUrl(entity.avatarUrl);
  for (const el of store.getAll()) {
    if (!isCombatantToken(el) || el.entityId !== entity.id) continue;
    const rect = el as unknown as {
      id: string;
      type: string;
      layerId?: string;
      position: Point;
      size?: { w: number; h: number };
    };
    const oldSize = rect.size ?? { w: size, h: size };
    const oldCenter = {
      x: rect.position.x + oldSize.w / 2,
      y: rect.position.y + oldSize.h / 2,
    };
    const center = snapTokenCenter(oldCenter, cells, ctx);
    const position = { x: center.x - size / 2, y: center.y - size / 2 };
    const wantsImage = src !== null;
    const isImage = rect.type === 'image';

    if (wantsImage === isImage) {
      store.update(
        rect.id,
        wantsImage
          ? {
              src: src as string,
              size: { w: size, h: size },
              position,
              zIndex: COMBATANT_TOKEN_ZINDEX,
            }
          : {
              fillColor: entity.color ?? dispositionColor(entity),
              size: { w: size, h: size },
              position,
              zIndex: COMBATANT_TOKEN_ZINDEX,
            }
      );
    } else {
      const layerId = rect.layerId ?? '';
      const base = wantsImage
        ? createImage({
            position,
            size: { w: size, h: size },
            src: src as string,
            layerId,
            zIndex: COMBATANT_TOKEN_ZINDEX,
          })
        : createShape({
            position,
            size: { w: size, h: size },
            shape: 'ellipse',
            fillColor: entity.color ?? dispositionColor(entity),
            strokeColor: '#1e293b',
            strokeWidth: 2,
            layerId,
            zIndex: COMBATANT_TOKEN_ZINDEX,
          });
      const token: CanvasElement & CombatantTokenKeys = {
        ...base,
        entityId: entity.id,
        tokenKind: COMBATANT_TOKEN_KIND,
      };
      store.remove(rect.id);
      store.add(token);
    }
  }
}
