'use client';

import type { PactMagic, SpellSlots } from '@/types/character';
import { Button } from '@/components/ui/forms/button';
import { SlotPipsButtons } from '@/components/ui/game/SlotPipsButtons';
import { Section } from '@/components/ui/layout/section';
import { cn } from '@/utils/cn';

interface SpellSlotTrackerProps {
  spellSlots: SpellSlots;
  pactMagic?: PactMagic;
  onSpellSlotChange?: (level: keyof SpellSlots, delta: number) => void;
  onPactMagicChange?: (delta: number) => void;
  onResetSpellSlots?: () => void;
  onResetPactMagic?: () => void;
  readonly?: boolean;
  compact?: boolean;
  hideControls?: boolean;
  hideResetButtons?: boolean;
  hideTitle?: boolean;
  showOnlyUsed?: boolean;
  maxLevelToShow?: number;
  className?: string;
}

/** The complete spell-slot ledger, used on the sheet and in DM NPC views. */
export function SpellSlotTracker({
  spellSlots,
  pactMagic,
  onSpellSlotChange,
  onPactMagicChange,
  onResetSpellSlots,
  onResetPactMagic,
  readonly = false,
  compact = false,
  hideControls = false,
  hideResetButtons = false,
  hideTitle = false,
  showOnlyUsed = false,
  maxLevelToShow = 9,
  className,
}: SpellSlotTrackerProps) {
  const levels = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const)
    .filter(level => level <= maxLevelToShow)
    .filter(level => {
      const slot = spellSlots[level];
      return slot.max > 0 && (!showOnlyUsed || slot.used > 0);
    });
  const hasPact = !!pactMagic && pactMagic.slots.max > 0;
  if (levels.length === 0 && !hasPact) return null;

  const showResets = !readonly && !hideControls && !hideResetButtons;
  const content = (
    <>
      {levels.length > 0 && (
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {levels.map(level => {
            const slot = spellSlots[level];
            return (
              <div
                key={level}
                className="border-divider flex flex-wrap items-center gap-x-4 border-b py-1 pointer-coarse:min-h-11"
              >
                <span className="type-ui text-heading min-w-16">
                  Level {level}
                </span>
                <SlotPipsButtons
                  total={slot.max}
                  available={slot.max - slot.used}
                  level={level}
                  onSpend={
                    !readonly && !hideControls && onSpellSlotChange
                      ? () => onSpellSlotChange(level, 1)
                      : undefined
                  }
                  onRestore={
                    !readonly && !hideControls && onSpellSlotChange
                      ? () => onSpellSlotChange(level, -1)
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}
      {showResets && levels.length > 0 && onResetSpellSlots && (
        <Button
          type="button"
          size="sm"
          className="mt-3"
          onClick={() => onResetSpellSlots()}
        >
          Restore all slots
        </Button>
      )}
      {hasPact && pactMagic && (
        <div
          className={cn(
            'border-divider border-t pt-3',
            levels.length > 0 && 'mt-4'
          )}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="type-ui text-heading">
              Pact slots (level {pactMagic.level})
            </span>
            <SlotPipsButtons
              total={pactMagic.slots.max}
              available={pactMagic.slots.max - pactMagic.slots.used}
              level="pact"
              onSpend={
                !readonly && !hideControls && onPactMagicChange
                  ? () => onPactMagicChange(1)
                  : undefined
              }
              onRestore={
                !readonly && !hideControls && onPactMagicChange
                  ? () => onPactMagicChange(-1)
                  : undefined
              }
            />
            {showResets && onResetPactMagic && (
              <Button
                type="button"
                size="sm"
                onClick={() => onResetPactMagic()}
              >
                Restore pact slots
              </Button>
            )}
          </div>
          {!compact && (
            <p className="type-caption text-muted mt-2">
              Pact slots come back on a short or long rest.
            </p>
          )}
        </div>
      )}
    </>
  );

  return hideTitle ? (
    <div className={className}>{content}</div>
  ) : (
    <Section heading="Spell slots" level={3} className={className}>
      {content}
    </Section>
  );
}
