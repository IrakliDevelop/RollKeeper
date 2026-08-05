'use client';

import { Minimap } from '@fieldnotes/react';

interface BattleMapMinimapProps {
  /** Player surfaces start collapsed (quiet player UI); DM starts open. */
  defaultCollapsed?: boolean;
}

/**
 * Battle-map overview navigator, bottom-center. Rendered inside the canvas
 * ViewportContext by the DM VTT and player battle-map canvases.
 *
 * Positioned bottom-center rather than the conventional bottom-right corner:
 * both call sites already reserve the full-height right edge for a
 * collapsible side panel (`StudioPanel` on the DM VTT, `CharacterDock` on
 * the player canvas — both `fixed ... right-0/right-4` spanning from just
 * below the top chrome down to near the viewport bottom), and the left edge
 * is similarly claimed (`RosterTray`, `CombatPanel`). A bottom-right minimap
 * would sit directly behind/in front of those panels whenever they're
 * expanded, which is their default state. `bottom-20` keeps clearance above
 * the bottom-center `TurnControl` pill (DM, active-encounter only) and the
 * player's `InitiativeRollPrompt` occupies the same band only briefly and
 * layers above (z-40) it during that transient interaction.
 */
export function BattleMapMinimap({
  defaultCollapsed = false,
}: BattleMapMinimapProps) {
  return (
    <div className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2">
      <Minimap
        defaultCollapsed={defaultCollapsed}
        className="border-divider bg-surface-raised overflow-hidden rounded-lg border shadow-lg"
      />
    </div>
  );
}
