import type { CanvasElement, SelectTool, Viewport } from '@fieldnotes/core';

import { stampCombatantToken } from '@/components/ui/campaign/dm-vtt/combatantToken';
import type { PendingTokenPlacement } from '@/components/ui/campaign/dm-vtt/TokenPlacementController';
import { cellUnit } from '@/components/ui/campaign/location-map/cellUnit';
import { PLAYER_BAND_ORDER } from '@/components/ui/campaign/location-map/layerContract';
import {
  canonicalPlayerBand,
  playerLayerId,
} from '@/components/ui/campaign/location-map/playerLayer';
import type { BattleMapConnection } from '@/lib/battlemapSync';
import type { TokenCellSize } from '@/types/encounter';

import type { TableRosterCanvas } from './useTableRosterState';

/** Deterministic arrival fan (cells): centre, then rings around it. */
const FAN: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [2, 0],
  [-2, 0],
  [0, 2],
  [0, -2],
];

export function arrivalFanOffset(slot: number): { dx: number; dy: number } {
  const [dx, dy] = FAN[slot % FAN.length]!;
  const ring = Math.floor(slot / FAN.length) * 3;
  return { dx: dx + ring, dy };
}

const CONTROL_KEYS = [
  'tokenKind',
  'characterId',
  'sceneMemberId',
  'entityId',
  'layerId',
  // PR07 P10: a changed table representation re-runs reconciliation.
  'tableRepresentation',
] as const;

/**
 * The DM canvas operations the Table roster performs after a committed
 * roster command: arm placement of the bound token id, convert a token's
 * control fields, select, and teach the room a party band. Every write is a
 * local DM edit, so it travels the v1 room exactly like any canvas edit.
 */
export function createTableRosterCanvas(options: {
  viewport: Viewport;
  connection: Pick<BattleMapConnection, 'publishLayerUpsert'> | null;
  onArm: (pending: PendingTokenPlacement | null) => void;
}): TableRosterCanvas {
  const { viewport, connection, onArm } = options;
  return {
    elements: () =>
      viewport.store.getAll() as unknown as Record<string, unknown>[],
    subscribe: listener => {
      const offs = [
        viewport.store.on('add', listener),
        viewport.store.on('remove', listener),
        viewport.store.on('clear', listener),
        viewport.store.on('batch', listener),
        viewport.store.on('update', event => {
          const previous = event.previous as unknown as Record<string, unknown>;
          const current = event.current as unknown as Record<string, unknown>;
          if (CONTROL_KEYS.some(key => previous[key] !== current[key]))
            listener();
        }),
      ];
      return () => offs.forEach(off => off());
    },
    select: tokenIds => {
      viewport.toolManager.setTool('select', viewport.toolContext);
      viewport.toolManager
        .getTool<SelectTool>('select')
        ?.setSelection(tokenIds);
      viewport.requestRender();
    },
    armPlacement: request =>
      onArm({
        entityName: request.name,
        config: {
          entityId: request.sceneMemberId,
          name: request.name,
          avatarUrl: request.avatarUrl,
          color: request.color,
          tokenSize: request.tokenCells as TokenCellSize,
          tokenId: request.tokenId,
          fields: request.fields,
          // Synchronous: TokenPlacementController relies on it.
          onPlaced: () => onArm(null),
        },
      }),
    applyTokenPatch: (tokenId, patch) => {
      if (!viewport.store.getById(tokenId)) return false;
      const update: Record<string, unknown> = { ...patch.set };
      for (const key of patch.unset) update[key] = undefined;
      viewport.store.update(tokenId, update as Partial<CanvasElement>);
      return true;
    },
    stampAt: (request, point, slot) => {
      if (viewport.store.getById(request.tokenId)) return true;
      const ctx = viewport.toolContext;
      const cell = cellUnit(ctx);
      const offset = arrivalFanOffset(slot);
      stampCombatantToken(
        {
          entityId: request.sceneMemberId,
          name: request.name,
          avatarUrl: request.avatarUrl,
          color: request.color,
          tokenSize: request.tokenCells as TokenCellSize,
          tokenId: request.tokenId,
          fields: request.fields,
        },
        { x: point.x + offset.dx * cell, y: point.y + offset.dy * cell },
        ctx
      );
      return viewport.store.getById(request.tokenId) !== undefined;
    },
    ensurePlayerBand: (legacyPlayerId, name) => {
      const id = playerLayerId(legacyPlayerId);
      if (viewport.layerManager.getLayer(id)) return;
      const definition = canonicalPlayerBand({
        id,
        name,
        visible: true,
        locked: false,
        order: PLAYER_BAND_ORDER,
        opacity: 1,
      });
      viewport.layerManager.addLayerDirect(definition);
      connection?.publishLayerUpsert(definition);
    },
  };
}
