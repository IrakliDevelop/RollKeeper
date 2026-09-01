import type { CanvasElement } from '@fieldnotes/core';

import { PLAYER_TOKEN_KIND } from './PlayerTokenTool';

/**
 * Single source of truth for the combatant token kind. Lives here (not
 * dm-vtt) for the same reason TOKEN_ELEMENT_ZINDEX lives in tokenSnap.ts:
 * location-map must not import from dm-vtt, so dm-vtt/combatantToken.ts
 * re-exports this value instead of defining its own.
 */
export const COMBATANT_TOKEN_KIND = 'combatant';

export interface MovableTokenIdentity {
  /** entityId for combatants, characterId for player tokens. */
  key: string;
  kind: 'combatant' | 'player';
}

/**
 * The one rule for "is this element a movable token, and whose": mirrors
 * token-overlay's decorationKey but returns the kind too, so movement can
 * route ownership (players move only their own player token) and speed
 * lookup (combatant → stat block, player → character sheet).
 */
export function movableTokenIdentity(
  el: CanvasElement
): MovableTokenIdentity | null {
  const rec = el as Partial<{
    tokenKind: unknown;
    entityId: unknown;
    characterId: unknown;
  }>;
  if (
    rec.tokenKind === COMBATANT_TOKEN_KIND &&
    typeof rec.entityId === 'string' &&
    rec.entityId !== ''
  ) {
    return { key: rec.entityId, kind: 'combatant' };
  }
  if (
    rec.tokenKind === PLAYER_TOKEN_KIND &&
    typeof rec.characterId === 'string' &&
    rec.characterId !== ''
  ) {
    return { key: rec.characterId, kind: 'player' };
  }
  return null;
}
