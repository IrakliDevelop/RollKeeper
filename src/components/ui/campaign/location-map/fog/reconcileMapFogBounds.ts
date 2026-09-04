import type { FogManager, Bounds } from '@fieldnotes/core';

function boundsEqual(a: Bounds, b: Bounds): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function isFiniteBounds(bounds: Bounds): boolean {
  return (
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.w) &&
    Number.isFinite(bounds.h) &&
    bounds.w > 0 &&
    bounds.h > 0
  );
}

export function reconcileMapFogBounds(
  fogManager: FogManager,
  newBounds: Bounds
): void {
  if (!isFiniteBounds(newBounds)) {
    throw new Error('Fog bounds must be a finite, positive map rectangle');
  }
  const state = fogManager.getState();
  if (!state) return;

  const current = state.definition.bounds;
  if (boundsEqual(current, newBounds)) return;

  // A non-RollKeeper mask with base 'revealed' must be reset to covered
  // before expansion so newly added map area remains concealed.
  const isExpanding =
    newBounds.x <= current.x &&
    newBounds.y <= current.y &&
    newBounds.x + newBounds.w >= current.x + current.w &&
    newBounds.y + newBounds.h >= current.y + current.h;
  if (isExpanding && state.definition.base === 'revealed') {
    fogManager.reset('covered');
  }

  // Released core semantics are intentional here: pure expansion keeps the
  // generation; shrink/move creates a generation and preserves only
  // canonical in-bounds tiles. Never emulate that with tile-by-tile writes.
  fogManager.setBounds(newBounds);
}
