'use client';

import { useEffect, useRef, useState } from 'react';

import { useCamera, useElements } from '@fieldnotes/react';

import { COMBATANT_TOKEN_KIND } from '@/components/ui/campaign/dm-vtt/combatantToken';
import { PLAYER_TOKEN_KIND } from '@/components/ui/campaign/location-map/PlayerTokenTool';

import type { CanvasElement } from '@fieldnotes/core';
import type { RefObject } from 'react';
import type { TokenInfoMode } from './TokenDecorationLayer.types';

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

function hitTestRects(
  rects: DecoratedTokenRect[],
  worldX: number,
  worldY: number
): string | null {
  // Later elements render on top, so the LAST match wins.
  let hitId: string | null = null;
  for (const rect of rects) {
    if (
      worldX >= rect.x &&
      worldX <= rect.x + rect.w &&
      worldY >= rect.y &&
      worldY <= rect.y + rect.h
    ) {
      hitId = rect.id;
    }
  }
  return hitId;
}

export interface UseCompactRevealResult {
  containerRef: RefObject<HTMLDivElement | null>;
  activeId: string | null;
}

/**
 * Compact-mode-only name reveal: since the layer is `pointer-events-none`
 * (it must never intercept clicks meant for the SDK canvas below it) and SDK
 * selection isn't available to players on locked/mirrored layers, this does
 * its own hit-testing off raw window pointer events. Hovering a token (desktop)
 * or tapping it (iPad — pointer events unify mouse/touch) reveals its chip
 * row; tapping empty space clears the tap-reveal. Both ids reset when mode
 * leaves 'compact'.
 */
export function useCompactReveal(
  mode: TokenInfoMode,
  rects: DecoratedTokenRect[]
): UseCompactRevealResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const camera = useCamera();

  // Kept fresh via refs so the pointer listeners (added once per mode change)
  // always read current rects/camera without needing to re-subscribe.
  const rectsRef = useRef(rects);
  rectsRef.current = rects;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  useEffect(() => {
    if (mode !== 'compact') {
      setHoveredId(null);
      setRevealedId(null);
      return;
    }

    function toWorldPoint(clientX: number, clientY: number) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      const screenX = clientX - (containerRect?.left ?? 0);
      const screenY = clientY - (containerRect?.top ?? 0);
      const cam = cameraRef.current;
      return {
        x: (screenX - cam.x) / cam.zoom,
        y: (screenY - cam.y) / cam.zoom,
      };
    }

    let framePending = false;

    function handlePointerMove(e: PointerEvent) {
      if (framePending) return;
      framePending = true;
      requestAnimationFrame(() => {
        framePending = false;
        const world = toWorldPoint(e.clientX, e.clientY);
        setHoveredId(hitTestRects(rectsRef.current, world.x, world.y));
      });
    }

    function handlePointerDown(e: PointerEvent) {
      const world = toWorldPoint(e.clientX, e.clientY);
      setRevealedId(hitTestRects(rectsRef.current, world.x, world.y));
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [mode]);

  return { containerRef, activeId: hoveredId ?? revealedId };
}
