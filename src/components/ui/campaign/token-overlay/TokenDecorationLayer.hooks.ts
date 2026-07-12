'use client';

import { useElements } from '@fieldnotes/react';

import { COMBATANT_TOKEN_KIND } from '@/components/ui/campaign/dm-vtt/combatantToken';
import { PLAYER_TOKEN_KIND } from '@/components/ui/campaign/location-map/PlayerTokenTool';

import type { CanvasElement } from '@fieldnotes/core';

/** World-space rect of a decorated token plus its decoration lookup key. */
export interface DecoratedTokenRect {
  id: string;
  /** entityId (combatant tokens) or characterId (player self-tokens). */
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The decoration-map key a store element resolves to, if it is a token. */
export function decorationKey(el: CanvasElement): string | null {
  const rec = el as Partial<{
    tokenKind: unknown;
    entityId: unknown;
    characterId: unknown;
  }>;
  if (
    rec.tokenKind === COMBATANT_TOKEN_KIND &&
    typeof rec.entityId === 'string'
  ) {
    return rec.entityId;
  }
  if (
    rec.tokenKind === PLAYER_TOKEN_KIND &&
    typeof rec.characterId === 'string'
  ) {
    return rec.characterId;
  }
  return null;
}

function selectRects(elements: CanvasElement[]): DecoratedTokenRect[] {
  const rects: DecoratedTokenRect[] = [];
  for (const el of elements) {
    const key = decorationKey(el);
    if (!key) continue;
    // Tokens are image/shape elements — both carry size; skip anything without.
    const size = (el as { size?: { w: number; h: number } }).size;
    if (!size) continue;
    rects.push({
      id: el.id,
      key,
      x: el.position.x,
      y: el.position.y,
      w: size.w,
      h: size.h,
    });
  }
  return rects;
}

// useElements' default isEqual is one-level shallow: the selector returns
// fresh objects each run, so a custom per-field comparator is required or
// the layer re-renders on EVERY store mutation.
function rectsEqual(a: DecoratedTokenRect[], b: DecoratedTokenRect[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = b[i];
    if (
      p.id !== q.id ||
      p.key !== q.key ||
      p.x !== q.x ||
      p.y !== q.y ||
      p.w !== q.w ||
      p.h !== q.h
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Live rects of every decorated token. Re-renders on position/size changes
 * from BOTH local drags and remote sync (unlike useCombatantTokens, which
 * deliberately skips update events — do not reuse it here).
 */
export function useDecoratedTokenRects(): DecoratedTokenRect[] {
  return useElements(selectRects, rectsEqual);
}
