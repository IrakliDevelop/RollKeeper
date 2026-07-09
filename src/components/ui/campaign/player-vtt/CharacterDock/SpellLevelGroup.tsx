import { ChevronDown, ChevronRight } from 'lucide-react';

import type { Spell, SpellSlot } from '@/types/character';

import { SpellRow } from './SpellRow';
import { SpellSlotPips } from './SpellSlotPips';

export interface SpellLevelGroupProps {
  level: number;
  spells: Spell[];
  slot: SpellSlot | null;
  collapsed: boolean;
  onToggle: () => void;
  onView: (spell: Spell) => void;
  onCast: (spell: Spell) => void;
}

/** One collapsible level group in the dock's spell list: header (+ slot pips) and its rows. */
export function SpellLevelGroup({
  level,
  spells,
  slot,
  collapsed,
  onToggle,
  onView,
  onCast,
}: SpellLevelGroupProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-1"
      >
        <span className="text-faint flex items-center gap-1 text-xs font-bold tracking-wider uppercase">
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {level === 0 ? 'Cantrips' : `Level ${level}`}
        </span>
        {slot && <SpellSlotPips slot={slot} />}
      </button>
      {!collapsed && (
        <div className="space-y-1.5">
          {spells.map(spell => (
            <SpellRow
              key={spell.id}
              spell={spell}
              onView={() => onView(spell)}
              onCast={() => onCast(spell)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
