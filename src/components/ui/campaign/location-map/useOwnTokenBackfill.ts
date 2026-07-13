'use client';

import { useEffect } from 'react';

import { useElements, useViewport } from '@fieldnotes/react';

import { playerLayerId } from './playerLayer';
import { PLAYER_TOKEN_KIND } from './PlayerTokenTool';

import type { CanvasElement } from '@fieldnotes/core';

/**
 * Pre-#160 player self-tokens carry tokenKind but no characterId stamp, so
 * useOwnTokenPresent misses them and the place-token pulse hint shows even
 * though the token is on the map. A legacy own-token is identified by the
 * player's own layer (player-<characterId> — only the player places on it),
 * player token kind, and a missing characterId.
 */
export function isLegacyOwnToken(
  el: CanvasElement,
  characterId: string
): boolean {
  const rec = el as Partial<{
    tokenKind: unknown;
    characterId: unknown;
    layerId: unknown;
  }>;
  return (
    rec.tokenKind === PLAYER_TOKEN_KIND &&
    rec.characterId === undefined &&
    rec.layerId === playerLayerId(characterId)
  );
}

// Module scope — useElements selectors must be referentially stable.
const selectAll = (els: CanvasElement[]) => els;

/**
 * One-shot idempotent backfill: stamps characterId onto legacy own-layer
 * self-tokens via narrow update patches (extra top-level keys survive
 * store/export/sync). Runs whenever the element list changes; already-
 * stamped tokens no longer match, so re-runs are no-ops.
 */
export function useOwnTokenBackfill(characterId: string): void {
  const viewport = useViewport();
  const elements = useElements(selectAll);

  useEffect(() => {
    if (!characterId) return;
    const store = viewport.toolContext.store;
    for (const el of elements) {
      if (isLegacyOwnToken(el, characterId)) {
        // `characterId` is an extra top-level key (like PlayerTokenKeys),
        // not a declared CanvasElement field, so the patch shares no
        // property with Partial<CanvasElement> and TS's weak-type check
        // rejects it outright — go through `unknown`, same as the read-side
        // cast in isLegacyOwnToken above. Extra keys still survive the
        // store's shallow merge at runtime (as they do via store.add).
        const patch = { characterId } as unknown as Partial<CanvasElement>;
        store.update(el.id, patch);
      }
    }
  }, [viewport, elements, characterId]);
}
