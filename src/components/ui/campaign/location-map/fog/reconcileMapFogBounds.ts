import type { FogManager, Bounds } from '@fieldnotes/core';

function boundsEqual(a: Bounds, b: Bounds): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function reconcileMapFogBounds(
  fogManager: FogManager,
  newBounds: Bounds
): void {
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

  fogManager.setBounds(newBounds);
}
