'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useElementRects, useViewport } from '@fieldnotes/react';

import { COMBATANT_TOKEN_KIND } from '@/components/ui/campaign/dm-vtt/combatantToken';
import { PLAYER_TOKEN_KIND } from '@/components/ui/campaign/location-map/PlayerTokenTool';

import type { CanvasElement, ElementRect } from '@fieldnotes/core';
import type { RefObject } from 'react';
import type { TokenInfoMode } from './TokenDecorationLayer.types';

/** Retained for the sibling decoration components; ElementRect is a superset. */
export type DecoratedTokenRect = ElementRect;

export type LayerVisibility = (layerId: string) => boolean;

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

/**
 * SDK matcher: an opaque key for tracked tokens, `null` otherwise. Layer
 * visibility is part of the match so rendering and hit-testing share ONE
 * policy — hiding the token layer hides its decorations too.
 */
export function decoratedTokenKey(isLayerVisible: LayerVisibility) {
  return (el: CanvasElement): string | null => {
    if (!isLayerVisible(el.layerId)) return null;
    const key = decorationKey(el);
    // Preserve the old `if (!key) continue` behavior: an empty identity is not
    // a usable decoration-map key.
    return key === '' ? null : key;
  };
}

/** Boolean projection of the same rule, for `getElementAt`'s filter. */
export function isDecoratedToken(isLayerVisible: LayerVisibility) {
  const key = decoratedTokenKey(isLayerVisible);
  return (el: CanvasElement): boolean => key(el) !== null;
}

/**
 * Live world rects of every decorated token, keyed by entityId/characterId.
 * Re-renders on position/size/key changes from local drags AND remote sync,
 * and never on camera motion.
 */
export function useDecoratedTokenRects(
  isLayerVisible: LayerVisibility
): readonly ElementRect[] {
  // MEMOIZED DELIBERATELY. TokenDecorationLayer calls useCamera(), so it
  // re-renders on every camera event. A matcher built fresh each render would
  // change identity every time, and useElementRects calls setMatch on identity
  // change — turning every pan into an O(n) rescan and defeating the whole
  // point of a camera-independent tracker.
  const match = useMemo(
    () => decoratedTokenKey(isLayerVisible),
    [isLayerVisible]
  );
  return useElementRects(match);
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
  isLayerVisible: LayerVisibility
): UseCompactRevealResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const viewport = useViewport();

  // Kept fresh via refs so the pointer listeners (added once per mode change)
  // always read the current viewport/match without needing to re-subscribe.
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const match = useMemo(
    () => isDecoratedToken(isLayerVisible),
    [isLayerVisible]
  );
  const matchRef = useRef(match);
  matchRef.current = match;

  useEffect(() => {
    if (mode !== 'compact') {
      setHoveredId(null);
      setRevealedId(null);
      return;
    }

    function resolveId(clientX: number, clientY: number): string | null {
      const containerRect = containerRef.current?.getBoundingClientRect();
      const world = viewportRef.current.camera.screenToWorld({
        x: clientX - (containerRect?.left ?? 0),
        y: clientY - (containerRect?.top ?? 0),
      });
      return (
        viewportRef.current.getElementAt(world, {
          // The player token layer is locked/mirrored; without this the
          // selection-semantics default would find nothing there.
          respectLayerLock: false,
          match: matchRef.current,
        })?.id ?? null
      );
    }

    let frameId: number | null = null;

    function handlePointerMove(e: PointerEvent) {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        setHoveredId(resolveId(e.clientX, e.clientY));
      });
    }

    function handlePointerDown(e: PointerEvent) {
      setRevealedId(resolveId(e.clientX, e.clientY));
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [mode]);

  return { containerRef, activeId: hoveredId ?? revealedId };
}
