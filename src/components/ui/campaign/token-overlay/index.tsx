'use client';

import { useCamera, useViewport } from '@fieldnotes/react';

import { cellUnit } from '@/components/ui/campaign/location-map/cellUnit';

import { DecorationItem } from './DecorationItem';
import {
  useCompactReveal,
  useDecoratedTokenRects,
} from './TokenDecorationLayer.hooks';

import type {
  TokenDecoration,
  TokenInfoMode,
} from './TokenDecorationLayer.types';

export type {
  TokenDecoration,
  TokenHpView,
  TokenInfoMode,
} from './TokenDecorationLayer.types';

export interface TokenDecorationLayerProps {
  /** Keyed by entityId AND/OR characterId — resolvers double-key player entries. */
  decorations: ReadonlyMap<string, TokenDecoration>;
  /** null = persisted mode not yet resolved — render nothing (no flash). */
  mode: TokenInfoMode | null;
}

/**
 * Pure-local decoration overlay: an in-token HP bar plus (in full mode) a
 * name/state chip row under each token. Renders as a canvas child (inside
 * ViewportContext), positions each decoration in WORLD units, and lets one
 * camera CSS transform (the SDK's own domLayer technique, transform-origin
 * 0 0) handle pan and zoom for all of them. Nothing here enters the element
 * store or the sync channel.
 */
export function TokenDecorationLayer({
  decorations,
  mode,
}: TokenDecorationLayerProps) {
  const camera = useCamera();
  const viewport = useViewport();
  const rects = useDecoratedTokenRects();
  const { containerRef, activeId } = useCompactReveal(mode ?? 'off', rects);
  if (mode === null || mode === 'off') return null;
  const cell = cellUnit(viewport.toolContext);
  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      aria-hidden
    >
      <div
        style={{
          transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {rects.map(rect => {
          const deco = decorations.get(rect.key);
          if (!deco) return null;
          return (
            <DecorationItem
              key={rect.id}
              rect={rect}
              deco={deco}
              mode={mode}
              cell={cell}
              showChipRow={mode === 'compact' && rect.id === activeId}
            />
          );
        })}
      </div>
    </div>
  );
}
