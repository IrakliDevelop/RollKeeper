'use client';

import React from 'react';
import { SpellSlots, PactMagic } from '@/types/character';
import { SpellSlotTracker as SharedSpellSlotTracker } from '@/components/shared/spells';

interface SpellSlotTrackerProps {
  spellSlots: SpellSlots;
  pactMagic?: PactMagic;
  onSpellSlotChange: (level: keyof SpellSlots, used: number) => void;
  onPactMagicChange?: (used: number) => void;
  onResetSpellSlots: () => void;
  onResetPactMagic?: () => void;
  className?: string;
}

export default function SpellSlotTracker({
  spellSlots,
  pactMagic,
  onSpellSlotChange,
  onPactMagicChange,
  onResetSpellSlots,
  onResetPactMagic,
  className = ''
}: SpellSlotTrackerProps) {
  // Use the shared SpellSlotTracker component with full functionality
  return (
    <SharedSpellSlotTracker
      spellSlots={spellSlots}
      pactMagic={pactMagic}
      onSpellSlotChange={onSpellSlotChange}
      onPactMagicChange={onPactMagicChange}
      onResetSpellSlots={onResetSpellSlots}
      onResetPactMagic={onResetPactMagic}
      readonly={false}
      compact={false}
      hideControls={false}
      hideResetButtons={false}
      showOnlyUsed={false}
      maxLevelToShow={9}
      className={className}
    />
  );
} 