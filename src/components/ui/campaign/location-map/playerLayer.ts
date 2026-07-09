import type { Viewport } from '@fieldnotes/core';

/** Deterministic layer id for a player's own canvas elements. */
export function playerLayerId(characterId: string): string {
  return `player-${characterId}`;
}

/**
 * Ensures the player's own layer exists locally and is the active layer, so
 * everything they place lands on `player-<characterId>`.
 *
 * This id is STABLE across sessions: after a reload, the player's own
 * elements arriving in the relay snapshot reference a layer that exists
 * locally and is unlocked — so they stay selectable/movable. Without it they
 * referenced the previous session's throwaway default layer id, fell into
 * the unknown-layer path, and were mirrored as a LOCKED "DM layer" —
 * permanently uncontrollable by their owner.
 */
export function ensurePlayerLayer(vp: Viewport, characterId: string): string {
  const id = playerLayerId(characterId);
  if (!vp.layerManager.getLayer(id)) {
    vp.layerManager.addLayerDirect({
      id,
      name: 'My elements',
      visible: true,
      locked: false,
      order: 1,
      opacity: 1,
    });
  }
  vp.layerManager.setActiveLayer(id);
  return id;
}
