import { Button } from '@/components/ui/forms/button';
import type { Spell } from '@/types/character';

import { AOE_GLYPHS } from './DockSpells.utils';

export interface SpellRowProps {
  spell: Spell;
  /** Row tap (name area) → open SpellDetailsModal. */
  onView: () => void;
  /** Cast button → cantrip casts immediately, leveled opens SpellCastModal. */
  onCast: () => void;
}

/**
 * Single spell line in the dock's spell list: name and tags, plus a Cast
 * button.
 */
export function SpellRow({ spell, onView, onCast }: SpellRowProps) {
  const tags = [
    spell.concentration && 'Concentration',
    spell.ritual && 'Ritual',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex items-center gap-2 py-1.5">
      <button
        type="button"
        onClick={onView}
        className="focus-visible:outline-ring min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="type-ui text-heading truncate">{spell.name}</span>
          {spell.aoe && (
            <span
              className="text-muted shrink-0 text-xs"
              aria-label={`${spell.aoe.shape} area of effect`}
            >
              {AOE_GLYPHS[spell.aoe.shape]}
            </span>
          )}
        </span>
        {tags && <span className="type-caption text-muted block">{tags}</span>}
      </button>
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0"
        onClick={onCast}
      >
        Cast
      </Button>
    </li>
  );
}
