'use client';

import { Minimap } from '@fieldnotes/react';

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
 * Player surfaces retain the bottom-center position, with `bottom-20`
 * clearing their lower product overlays. The DM surface opts into
 * bottom-left: its roster is content-sized and capped to leave that corner
 * available, while the right side may contain a tall selected-entity panel.
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
  return (
    <div
      className={`absolute z-10 ${
        placement === 'bottom-left'
          ? 'bottom-3 left-3'
          : 'bottom-20 left-1/2 -translate-x-1/2'
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
