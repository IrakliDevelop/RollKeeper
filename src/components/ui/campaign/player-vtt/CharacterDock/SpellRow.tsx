import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import type { Spell } from '@/types/character';

import { AOE_GLYPHS } from './DockSpells.utils';

export interface SpellRowProps {
  spell: Spell;
  /** Row tap (name area) → open SpellDetailsModal. */
  onView: () => void;
  /** Cast button → cantrip casts immediately, leveled opens SpellCastModal. */
  onCast: () => void;
}

/** Single spell line in the dock's spell list: name/badges + a ≥44px Cast button. */
export function SpellRow({ spell, onView, onCast }: SpellRowProps) {
  return (
    <div className="border-divider flex items-center gap-2 rounded-lg border p-2">
      <button
        type="button"
        onClick={onView}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-body truncate text-sm font-medium">
            {spell.name}
          </span>
          {spell.aoe && (
            <span
              className="text-accent-purple-text-muted shrink-0 text-xs"
              aria-label={`${spell.aoe.shape} area of effect`}
            >
              {AOE_GLYPHS[spell.aoe.shape]}
            </span>
          )}
        </div>
        {(spell.concentration || spell.ritual) && (
          <div className="mt-0.5 flex gap-1">
            {spell.concentration && (
              <Badge variant="warning" size="sm">
                Con
              </Badge>
            )}
            {spell.ritual && (
              <Badge variant="info" size="sm">
                Ritual
              </Badge>
            )}
          </div>
        )}
      </button>
      <Button variant="primary" size="lg" onClick={onCast}>
        Cast
      </Button>
    </div>
  );
}
