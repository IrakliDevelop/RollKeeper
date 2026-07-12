'use client';

import { useCamera, useViewport } from '@fieldnotes/react';

import { cellUnit } from '@/components/ui/campaign/location-map/cellUnit';
import { getHpTierBarColor, getHpTierTextColor } from '@/utils/hpColor';

import { useDecoratedTokenRects } from './TokenDecorationLayer.hooks';

import type {
  TokenDecoration,
  TokenHpView,
} from './TokenDecorationLayer.types';

export type {
  TokenDecoration,
  TokenHpView,
} from './TokenDecorationLayer.types';

export interface TokenDecorationLayerProps {
  /** Keyed by entityId AND/OR characterId — resolvers double-key player entries. */
  decorations: ReadonlyMap<string, TokenDecoration>;
  visible: boolean;
}

function HpRow({ hp, cell }: { hp: TokenHpView; cell: number }) {
  if (hp.kind === 'label') {
    return (
      <span
        className={`bg-surface-raised/90 border-divider rounded-full border font-semibold whitespace-nowrap ${getHpTierTextColor(hp.tier)}`}
        style={{ fontSize: cell * 0.22, padding: `0 ${cell * 0.15}px` }}
      >
        {hp.text}
      </span>
    );
  }
  return (
    <span
      className="flex w-full flex-col items-center"
      style={{ gap: cell * 0.05 }}
    >
      <span
        role="progressbar"
        aria-valuenow={Math.round(hp.percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-surface-secondary/90 border-divider block w-full overflow-hidden rounded-full border"
        style={{ height: cell * 0.14 }}
      >
        <span
          className={`block h-full ${getHpTierBarColor(hp.tier)}`}
          style={{ width: `${hp.percent}%` }}
        />
      </span>
      {hp.kind === 'exact' && (
        <span
          className="bg-surface-raised/90 text-heading rounded-full font-semibold whitespace-nowrap"
          style={{ fontSize: cell * 0.2, padding: `0 ${cell * 0.12}px` }}
        >
          {hp.current}/{hp.max}
        </span>
      )}
    </span>
  );
}

/**
 * Pure-local decoration overlay: name labels + HP bars under tokens. Renders
 * as a canvas child (inside ViewportContext), positions each decoration in
 * WORLD units, and lets one camera CSS transform (the SDK's own domLayer
 * technique, transform-origin 0 0) handle pan and zoom for all of them.
 * Nothing here enters the element store or the sync channel.
 */
export function TokenDecorationLayer({
  decorations,
  visible,
}: TokenDecorationLayerProps) {
  const camera = useCamera();
  const viewport = useViewport();
  const rects = useDecoratedTokenRects();
  if (!visible) return null;
  const cell = cellUnit(viewport.toolContext);
  return (
    <div
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
          // Min-width clamp keeps bars legible on 1×1 tokens.
          const width = Math.max(rect.w, 0.9 * cell);
          return (
            <div
              key={rect.id}
              className="absolute flex flex-col items-center"
              style={{
                left: rect.x + rect.w / 2 - width / 2,
                top: rect.y + rect.h + cell * 0.06,
                width,
                gap: cell * 0.05,
                opacity: deco.isDead ? 0.75 : 1,
              }}
            >
              {deco.name && (
                <span
                  className="bg-surface-raised/90 border-divider text-heading overflow-hidden rounded-full border font-semibold text-ellipsis whitespace-nowrap"
                  style={{
                    fontSize: cell * 0.24,
                    padding: `0 ${cell * 0.15}px`,
                    maxWidth: 3 * cell,
                  }}
                >
                  {deco.name}
                </span>
              )}
              {deco.isDead ? (
                <span style={{ fontSize: cell * 0.3, lineHeight: 1 }}>☠️</span>
              ) : (
                deco.hp && <HpRow hp={deco.hp} cell={cell} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
