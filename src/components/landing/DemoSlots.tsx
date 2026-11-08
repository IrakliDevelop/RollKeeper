import { Section } from '@/components/ui/layout/section';
import { SlotPipsButtons } from '@/components/ui/game/SlotPipsButtons';
import type { DemoSheetState, DemoSlotLevel } from './sampleCharacter';

const SLOT_LEVELS: DemoSlotLevel[] = [1, 2, 3];

interface DemoSlotsProps {
  slots: DemoSheetState['slots'];
  onChange: (level: DemoSlotLevel, delta: number) => void;
}

/** The sample character's spell slots: tap a pip to spend or restore one. */
export function DemoSlots({ slots, onChange }: DemoSlotsProps) {
  return (
    <Section heading="Spell slots" level={3}>
      <ul className="divide-divider divide-y">
        {SLOT_LEVELS.map(level => {
          const slot = slots[level];
          return (
            <li
              key={level}
              className="flex items-center justify-between gap-3 py-1.5 pointer-coarse:min-h-11"
            >
              <span className="type-ui text-body">Level {level}</span>
              <SlotPipsButtons
                level={level}
                total={slot.max}
                available={slot.max - slot.used}
                onSpend={() => onChange(level, 1)}
                onRestore={() => onChange(level, -1)}
              />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
