'use client';

import { useCallback } from 'react';

import { useElements } from '@fieldnotes/react';

import { PLAYER_TOKEN_KIND } from './PlayerTokenTool';

import type { CanvasElement } from '@fieldnotes/core';

function isOwnPlayerToken(el: CanvasElement, characterId: string): boolean {
  const rec = el as Partial<{ tokenKind: unknown; characterId: unknown }>;
  return rec.tokenKind === PLAYER_TOKEN_KIND && rec.characterId === characterId;
}

function isEqual(a: boolean, b: boolean): boolean {
  return a === b;
}

/**
 * True once the player has placed their own (stamped) token on the map.
 * Tokens placed before the ownership-stamping feature shipped lack the
 * stamp — this returns false for those, so the "place your token" hint
 * keeps pulsing until the player places a fresh (stamped) one.
 */
export function useOwnTokenPresent(characterId: string): boolean {
  const selectHasOwnToken = useCallback(
    (elements: CanvasElement[]) =>
      elements.some(el => isOwnPlayerToken(el, characterId)),
    [characterId]
  );
  return useElements(selectHasOwnToken, isEqual);
}
