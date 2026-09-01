import { PathTool, footprintFromSize } from '@fieldnotes/core';

import {
  MOVEMENT_BEYOND_COLOR,
  MOVEMENT_DEFAULT_WALK_FEET,
  movementRangeBands,
} from './movementSpeed';
import { movableTokenIdentity } from './tokenIdentity';

import type { MovableTokenIdentity } from './tokenIdentity';
import type { CanvasElement, Viewport } from '@fieldnotes/core';

export { MOVEMENT_DEFAULT_WALK_FEET };

/** PathTool registers under the SDK name; toolbars activate 'path'. */
export const MOVEMENT_TOOL_NAME = 'path';

export interface MovementResolution {
  name: string;
  walkFeet: number;
}

export interface MovementToolConfig {
  /** Live ref read — the tool is constructed before the viewport mounts. */
  getViewport: () => Viewport | null;
  role: 'dm' | 'player';
  /** Required when role === 'player': only this character's token moves. */
  characterId?: string;
  /** Speed + display-name lookup; null → default 30 ft. Read live per path. */
  resolveMovement: (
    identity: MovableTokenIdentity
  ) => MovementResolution | null;
  isDashActive: () => boolean;
}

/**
 * One ownership rule, shared by resolveStart (Task 5) and the commit
 * revalidation (Task 6): DM moves any token; a player moves only their own
 * stamped player token.
 */
export function movableTokenMatch(
  config: Pick<MovementToolConfig, 'role' | 'characterId'>
): (el: CanvasElement) => boolean {
  return el => {
    const identity = movableTokenIdentity(el);
    if (!identity) return false;
    if (config.role === 'player') {
      return identity.kind === 'player' && identity.key === config.characterId;
    }
    return true;
  };
}

/**
 * A core PathTool configured as RollKeeper's Move tool. resolveStart
 * hit-tests through the SDK's own selection geometry (rotation, layer
 * visibility, stroke rules) with `match` INSIDE the topmost-first walk, so
 * a covering non-token element cannot swallow the gesture. DM reaches
 * locked/mirrored player layers (`respectLayerLock: false`); players stay
 * within their own unlocked layer. Range bands are re-derived per anchor
 * from the entity's walking speed and the live Dash toggle.
 */
export function createMovementPathTool(config: MovementToolConfig): PathTool {
  const match = movableTokenMatch(config);
  const tool = new PathTool({
    feetPerCell: 5,
    diagonalRule: 'chebyshev',
    color: MOVEMENT_BEYOND_COLOR,
  });
  tool.setOptions({
    resolveStart: (world, ctx) => {
      const vp = config.getViewport();
      if (!vp) return null;
      const el = vp.getElementAt(world, {
        respectLayerLock: config.role !== 'dm',
        match,
      });
      if (!el || !('size' in el) || !el.size) return null;
      const identity = movableTokenIdentity(el);
      if (!identity) return null;
      const resolution = config.resolveMovement(identity);
      const walkFeet = resolution?.walkFeet ?? MOVEMENT_DEFAULT_WALK_FEET;
      tool.setOptions({
        rangeBands: movementRangeBands(walkFeet, config.isDashActive()),
      });
      const gridSize = ctx.gridSize || 0;
      return {
        origin: {
          x: el.position.x + el.size.w / 2,
          y: el.position.y + el.size.h / 2,
        },
        footprint: gridSize > 0 ? footprintFromSize(el.size, gridSize) : 1,
        anchorKey: el.id,
      };
    },
  });
  return tool;
}
