'use client';

import { useEffect, useRef } from 'react';
import { Minimap, useViewport } from '@fieldnotes/react';

const ZOOM_SENSITIVITY = 1e-3;

interface BattleMapMinimapProps {
  /** Player surfaces start collapsed (quiet player UI); DM starts open. */
  defaultCollapsed?: boolean;
  /** DM surfaces can use a free corner while the player layout stays centered. */
  placement?: 'bottom-center' | 'bottom-left';
}

/**
 * Battle-map overview navigator. Rendered inside the canvas
 * ViewportContext by the DM VTT and player battle-map canvases.
 *
 * Player surfaces use the true bottom-center with a small edge gutter. Their
 * temporary prompts render later at a higher stacking level, so they can
 * cover the minimap when attention is required without permanently pushing
 * it upward. The DM surface opts into bottom-left: its roster is content-sized
 * and capped to leave that corner available, while the right side may contain
 * a tall selected-entity panel.
 *
 * Stacking: both host canvases render `<BattleMapMinimap />` as an EARLIER
 * sibling of `{viewport && children}`, both at the same `z-10`. Same-z-index
 * siblings paint in DOM order (later wins), so rendering the minimap first
 * means product overlays carried in `children` — e.g. the player's
 * `InitiativeRollPrompt`, which briefly occupies the same bottom-center band
 * — paint on top of the minimap by DOM order alone, not because of any
 * z-index difference. Do not reorder past `children` without re-checking
 * this.
 */
export function BattleMapMinimap({
  defaultCollapsed = false,
  placement = 'bottom-center',
}: BattleMapMinimapProps) {
  const viewport = useViewport();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const visibleRect = viewport.getVisibleRect();
      const currentZoom = viewport.camera.zoom;
      const zoomFactor = Math.max(0.1, 1 - event.deltaY * ZOOM_SENSITIVITY);

      // The gesture originates on the overview rather than the main canvas,
      // so preserve the main viewport's center as the stable zoom anchor.
      viewport.camera.zoomAt(currentZoom * zoomFactor, {
        x: (visibleRect.w * currentZoom) / 2,
        y: (visibleRect.h * currentZoom) / 2,
      });
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, [viewport]);

  return (
    <div
      ref={wrapperRef}
      className={`absolute z-10 ${
        placement === 'bottom-left'
          ? 'bottom-3 left-3'
          : 'bottom-3 left-1/2 -translate-x-1/2'
      }`}
      data-minimap-placement={placement}
    >
      <Minimap
        defaultCollapsed={defaultCollapsed}
        className="border-divider bg-surface-raised overflow-hidden rounded-lg border shadow-lg"
      />
    </div>
  );
}
