'use client';

/**
 * Clears the active marker element id when its element leaves the canvas
 * store.
 *
 * Every surface that mounts a marker panel resolves its state with a bare
 * `viewport.store.getById(activeMarkerElementId)` DURING RENDER, with no
 * subscription — so nothing re-renders when that element disappears. A DM
 * hiding a shared marker makes the relay send the players a REMOVE, and their
 * open panel keeps showing the pin's label and body until some unrelated
 * re-render happens to knock it over. The same holds on the DM surfaces for a
 * pin deleted from another device, or by undo.
 *
 * Subscribing only while a marker is active keeps this off the hot path for
 * the (overwhelmingly common) closed-panel case.
 */

import { useEffect, useRef } from 'react';

import type { CanvasElement } from '@fieldnotes/core';

/** The slice of `Viewport` this hook needs — structural, so a surface can pass
 *  a recording double. */
export interface MarkerPanelRemovalViewport {
  store: {
    on(
      event: 'remove',
      listener: (element: Readonly<CanvasElement>) => void
    ): () => void;
  };
}

export function useCloseMarkerPanelOnRemove(
  viewport: MarkerPanelRemovalViewport | null,
  activeMarkerElementId: string | null,
  onElementRemoved: () => void
): void {
  // Read through a ref, so a caller whose closer is not memoised cannot make
  // the subscription churn on every unrelated render (same pattern as
  // `useMarkerRegistration`'s callback refs).
  const onElementRemovedRef = useRef(onElementRemoved);
  onElementRemovedRef.current = onElementRemoved;

  useEffect(() => {
    if (viewport === null || activeMarkerElementId === null) return undefined;
    return viewport.store.on('remove', element => {
      if (element.id !== activeMarkerElementId) return;
      onElementRemovedRef.current();
    });
  }, [viewport, activeMarkerElementId]);
}
