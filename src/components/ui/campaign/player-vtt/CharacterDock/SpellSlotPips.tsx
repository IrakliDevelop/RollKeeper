import type { SpellSlot } from '@/types/character';

export interface SpellSlotPipsProps {
  slot: SpellSlot;
}

/**
 * Minimal inline slot-usage dots for a level's group header.
 *
 * Recon (Task 6): the shared `SpellSlotTracker` compact mode still renders
 * a full bordered block (title row + Badge + checkbox row) per level — it's
 * built for a standalone panel, not a one-line inline header, so it doesn't
 * fit the 338px dock's group-header row. This tiny pip row is the sanctioned
 * fallback from the task brief.
 */
export function SpellSlotPips({ slot }: SpellSlotPipsProps) {
  if (slot.max === 0) return null;

  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${slot.max - slot.used}/${slot.max} slots remaining`}
    >
      {Array.from({ length: slot.max }, (_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < slot.used
              ? 'border-accent-purple-border-strong border bg-transparent'
              : 'bg-accent-purple-text-muted'
          }`}
        />
      ))}
    </div>
  );
}
