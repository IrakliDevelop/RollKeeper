import { ChevronDown } from 'lucide-react';

import { SlotPips } from '@/components/ui/game/SlotPips';

import { cn } from '@/utils/cn';

import type { Spell, SpellSlot } from '@/types/character';

import { SpellRow } from './SpellRow';

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
        aria-expanded={!collapsed}
        onClick={onToggle}
        className="focus-visible:outline-ring flex w-full items-center justify-between gap-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
      >
        <span className="type-small text-muted flex items-center gap-1">
          <ChevronDown
            size={14}
            aria-hidden
            className={cn('shrink-0', collapsed && '-rotate-90')}
          />
          {level === 0 ? 'Cantrips' : `Level ${level}`}
        </span>
        {slot && (
          <SlotPips
            total={slot.max}
            available={slot.max - slot.used}
            level={level}
          />
        )}
      </button>
      {!collapsed && (
        <ul className="divide-divider divide-y">
          {spells.map(spell => (
            <SpellRow
              key={spell.id}
              spell={spell}
              onView={() => onView(spell)}
              onCast={() => onCast(spell)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
