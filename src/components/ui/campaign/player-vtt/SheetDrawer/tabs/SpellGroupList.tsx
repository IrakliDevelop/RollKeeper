import type { Spell, SpellSlots } from '@/types/character';

import type { SpellGroupView } from '../SheetDrawer.types';
import { SpellListRow } from './SpellListRow';
import { SpellSlotPipsRow } from './SpellSlotPipsRow';

export const SLOT_ORDINAL = [
  '0th',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
];

export interface SpellGroupListProps {
  spellsCount: number;
  search: string;
  groups: SpellGroupView[];
  locked: boolean;
  onSpendSlot: (level: keyof SpellSlots) => void;
  onRestoreSlot: (level: keyof SpellSlots) => void;
  onTogglePrepared: (id: string) => void;
  onCast: (spell: Spell) => void;
  onView: (spell: Spell) => void;
}

/** Per-level spell groups (heading + slot pips + rows), or an empty-state message. */
export function SpellGroupList({
  spellsCount,
  search,
  groups,
  locked,
  onSpendSlot,
  onRestoreSlot,
  onTogglePrepared,
  onCast,
  onView,
}: SpellGroupListProps) {
  if (spellsCount === 0) {
    return (
      <p className="text-muted text-sm">
        No spells yet. Add spells on the full character sheet.
      </p>
    );
  }
  if (groups.length === 0) {
    return <p className="text-muted text-sm">No spells match “{search}”.</p>;
  }

  return (
    <>
      {groups.map(group => (
        <div key={group.level}>
          <h3 className="text-faint mb-1 text-xs font-bold uppercase">
            {group.label}
          </h3>
          {group.slot && (
            <SpellSlotPipsRow
              max={group.slot.max}
              used={group.slot.used}
              spendLabel={`Spend ${SLOT_ORDINAL[group.level] ?? group.level}-level slot`}
              restoreLabel={`Restore ${SLOT_ORDINAL[group.level] ?? group.level}-level slot`}
              onSpend={() => onSpendSlot(group.level as keyof SpellSlots)}
              onRestore={() => onRestoreSlot(group.level as keyof SpellSlots)}
            />
          )}
          <div className="space-y-1.5">
            {group.spells.map(row => (
              <SpellListRow
                key={row.spell.id}
                row={row}
                locked={locked}
                onTogglePrepared={() => onTogglePrepared(row.spell.id)}
                onCast={() => onCast(row.spell)}
                onView={() => onView(row.spell)}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
