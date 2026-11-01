'use client';

import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PactMagic, SpellSlots } from '@/types/character';
import { SpellSlotTracker as SharedSpellSlotTracker } from '@/components/shared/spells';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { useUiPrefs } from '@/hooks/useUiPrefs';
import { cn } from '@/utils/cn';

interface SpellSlotTrackerProps {
  spellSlots: SpellSlots;
  pactMagic?: PactMagic;
  onSpellSlotChange: (level: keyof SpellSlots, delta: number) => void;
  onPactMagicChange?: (delta: number) => void;
  onResetSpellSlots: () => void;
  onResetPactMagic?: () => void;
  compact?: boolean;
  className?: string;
}

/** Sheet disclosure shared by Actions and Spells; its state is per device. */
export default function SpellSlotTracker({
  spellSlots,
  pactMagic,
  onSpellSlotChange,
  onPactMagicChange,
  onResetSpellSlots,
  onResetPactMagic,
  compact = false,
  className,
}: SpellSlotTrackerProps) {
  const { prefs, setPref } = useUiPrefs();
  const contentId = useId();
  const expanded = prefs.spellSlotsExpanded;
  const hasSlots =
    Object.values(spellSlots).some(slot => slot.max > 0) ||
    (pactMagic?.slots.max ?? 0) > 0;
  if (!hasSlots) return null;

  return (
    <Section
      heading={
        <Button
          type="button"
          variant="ghost"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setPref('spellSlotsExpanded', !expanded)}
          className="type-subheading h-auto min-h-6 justify-start px-0 py-0 pointer-coarse:min-h-11"
        >
          Spell slots
          <ChevronDown
            aria-hidden="true"
            className={cn('size-4 shrink-0', !expanded && '-rotate-90')}
          />
        </Button>
      }
      level={3}
      className={className}
      contentClassName={!expanded ? 'hidden' : undefined}
    >
      <div id={contentId}>
        {expanded && (
          <SharedSpellSlotTracker
            spellSlots={spellSlots}
            pactMagic={pactMagic}
            onSpellSlotChange={onSpellSlotChange}
            onPactMagicChange={onPactMagicChange}
            onResetSpellSlots={onResetSpellSlots}
            onResetPactMagic={onResetPactMagic}
            compact={compact}
            hideTitle
          />
        )}
      </div>
    </Section>
  );
}
