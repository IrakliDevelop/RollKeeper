import { Section } from '@/components/ui/layout/section';
import { SlotPipsButtons } from '@/components/ui/game/SlotPipsButtons';
import type { Spell, SpellSlots } from '@/types/character';

import type { SpellGroupView } from '../SheetDrawer.types';
import { SpellListRow } from './SpellListRow';

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
      <p className="type-body text-muted py-6 text-center">
        No spells yet. Add spells on the full character sheet.
      </p>
    );
  }
  if (groups.length === 0) {
    return (
      <p className="type-body text-muted py-6 text-center">
        No spells match “{search}”.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <Section
          key={group.level}
          level={4}
          heading={group.label}
          trailing={
            group.slot && (
              <SlotPipsButtons
                level={group.level}
                total={group.slot.max}
                available={group.slot.max - group.slot.used}
                onSpend={() => onSpendSlot(group.level as keyof SpellSlots)}
                onRestore={() => onRestoreSlot(group.level as keyof SpellSlots)}
              />
            )
          }
        >
          <ul className="divide-divider divide-y">
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
          </ul>
        </Section>
      ))}
    </div>
  );
}
