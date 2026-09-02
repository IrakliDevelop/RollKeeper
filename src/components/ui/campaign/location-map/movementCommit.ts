import { movableTokenMatch } from './movementTool';
import { movableTokenIdentity } from './tokenIdentity';

import type { MovementResolution } from './movementTool';
import type { MovableTokenIdentity } from './tokenIdentity';
import type { PathEmission, Viewport } from '@fieldnotes/core';

export interface MovementLogPayload {
  entityId: string;
  entityName: string;
  feet: number;
  cells: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface MovementCommitContext {
  viewport: Viewport;
  role: 'dm' | 'player';
  characterId?: string;
  resolveMovement: (
    identity: MovableTokenIdentity
  ) => MovementResolution | null;
  /** Optional: absent on surfaces with no combat log (player, display). */
  logMovement?: (payload: MovementLogPayload) => void;
}

const EPS = 1e-6;

/**
 * Applies a committed movement path to its anchor token. The anchor is
 * RE-RESOLVED by element id against the LIVE store and ownership is
 * revalidated — the element may have been deleted, re-owned, or replaced
 * since the gesture started (spec risk: anchor drift). A stale or vetoed
 * anchor commits nothing and logs nothing. The move is exactly ONE
 * viewport.transaction() — one undo step reverts the whole path.
 */
export function applyMovementCommit(
  emission: PathEmission,
  ctx: MovementCommitContext
): boolean {
  const key = emission.anchorKey;
  if (key === undefined) return false;
  if (emission.waypoints.length < 2) return false;
  const dest = emission.waypoints[emission.waypoints.length - 1];
  if (!dest) return false;

  const el = ctx.viewport.store.getById(key);
  if (!el || !('size' in el) || !el.size) return false;
  if (!movableTokenMatch(ctx)(el)) return false;
  const identity = movableTokenIdentity(el);
  if (!identity) return false;

  const from = {
    x: el.position.x + el.size.w / 2,
    y: el.position.y + el.size.h / 2,
  };
  if (Math.abs(from.x - dest.x) < EPS && Math.abs(from.y - dest.y) < EPS) {
    return false;
  }

  const position = {
    x: dest.x - el.size.w / 2,
    y: dest.y - el.size.h / 2,
  };
  ctx.viewport.transaction(() => {
    ctx.viewport.store.update(el.id, { position });
  });

  const resolution = ctx.resolveMovement(identity);
  ctx.logMovement?.({
    entityId: resolution?.entityId ?? identity.key,
    entityName: resolution?.name ?? 'Unknown',
    feet: Math.round(emission.totalFeet),
    cells: Math.round(emission.totalCells),
    from,
    to: { x: dest.x, y: dest.y },
  });
  return true;
}
